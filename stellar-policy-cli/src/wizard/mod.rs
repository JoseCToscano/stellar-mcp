//! Interactive wizard for policy configuration

pub mod analyzer;
pub mod questions;
pub mod enhanced;

use crate::types::PolicyConfig;

/// Run the interactive wizard to collect policy configuration
///
/// Uses the enhanced wizard with colors, progress tracking, and back navigation.
///
/// Returns a complete PolicyConfig ready for generation
pub async fn run_wizard() -> Result<PolicyConfig, Box<dyn std::error::Error>> {
    enhanced::EnhancedWizard::new().run().await
}
