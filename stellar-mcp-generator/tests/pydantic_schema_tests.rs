//! Tests for Pydantic schema generation

use stellar_mcp_generator::spec::types::{
    ContractSpec, EnumVariant, FieldSpec, FunctionSpec, ParameterSpec, TypeDef, TypeRef, TypeSpec,
};

#[test]
fn test_type_ref_to_pydantic_primitives() {
    assert_eq!(TypeRef::Bool.to_pydantic(), "bool");
    assert_eq!(TypeRef::U32.to_pydantic(), "int");
    assert_eq!(TypeRef::I32.to_pydantic(), "int");
    assert_eq!(TypeRef::U64.to_pydantic(), "int");
    assert_eq!(TypeRef::U128.to_pydantic(), "str");
    assert_eq!(TypeRef::String.to_pydantic(), "str");
    assert_eq!(TypeRef::Address.to_pydantic(), "str");
    assert_eq!(TypeRef::Bytes.to_pydantic(), "bytes");
}

#[test]
fn test_type_ref_to_pydantic_option() {
    let opt_string = TypeRef::Option(Box::new(TypeRef::String));
    assert_eq!(opt_string.to_pydantic(), "Optional[str]");

    let opt_address = TypeRef::Option(Box::new(TypeRef::Address));
    assert_eq!(opt_address.to_pydantic(), "Optional[str]");

    let opt_custom = TypeRef::Option(Box::new(TypeRef::Custom("TokenConfig".to_string())));
    assert_eq!(opt_custom.to_pydantic(), "Optional[TokenConfigSchema]");
}

#[test]
fn test_type_ref_to_pydantic_vec() {
    let vec_string = TypeRef::Vec(Box::new(TypeRef::String));
    assert_eq!(vec_string.to_pydantic(), "List[str]");

    let vec_custom = TypeRef::Vec(Box::new(TypeRef::Custom("Token".to_string())));
    assert_eq!(vec_custom.to_pydantic(), "List[TokenSchema]");
}

#[test]
fn test_type_ref_to_pydantic_map() {
    let map = TypeRef::Map {
        key: Box::new(TypeRef::String),
        value: Box::new(TypeRef::U32),
    };
    assert_eq!(map.to_pydantic(), "Dict[str, int]");
}

#[test]
fn test_type_ref_to_pydantic_tuple() {
    let tuple = TypeRef::Tuple(vec![TypeRef::String, TypeRef::U32, TypeRef::Bool]);
    assert_eq!(tuple.to_pydantic(), "Tuple[str, int, bool]");
}

#[test]
fn test_type_ref_to_pydantic_custom() {
    let custom = TypeRef::Custom("TokenConfig".to_string());
    assert_eq!(custom.to_pydantic(), "TokenConfigSchema");
}

#[test]
fn test_type_ref_to_pydantic_field_address_required() {
    let address = TypeRef::Address;
    let field = address.to_pydantic_field("admin", "Admin address", true);
    assert!(field.contains("admin: str"));
    assert!(field.contains("Field(..."));
    assert!(field.contains("min_length=56"));
    assert!(field.contains("max_length=56"));
    assert!(field.contains("Admin address"));
}

#[test]
fn test_type_ref_to_pydantic_field_address_optional() {
    let opt_address = TypeRef::Option(Box::new(TypeRef::Address));
    let field = opt_address.to_pydantic_field("asset", "Asset address", false);
    assert!(field.contains("asset: Optional[str]"));
    assert!(field.contains("Field(None"));
}

#[test]
fn test_type_ref_to_pydantic_field_bytes_n() {
    let bytes32 = TypeRef::BytesN(32);
    let field = bytes32.to_pydantic_field("salt", "Random salt", true);
    assert!(field.contains("salt: str"));
    assert!(field.contains("min_length=64"));
    assert!(field.contains("max_length=64"));
}

