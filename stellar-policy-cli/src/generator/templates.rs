//! Template loading and rendering with Handlebars

use handlebars::Handlebars;
use super::template_data::TemplateData;

// Embedded templates using include_str!
const CONTRACT_LIB_TEMPLATE: &str = include_str!("../../templates/contract/lib.rs.hbs");
const CONTRACT_TYPES_TEMPLATE: &str = include_str!("../../templates/contract/types.rs.hbs");
const CONTRACT_TEST_TEMPLATE: &str = include_str!("../../templates/contract/test.rs.hbs");
const WORKSPACE_CARGO_TEMPLATE: &str = include_str!("../../templates/workspace/Cargo.toml.hbs");
const POLICY_CARGO_TEMPLATE: &str = include_str!("../../templates/workspace/policy-Cargo.toml.hbs");
const RUST_TOOLCHAIN_TEMPLATE: &str = include_str!("../../templates/workspace/rust-toolchain.toml.hbs");
const MAKEFILE_TEMPLATE: &str = include_str!("../../templates/Makefile.hbs");
const README_TEMPLATE: &str = include_str!("../../templates/README.md.hbs");
const DEMO_TEMPLATE: &str = include_str!("../../templates/DEMO.md.hbs");
const ENV_EXAMPLE_TEMPLATE: &str = include_str!("../../templates/env.example.hbs");
const TYPESCRIPT_EXAMPLE_TEMPLATE: &str = include_str!("../../templates/integration/typescript-example.ts.hbs");
const PACKAGE_JSON_TEMPLATE: &str = include_str!("../../templates/integration/package.json.hbs");
const TSCONFIG_TEMPLATE: &str = include_str!("../../templates/integration/tsconfig.json.hbs");
const FIX_BINDINGS_SCRIPT: &str = include_str!("../../templates/scripts/fix-bindings.sh");

/// Load all templates and register with Handlebars
pub fn load_templates() -> Result<Handlebars<'static>, Box<dyn std::error::Error>> {
    let mut handlebars = Handlebars::new();

    // Register all templates
    handlebars.register_template_string("contract_lib", CONTRACT_LIB_TEMPLATE)?;
    handlebars.register_template_string("contract_types", CONTRACT_TYPES_TEMPLATE)?;
    handlebars.register_template_string("contract_test", CONTRACT_TEST_TEMPLATE)?;
    handlebars.register_template_string("workspace_cargo", WORKSPACE_CARGO_TEMPLATE)?;
    handlebars.register_template_string("policy_cargo", POLICY_CARGO_TEMPLATE)?;
    handlebars.register_template_string("rust_toolchain", RUST_TOOLCHAIN_TEMPLATE)?;
    handlebars.register_template_string("makefile", MAKEFILE_TEMPLATE)?;
    handlebars.register_template_string("readme", README_TEMPLATE)?;
    handlebars.register_template_string("demo", DEMO_TEMPLATE)?;
    handlebars.register_template_string("env_example", ENV_EXAMPLE_TEMPLATE)?;
    handlebars.register_template_string("typescript_example", TYPESCRIPT_EXAMPLE_TEMPLATE)?;
    handlebars.register_template_string("package_json", PACKAGE_JSON_TEMPLATE)?;
    handlebars.register_template_string("tsconfig", TSCONFIG_TEMPLATE)?;
    handlebars.register_template_string("fix_bindings_script", FIX_BINDINGS_SCRIPT)?;

    Ok(handlebars)
}

/// Render a specific template with data
pub fn render_template(
    handlebars: &Handlebars,
    name: &str,
    data: &TemplateData,
) -> Result<String, Box<dyn std::error::Error>> {
    let rendered = handlebars.render(name, data)?;
    Ok(rendered)
}

