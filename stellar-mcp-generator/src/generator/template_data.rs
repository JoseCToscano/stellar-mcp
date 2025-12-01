//! Template data structures for Handlebars rendering

use serde::Serialize;

/// Data for the main index.ts template
#[derive(Serialize)]
pub struct IndexTemplateData {
    pub server_name: String,
    pub contract_id: String,
    pub contract_name: String,
    pub rpc_url: String,
    pub network_passphrase: String,
    pub functions: Vec<FunctionTemplateData>,
    pub with_launchtube: bool,
    pub with_passkey: bool,
}

/// Function data for templates
#[derive(Serialize)]
pub struct FunctionTemplateData {
    pub name: String,
    pub name_kebab: String,
    pub name_camel: String,
    pub doc: String,
    pub inputs: Vec<InputTemplateData>,
    pub has_inputs: bool,
    pub output_type: String,
    pub has_output: bool,
}

/// Input parameter data for templates
#[derive(Serialize)]
pub struct InputTemplateData {
    pub name: String,
    pub name_camel: String,
    pub doc: String,
    pub ts_type: String,
    pub zod_type: String,
    pub is_last: bool,
}

/// Data for the schema template
#[derive(Serialize)]
pub struct SchemaTemplateData {
    pub contract_name: String,
    pub functions: Vec<FunctionSchemaData>,
    pub types: Vec<TypeSchemaData>,
}

/// Function schema data
#[derive(Serialize)]
pub struct FunctionSchemaData {
    pub name: String,
    pub name_pascal: String,
    pub inputs: Vec<InputTemplateData>,
    pub has_inputs: bool,
}

/// Custom type schema data
#[derive(Serialize)]
pub struct TypeSchemaData {
    pub name: String,
    pub name_pascal: String,
    pub fields: Vec<FieldSchemaData>,
    pub is_enum: bool,
    pub enum_variants: Vec<EnumVariantData>,
}

/// Field schema data
#[derive(Serialize)]
pub struct FieldSchemaData {
    pub name: String,
    pub name_camel: String,
    pub ts_type: String,
    pub zod_type: String,
    pub is_last: bool,
}

/// Enum variant data
#[derive(Serialize)]
pub struct EnumVariantData {
    pub name: String,
    pub value: u32,
    pub is_last: bool,
}

/// Data for package.json template
#[derive(Serialize)]
pub struct PackageJsonData {
    pub name: String,
    pub description: String,
    pub version: String,
    pub with_launchtube: bool,
    pub with_passkey: bool,
}

/// Data for .env.example template
#[derive(Serialize)]
pub struct EnvExampleData {
    pub contract_id: String,
    pub rpc_url: String,
    pub network_passphrase: String,
    pub with_launchtube: bool,
    pub with_passkey: bool,
}

/// Data for README template
#[derive(Serialize)]
pub struct ReadmeTemplateData {
    pub server_name: String,
    pub contract_id: String,
    pub contract_name: String,
    pub network_name: String,
    pub functions: Vec<FunctionDocData>,
    pub with_launchtube: bool,
    pub with_passkey: bool,
}

/// Function documentation data
#[derive(Serialize)]
pub struct FunctionDocData {
    pub name: String,
    pub name_kebab: String,
    pub doc: String,
    pub inputs: Vec<InputDocData>,
    pub output_type: String,
}

/// Input documentation data
#[derive(Serialize)]
pub struct InputDocData {
    pub name: String,
    pub ts_type: String,
    pub doc: String,
    pub required: bool,
}

// Helper functions for name conversion

/// Convert to kebab-case
pub fn to_kebab_case(s: &str) -> String {
    let mut result = String::new();
    for (i, c) in s.chars().enumerate() {
        if c.is_uppercase() {
            if i > 0 {
                result.push('-');
            }
            result.push(c.to_lowercase().next().unwrap());
        } else if c == '_' {
            result.push('-');
        } else {
            result.push(c);
        }
    }
    result
}

/// Convert to camelCase
pub fn to_camel_case(s: &str) -> String {
    let mut result = String::new();
    let mut capitalize_next = false;

    for (i, c) in s.chars().enumerate() {
        if c == '_' || c == '-' {
            capitalize_next = true;
        } else if capitalize_next {
            result.push(c.to_uppercase().next().unwrap());
            capitalize_next = false;
        } else if i == 0 {
            result.push(c.to_lowercase().next().unwrap());
        } else {
            result.push(c);
        }
    }
    result
}

/// Convert to PascalCase
pub fn to_pascal_case(s: &str) -> String {
    let mut result = String::new();
    let mut capitalize_next = true;

    for c in s.chars() {
        if c == '_' || c == '-' {
            capitalize_next = true;
        } else if capitalize_next {
            result.push(c.to_uppercase().next().unwrap());
            capitalize_next = false;
        } else {
            result.push(c);
        }
    }
    result
}
