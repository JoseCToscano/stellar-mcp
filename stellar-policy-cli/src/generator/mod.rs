//! Policy project generation

pub mod project_builder;
pub mod template_data;
pub mod templates;

use crate::types::PolicyConfig;
use template_data::TemplateData;

/// Generate a complete policy project from configuration
///
/// This is the main entry point for project generation. It:
/// 1. Converts PolicyConfig to TemplateData
/// 2. Creates the directory structure
/// 3. Renders all templates
/// 4. Writes all files to disk
///
/// # Arguments
/// * `config` - Policy configuration from the wizard
/// * `output_dir` - Directory where the project will be generated
///
/// # Returns
/// * `Ok(())` if generation succeeds
/// * `Err` if any step fails (directory creation, template rendering, file writing)
pub fn generate_project(
    config: &PolicyConfig,
    output_dir: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Convert config to template data
    let template_data = TemplateData::from_policy_config(config);

    // Create directory structure
    project_builder::create_directory_structure(output_dir, &config.name)?;

    // Render all templates
    let files = templates::render_all_templates(&template_data)?;

    // Write all files
    project_builder::write_all_files(output_dir, files)?;

    Ok(())
}
