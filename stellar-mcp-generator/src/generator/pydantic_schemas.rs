//! Pydantic schema generation for Python MCP servers

use crate::spec::types::{ContractSpec, EnumVariant, FieldSpec, TypeDef, TypeRef, TypeSpec, UnionCase};

/// Check if a TypeRef uses Address type (recursively)
fn type_uses_address(type_ref: &TypeRef) -> bool {
    match type_ref {
        TypeRef::Address => true,
        TypeRef::Option(inner) => type_uses_address(inner),
        TypeRef::Vec(inner) => type_uses_address(inner),
        TypeRef::Map { key, value } => type_uses_address(key) || type_uses_address(value),
        TypeRef::Tuple(types) => types.iter().any(type_uses_address),
        _ => false,
    }
}

/// Generate Pydantic schema class for a struct type
fn generate_struct_schema(name: &str, fields: &[FieldSpec], doc: &Option<String>) -> String {
    let mut output = String::new();

    // Add docstring if available
    if let Some(d) = doc {
        output.push_str(&format!("    \"\"\"{}\"\"\"\n", d.replace('"', r#"\""#)));
    }

    output.push_str(&format!("class {}Schema(BaseModel):\n", name));

    if fields.is_empty() {
        output.push_str("    pass\n");
        return output;
    }

    // Generate field definitions
    for field in fields {
        let field_doc = field.doc.as_deref().unwrap_or("");
        let field_def = field
            .type_ref
            .to_pydantic_field(&field.name, field_doc, true);
        output.push_str(&format!("    {}\n", field_def));
    }

    output
}

/// Generate Pydantic schema for an enum type
fn generate_enum_schema(name: &str, variants: &[EnumVariant], doc: &Option<String>) -> String {
    let mut output = String::new();

    // Add docstring if available
    if let Some(d) = doc {
        output.push_str(&format!("    \"\"\"{}\"\"\"\n", d.replace('"', r#"\""#)));
    }

    // Extract variant names for Literal type
    let variant_names: Vec<String> = variants.iter().map(|v| format!("\"{}\"", v.name)).collect();

    output.push_str(&format!("class {}Schema(BaseModel):\n", name));
    output.push_str("    model_config = ConfigDict(frozen=True)\n");
    output.push_str(&format!(
        "    tag: Literal[{}]\n",
        variant_names.join(", ")
    ));

    output
}

/// Generate Pydantic schema for a union/discriminated union type
fn generate_union_schema(name: &str, cases: &[UnionCase], doc: &Option<String>) -> String {
    let mut output = String::new();

    // Add docstring if available
    if let Some(d) = doc {
        output.push_str(&format!("    \"\"\"{}\"\"\"\n", d.replace('"', r#"\""#)));
    }

    // Check if this is a simple enum (all cases are unit variants)
    let is_simple_enum = cases.iter().all(|c| c.type_ref.is_none());

    if is_simple_enum {
        // Generate as simple enum
        let variant_names: Vec<String> =
            cases.iter().map(|c| format!("\"{}\"", c.name)).collect();

        output.push_str(&format!("class {}Schema(BaseModel):\n", name));
        output.push_str("    model_config = ConfigDict(frozen=True)\n");
        output.push_str(&format!(
            "    tag: Literal[{}]\n",
            variant_names.join(", ")
        ));
    } else {
        // Generate as discriminated union
        let mut union_parts = Vec::new();

        // Generate individual variant classes
        for case in cases {
            let variant_class = format!("{}_{}", name, case.name);
            output.push_str(&format!("class {}(BaseModel):\n", variant_class));
            output.push_str("    model_config = ConfigDict(frozen=True)\n");
            output.push_str(&format!("    tag: Literal[\"{}\"] = \"{}\"\n", case.name, case.name));

            if let Some(type_ref) = &case.type_ref {
                let case_doc = case.doc.as_deref().unwrap_or("");
                let field_def = type_ref.to_pydantic_field("value", case_doc, true);
                output.push_str(&format!("    {}\n", field_def));
            }

            output.push('\n');
            union_parts.push(variant_class);
        }

        // Generate union type alias
        output.push_str(&format!(
            "{}Schema = Union[{}]\n",
            name,
            union_parts.join(", ")
        ));
    }

    output
}

/// Generate all Pydantic schemas from contract specification
pub fn generate_pydantic_schemas(spec: &ContractSpec) -> String {
    let mut output = String::new();

    // Add imports
    output.push_str("from pydantic import BaseModel, Field, ConfigDict\n");
    output.push_str("from typing import Optional, List, Dict, Tuple, Union, Literal\n");

    // Add stellar_sdk Address import if any types use Address
    let uses_address = spec.types.iter().any(|type_spec| {
        match &type_spec.definition {
            TypeDef::Struct { fields } => fields.iter().any(|f| type_uses_address(&f.type_ref)),
            _ => false,
        }
    });

    if uses_address {
        output.push_str("from stellar_sdk import Address\n");
    }

    // Add binding class imports if we have types
    if !spec.types.is_empty() {
        let type_names: Vec<String> = spec.types.iter().map(|t| t.name.clone()).collect();
        output.push_str(&format!("from .bindings.bindings import {}\n", type_names.join(", ")));
    }

    output.push_str("\n");

    // Generate schema for each custom type
    for type_spec in &spec.types {
        match &type_spec.definition {
            TypeDef::Struct { fields } => {
                output.push_str(&generate_struct_schema(
                    &type_spec.name,
                    fields,
                    &type_spec.doc,
                ));
            }
            TypeDef::Enum { variants } => {
                output.push_str(&generate_enum_schema(
                    &type_spec.name,
                    variants,
                    &type_spec.doc,
                ));
            }
            TypeDef::Union { cases } => {
                output.push_str(&generate_union_schema(
                    &type_spec.name,
                    cases,
                    &type_spec.doc,
                ));
            }
        }
        output.push('\n');
    }

    output
}

/// Generate conversion helper functions between Pydantic models and binding classes
pub fn generate_conversion_helpers(spec: &ContractSpec) -> String {
    let mut output = String::new();

    output.push_str("# Conversion helpers between Pydantic schemas and binding classes\n\n");

    for type_spec in &spec.types {
        let type_name = &type_spec.name;

        match &type_spec.definition {
            TypeDef::Struct { fields } => {
                // Generate to_bindings method
                output.push_str(&format!(
                    "def {}_to_bindings(schema: {}Schema) -> {}:\n",
                    type_name.to_lowercase(),
                    type_name,
                    type_name
                ));
                output.push_str("    \"\"\"Convert Pydantic schema to binding class\"\"\"\n");
                output.push_str(&format!("    return {}(\n", type_name));

                for field in fields {
                    let field_name = &field.name;
                    // Handle type conversion based on field type
                    let conversion = match &field.type_ref {
                        crate::spec::types::TypeRef::Address => {
                            format!("Address(schema.{})", field_name)
                        }
                        crate::spec::types::TypeRef::Custom(custom_name) => {
                            format!(
                                "{}_to_bindings(schema.{})",
                                custom_name.to_lowercase(),
                                field_name
                            )
                        }
                        crate::spec::types::TypeRef::BytesN(_) => {
                            // BytesN (fixed-size bytes) comes as hex string, convert to bytes
                            format!("bytes.fromhex(schema.{}) if isinstance(schema.{}, str) else schema.{}", field_name, field_name, field_name)
                        }
                        crate::spec::types::TypeRef::String => {
                            // Check if the binding expects bytes (common for name/symbol fields)
                            // We encode strings to UTF-8 bytes if needed
                            format!("schema.{}.encode('utf-8') if isinstance(schema.{}, str) else schema.{}", field_name, field_name, field_name)
                        }
                        crate::spec::types::TypeRef::Option(inner) => {
                            match **inner {
                                crate::spec::types::TypeRef::Address => {
                                    format!("Address(schema.{}) if schema.{} else None", field_name, field_name)
                                }
                                crate::spec::types::TypeRef::Custom(ref custom_name) => {
                                    format!(
                                        "{}_to_bindings(schema.{}) if schema.{} else None",
                                        custom_name.to_lowercase(),
                                        field_name,
                                        field_name
                                    )
                                }
                                crate::spec::types::TypeRef::U128
                                | crate::spec::types::TypeRef::I128
                                | crate::spec::types::TypeRef::U256
                                | crate::spec::types::TypeRef::I256 => {
                                    format!("int(schema.{}) if schema.{} else None", field_name, field_name)
                                }
                                _ => format!("schema.{}", field_name),
                            }
                        }
                        crate::spec::types::TypeRef::Vec(inner) => {
                            match **inner {
                                crate::spec::types::TypeRef::Custom(ref custom_name) => {
                                    format!(
                                        "[{}_to_bindings(item) for item in schema.{}]",
                                        custom_name.to_lowercase(),
                                        field_name
                                    )
                                }
                                _ => format!("schema.{}", field_name),
                            }
                        }
                        crate::spec::types::TypeRef::U128
                        | crate::spec::types::TypeRef::I128
                        | crate::spec::types::TypeRef::U256
                        | crate::spec::types::TypeRef::I256 => {
                            format!("int(schema.{})", field_name)
                        }
                        _ => format!("schema.{}", field_name),
                    };
                    output.push_str(&format!("        {}={},\n", field_name, conversion));
                }

                output.push_str("    )\n\n");
            }
            TypeDef::Enum { .. } | TypeDef::Union { .. } => {
                // For enums/unions, generate conversion using Kind enum
                output.push_str(&format!(
                    "def {}_to_bindings(schema: {}Schema) -> {}:\n",
                    type_name.to_lowercase(),
                    type_name,
                    type_name
                ));
                output.push_str("    \"\"\"Convert Pydantic schema to binding class\"\"\"\n");
                output.push_str(&format!("    from .bindings.bindings import {}Kind\n", type_name));
                output.push_str(&format!("    return {}(kind={}Kind(schema.tag))\n\n", type_name, type_name));
            }
        }
    }

    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::spec::types::{TypeRef, FieldSpec, TypeSpec, TypeDef, ContractSpec};

    #[test]
    fn test_generate_struct_schema() {
        let fields = vec![
            FieldSpec {
                name: "admin".to_string(),
                doc: Some("Admin address".to_string()),
                type_ref: TypeRef::Address,
            },
            FieldSpec {
                name: "count".to_string(),
                doc: Some("Counter".to_string()),
                type_ref: TypeRef::U32,
            },
        ];

        let schema = generate_struct_schema("TestStruct", &fields, &None);
        assert!(schema.contains("class TestStructSchema(BaseModel)"));
        assert!(schema.contains("admin: str = Field"));
        assert!(schema.contains("min_length=56"));
    }

    #[test]
    fn test_generate_enum_schema() {
        let variants = vec![
            EnumVariant {
                name: "Active".to_string(),
                doc: None,
                value: 0,
            },
            EnumVariant {
                name: "Inactive".to_string(),
                doc: None,
                value: 1,
            },
        ];

        let schema = generate_enum_schema("Status", &variants, &None);
        assert!(schema.contains("class StatusSchema(BaseModel)"));
        assert!(schema.contains("tag: Literal[\"Active\", \"Inactive\"]"));
    }
}
