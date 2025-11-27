//! MCP server generator module

mod mcp_generator;
mod template_data;
mod templates;

pub use mcp_generator::McpGenerator;

// Re-export specific items to avoid ambiguous glob exports
pub use template_data::{to_kebab_case, to_camel_case, to_pascal_case};
pub use templates::TemplateRenderer;