/// Render all templates and return a map of file paths to contents
pub fn render_all_templates(
    data: &TemplateData,
) -> Result<Vec<(String, String)>, Box<dyn std::error::Error>> {
    let handlebars = load_templates()?;
    let mut files = Vec::new();

    // Contract files
    files.push((
        format!("contracts/{}/src/lib.rs", data.policy_name),
        render_template(&handlebars, "contract_lib", data)?,
    ));

    if data.admin_managed {
        files.push((
            format!("contracts/{}/src/types.rs", data.policy_name),
            render_template(&handlebars, "contract_types", data)?,
        ));
    }

    files.push((
        format!("contracts/{}/src/test.rs", data.policy_name),
        render_template(&handlebars, "contract_test", data)?,
    ));

    // Workspace files
    files.push((
        "contracts/Cargo.toml".to_string(),
        render_template(&handlebars, "workspace_cargo", data)?,
    ));

    files.push((
        format!("contracts/{}/Cargo.toml", data.policy_name),
        render_template(&handlebars, "policy_cargo", data)?,
    ));

    files.push((
        "contracts/rust-toolchain.toml".to_string(),
        render_template(&handlebars, "rust_toolchain", data)?,
    ));

    files.push((
        "Makefile".to_string(),
        render_template(&handlebars, "makefile", data)?,
    ));

    // Documentation and examples
    files.push((
        "README.md".to_string(),
        render_template(&handlebars, "readme", data)?,
    ));

    files.push((
        "DEMO.md".to_string(),
        render_template(&handlebars, "demo", data)?,
    ));

    files.push((
        ".env.example".to_string(),
        render_template(&handlebars, "env_example", data)?,
    ));

    files.push((
        "examples/typescript-integration.ts".to_string(),
        render_template(&handlebars, "typescript_example", data)?,
    ));

    files.push((
        "package.json".to_string(),
        render_template(&handlebars, "package_json", data)?,
    ));

    files.push((
        "tsconfig.json".to_string(),
        render_template(&handlebars, "tsconfig", data)?,
    ));

    files.push((
        "scripts/fix-bindings.sh".to_string(),
        render_template(&handlebars, "fix_bindings_script", data)?,
    ));

    Ok(files)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::PolicyConfig;

    #[test]
    fn test_load_templates() {
        let result = load_templates();
        assert!(result.is_ok());
    }

    #[test]
    fn test_render_simple_contract() {
        let config = PolicyConfig {
            name: "test-policy".to_string(),
            description: None,
            function_whitelist: Some(vec!["transfer".to_string()]),
            contract_whitelist: None,
            recipient_whitelist: None,
            amount_cap: None,
            rate_limiting: None,
            admin_managed: false,
        };

        let data = TemplateData::from_policy_config(&config);
        let handlebars = load_templates().unwrap();
        let rendered = render_template(&handlebars, "contract_lib", &data).unwrap();

        // Should include policy__ function
        assert!(rendered.contains("pub fn policy__"));
        // Should include SignerKey definition
        assert!(rendered.contains("pub enum SignerKey"));
        // Should NOT include admin functions
        assert!(!rendered.contains("pub fn init"));
        // Should include function whitelist logic
        assert!(rendered.contains("transfer"));
    }

    #[test]
    fn test_render_admin_contract() {
        let config = PolicyConfig {
            name: "admin-policy".to_string(),
            description: None,
            function_whitelist: None,
            contract_whitelist: None,
            recipient_whitelist: None,
            amount_cap: Some(crate::types::AmountCapConfig {
                max_amount: 1000,
                token_contract: None,
            }),
            rate_limiting: Some(crate::types::RateLimitConfig { min_ledgers: 10 }),
            admin_managed: true,
        };

        let data = TemplateData::from_policy_config(&config);
        let handlebars = load_templates().unwrap();
        let rendered = render_template(&handlebars, "contract_lib", &data).unwrap();

        // Should include admin functions
        assert!(rendered.contains("pub fn init"));
        assert!(rendered.contains("pub fn add_wallet"));
        // Should include types module
        assert!(rendered.contains("mod types"));
    }

    #[test]
    fn test_render_all_templates_simple() {
        let config = PolicyConfig {
            name: "simple-policy".to_string(),
            description: Some("A simple test policy".to_string()),
            function_whitelist: Some(vec!["transfer".to_string()]),
            contract_whitelist: None,
            recipient_whitelist: None,
            amount_cap: None,
            rate_limiting: None,
            admin_managed: false,
        };

        let data = TemplateData::from_policy_config(&config);
        let files = render_all_templates(&data).unwrap();

        // Should have core files (no types.rs for simple policy)
        assert!(files.iter().any(|(path, _)| path.ends_with("lib.rs")));
        assert!(files.iter().any(|(path, _)| path.ends_with("test.rs")));
        assert!(files.iter().any(|(path, _)| path.contains("Cargo.toml")));
        assert!(files.iter().any(|(path, _)| path == "README.md"));
        assert!(files.iter().any(|(path, _)| path == "DEMO.md"));
        assert!(files.iter().any(|(path, _)| path == "Makefile"));

        // Should NOT have types.rs for simple policy
        assert!(!files.iter().any(|(path, _)| path.ends_with("types.rs")));
    }

    #[test]
    fn test_render_all_templates_admin() {
        let config = PolicyConfig {
            name: "admin-policy".to_string(),
            description: None,
            function_whitelist: None,
            contract_whitelist: None,
            recipient_whitelist: None,
            amount_cap: Some(crate::types::AmountCapConfig {
                max_amount: 5000,
                token_contract: None,
            }),
            rate_limiting: None,
            admin_managed: true,
        };

        let data = TemplateData::from_policy_config(&config);
        let files = render_all_templates(&data).unwrap();

        // Should have types.rs for admin policy
        assert!(files.iter().any(|(path, _)| path.ends_with("types.rs")));
    }
}