#[test]
fn test_type_ref_to_pydantic_field_custom_type() {
    let custom = TypeRef::Custom("TokenType".to_string());
    let field = custom.to_pydantic_field("token_type", "Type of token", true);
    assert!(field.contains("token_type: TokenTypeSchema"));
    assert!(field.contains("Field(..."));
    assert!(field.contains("Type of token"));
}

#[test]
fn test_type_ref_to_pydantic_field_description_escaping() {
    let string_type = TypeRef::String;
    let field = string_type.to_pydantic_field(
        "name",
        "Token \"name\" with\nnewline",
        true,
    );
    // Should escape quotes and remove newlines
    assert!(field.contains(r#"Token \"name\" with newline"#) || field.contains("Token \\\"name\\\" with"));
    assert!(!field.contains('\n'));
}

#[test]
fn test_pydantic_schema_generation_struct() {
    use stellar_mcp_generator::generator::pydantic_schemas;

    let spec = ContractSpec {
        name: Some("TestContract".to_string()),
        functions: vec![],
        types: vec![TypeSpec {
            name: "TokenConfig".to_string(),
            doc: Some("Token configuration".to_string()),
            definition: TypeDef::Struct {
                fields: vec![
                    FieldSpec {
                        name: "admin".to_string(),
                        doc: Some("Admin address".to_string()),
                        type_ref: TypeRef::Address,
                    },
                    FieldSpec {
                        name: "decimals".to_string(),
                        doc: Some("Decimal places".to_string()),
                        type_ref: TypeRef::U32,
                    },
                ],
            },
        }],
        errors: vec![],
        raw_spec_entries: vec![],
    };

    let schemas = pydantic_schemas::generate_pydantic_schemas(&spec);

    assert!(schemas.contains("class TokenConfigSchema(BaseModel)"));
    assert!(schemas.contains("admin: str = Field"));
    assert!(schemas.contains("min_length=56"));
    assert!(schemas.contains("decimals: int = Field"));
    assert!(schemas.contains("Admin address"));
    assert!(schemas.contains("Decimal places"));
}

#[test]
fn test_pydantic_schema_generation_enum() {
    use stellar_mcp_generator::generator::pydantic_schemas;

    let spec = ContractSpec {
        name: Some("TestContract".to_string()),
        functions: vec![],
        types: vec![TypeSpec {
            name: "TokenType".to_string(),
            doc: Some("Token type enum".to_string()),
            definition: TypeDef::Enum {
                variants: vec![
                    EnumVariant {
                        name: "Allowlist".to_string(),
                        doc: None,
                        value: 0,
                    },
                    EnumVariant {
                        name: "Blocklist".to_string(),
                        doc: None,
                        value: 1,
                    },
                ],
            },
        }],
        errors: vec![],
        raw_spec_entries: vec![],
    };

    let schemas = pydantic_schemas::generate_pydantic_schemas(&spec);

    assert!(schemas.contains("class TokenTypeSchema(BaseModel)"));
    assert!(schemas.contains("model_config = ConfigDict(frozen=True)"));
    assert!(schemas.contains(r#"tag: Literal["Allowlist", "Blocklist"]"#));
}

#[test]
fn test_pydantic_conversion_helpers_generated() {
    use stellar_mcp_generator::generator::pydantic_schemas;

    let spec = ContractSpec {
        name: Some("TestContract".to_string()),
        functions: vec![],
        types: vec![TypeSpec {
            name: "TokenConfig".to_string(),
            doc: None,
            definition: TypeDef::Struct {
                fields: vec![FieldSpec {
                    name: "admin".to_string(),
                    doc: None,
                    type_ref: TypeRef::Address,
                }],
            },
        }],
        errors: vec![],
        raw_spec_entries: vec![],
    };

    let conversions = pydantic_schemas::generate_conversion_helpers(&spec);

    assert!(conversions.contains("def tokenconfig_to_bindings"));
    assert!(conversions.contains("schema: TokenConfigSchema"));
    assert!(conversions.contains("-> TokenConfig"));
    assert!(conversions.contains("Address(schema.admin)"));
}

#[test]
fn test_pydantic_imports_included() {
    use stellar_mcp_generator::generator::pydantic_schemas;

    let spec = ContractSpec {
        name: None,
        functions: vec![],
        types: vec![],
        errors: vec![],
        raw_spec_entries: vec![],
    };

    let schemas = pydantic_schemas::generate_pydantic_schemas(&spec);

    assert!(schemas.contains("from pydantic import BaseModel, Field, ConfigDict"));
    assert!(schemas.contains("from typing import Optional, List, Dict, Tuple, Union, Literal"));
}

#[test]
fn test_nested_custom_types() {
    let nested = TypeRef::Vec(Box::new(TypeRef::Custom("Token".to_string())));
    assert_eq!(nested.to_pydantic(), "List[TokenSchema]");

    let opt_nested = TypeRef::Option(Box::new(TypeRef::Vec(Box::new(TypeRef::Custom(
        "Config".to_string(),
    )))));
    assert_eq!(opt_nested.to_pydantic(), "Optional[List[ConfigSchema]]");
}

#[test]
fn test_result_type_mapping() {
    let result = TypeRef::Result {
        ok: Box::new(TypeRef::String),
        err: Box::new(TypeRef::U32),
    };
    // Result types map to their ok type
    assert_eq!(result.to_pydantic(), "str");
}

#[test]
fn test_bigint_types_as_strings() {
    // Large integers should map to strings in Pydantic
    assert_eq!(TypeRef::U128.to_pydantic(), "str");
    assert_eq!(TypeRef::I128.to_pydantic(), "str");
    assert_eq!(TypeRef::U256.to_pydantic(), "str");
    assert_eq!(TypeRef::I256.to_pydantic(), "str");
}

#[test]
fn test_complex_nested_pydantic_type() {
    // Test: Optional[List[Dict[str, TokenConfigSchema]]]
    let complex = TypeRef::Option(Box::new(TypeRef::Vec(Box::new(TypeRef::Map {
        key: Box::new(TypeRef::String),
        value: Box::new(TypeRef::Custom("TokenConfig".to_string())),
    }))));

    assert_eq!(
        complex.to_pydantic(),
        "Optional[List[Dict[str, TokenConfigSchema]]]"
    );
}

#[test]
fn test_generated_pydantic_import_statements() {
    use stellar_mcp_generator::generator::pydantic_schemas;

    let spec = ContractSpec {
        name: None,
        functions: vec![],
        types: vec![],
        errors: vec![],
        raw_spec_entries: vec![],
    };

    let schemas = pydantic_schemas::generate_pydantic_schemas(&spec);

    // Verify required Pydantic imports
    assert!(schemas.contains("from pydantic import BaseModel"));
    assert!(schemas.contains("Field"));
    assert!(schemas.contains("ConfigDict"));

    // Verify typing imports
    assert!(schemas.contains("from typing import Optional"));
    assert!(schemas.contains("List"));
    assert!(schemas.contains("Dict"));
    assert!(schemas.contains("Literal"));
}

#[test]
fn test_pydantic_field_frozen_for_enums() {
    use stellar_mcp_generator::generator::pydantic_schemas;

    let spec = ContractSpec {
        name: None,
        functions: vec![],
        types: vec![TypeSpec {
            name: "Status".to_string(),
            doc: None,
            definition: TypeDef::Enum {
                variants: vec![EnumVariant {
                    name: "Active".to_string(),
                    doc: None,
                    value: 0,
                }],
            },
        }],
        errors: vec![],
        raw_spec_entries: vec![],
    };

    let schemas = pydantic_schemas::generate_pydantic_schemas(&spec);

    // Enums should be frozen (immutable)
    assert!(schemas.contains("model_config = ConfigDict(frozen=True)"));
}
