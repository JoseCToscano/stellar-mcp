//! Template rendering using Handlebars

use handlebars::Handlebars;
use serde::Serialize;
use std::error::Error;

/// Template renderer using Handlebars
pub struct TemplateRenderer<'a> {
    handlebars: Handlebars<'a>,
}

impl<'a> TemplateRenderer<'a> {
    /// Create a new template renderer with embedded templates
    pub fn new() -> Result<Self, Box<dyn Error>> {
        let mut handlebars = Handlebars::new();

        // Embedded templates (compiled into binary)
        handlebars.register_template_string("index", include_str!("../../templates/index.ts.hbs"))?;
        handlebars.register_template_string("tools", include_str!("../../templates/tools.ts.hbs"))?;
        handlebars.register_template_string("schemas", include_str!("../../templates/schemas.ts.hbs"))?;
        handlebars.register_template_string("types", include_str!("../../templates/types.ts.hbs"))?;
        handlebars.register_template_string("launchtube", include_str!("../../templates/launchtube.ts.hbs"))?;
        handlebars.register_template_string("passkey", include_str!("../../templates/passkey.ts.hbs"))?;
        handlebars.register_template_string("transaction", include_str!("../../templates/transaction.ts.hbs"))?;
        handlebars.register_template_string("package_json", include_str!("../../templates/package.json.hbs"))?;
        handlebars.register_template_string("tsconfig", include_str!("../../templates/tsconfig.json.hbs"))?;
        handlebars.register_template_string("env_example", include_str!("../../templates/env.example.hbs"))?;
        handlebars.register_template_string("readme", include_str!("../../templates/README.md.hbs"))?;
        handlebars.register_template_string("vercel", include_str!("../../templates/vercel.json.hbs"))?;

        Ok(Self { handlebars })
    }

    /// Render a template with the given data
    pub fn render<T: Serialize>(&self, template_name: &str, data: &T) -> Result<String, Box<dyn Error>> {
        Ok(self.handlebars.render(template_name, data)?)
    }
}

/// Data for the index.ts template
#[derive(Serialize)]
pub struct IndexData {
    pub contract_name: String,
    pub contract_id: String,
    pub server_name: String,
    pub rpc_url: String,
    pub network_passphrase: String,
    pub functions: Vec<FunctionData>,
    pub with_launchtube: bool,
    pub with_passkey: bool,
}

/// Data for a function in templates
#[derive(Serialize)]
pub struct FunctionData {
    pub name: String,
    pub name_kebab: String,
    pub name_camel: String,
    pub name_pascal: String,
    pub doc: String,
    pub inputs: Vec<InputData>,
    pub has_inputs: bool,
    pub output_type: String,
    pub has_output: bool,
}

/// Data for a function input
#[derive(Serialize)]
pub struct InputData {
    pub name: String,
    pub name_camel: String,
    pub doc: String,
    pub ts_type: String,
    pub zod_type: String,
    pub is_address: bool,
}

/// Data for the tools.ts template
#[derive(Serialize)]
pub struct ToolsData {
    pub contract_name: String,
    pub functions: Vec<FunctionData>,
}

/// Data for the schemas.ts template
#[derive(Serialize)]
pub struct SchemasData {
    pub contract_name: String,
    pub types: Vec<TypeData>,
    pub functions: Vec<FunctionData>,
}

/// Data for custom types
#[derive(Serialize)]
pub struct TypeData {
    pub name: String,
    pub name_pascal: String,
    pub doc: Option<String>,
    pub is_struct: bool,
    pub is_enum: bool,
    pub is_union: bool,
    pub fields: Vec<FieldData>,
    pub variants: Vec<VariantData>,
    pub cases: Vec<CaseData>,
}

/// Data for struct fields
#[derive(Serialize)]
pub struct FieldData {
    pub name: String,
    pub name_camel: String,
    pub doc: Option<String>,
    pub ts_type: String,
    pub zod_type: String,
}

/// Data for enum variants
#[derive(Serialize)]
pub struct VariantData {
    pub name: String,
    pub doc: Option<String>,
    pub value: u32,
}

/// Data for union cases
#[derive(Serialize)]
pub struct CaseData {
    pub name: String,
    pub doc: Option<String>,
    pub has_value: bool,
    pub ts_type: String,
    pub zod_type: String,
}

/// Data for the types.ts template
#[derive(Serialize)]
pub struct TypesData {
    pub contract_name: String,
    pub types: Vec<TypeData>,
}

/// Data for lib templates
#[derive(Serialize)]
pub struct LibData {
    pub contract_name: String,
    pub network_passphrase: String,
}

/// Data for README template
#[derive(Serialize)]
pub struct ReadmeData {
    pub server_name_pascal: String,
    pub contract_name: String,
    pub contract_id: String,
    pub network_name: String,
    pub rpc_url: String,
    pub network_passphrase: String,
    pub output_dir: String,
    pub functions: Vec<FunctionData>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_template_renderer_creation() {
        let renderer = TemplateRenderer::new();
        assert!(renderer.is_ok());
    }
}
