//! Generate command - Creates policy smart contracts via interactive wizard

use crate::{generator, wizard};
use clap::Parser;
use console::style;

/// Arguments for the generate command
#[derive(Parser, Debug)]
pub struct GenerateArgs {
    /// Output directory for generated policy project (defaults to policy name)
    #[arg(short, long)]
    pub output: Option<String>,
}

/// Execute the generate command
pub async fn execute(args: GenerateArgs) -> Result<(), Box<dyn std::error::Error>> {
    // Run the interactive wizard to collect policy configuration
    let config = wizard::run_wizard().await?;

    // Determine output directory (use --output flag or default to policy name)
    let output_dir = args.output.unwrap_or_else(|| config.name.clone());

    println!();
    println!("{}", style("✨ Generating policy contract...").cyan().bold());
    println!();

    // Generate the complete project
    generator::generate_project(&config, &output_dir)?;

    // Display success message
    println!("{}", style("✅ Policy contract generated successfully!").green().bold());
    println!();
    println!("{}", style("📂 Project Location:").bold());
    println!("   {}/", output_dir);
    println!();
    println!("{}", style("📋 Policy Summary:").bold());
    println!("   Name: {}", config.name);
    if let Some(desc) = &config.description {
        println!("   Description: {}", desc);
    }
    println!("   Admin managed: {}", config.admin_managed);

    // Display enabled features
    let mut features = Vec::new();
    if config.function_whitelist.is_some() {
        features.push("Function whitelisting");
    }
    if config.contract_whitelist.is_some() {
        features.push("Contract whitelisting");
    }
    if config.recipient_whitelist.is_some() {
        features.push("Recipient whitelisting");
    }
    if config.amount_cap.is_some() {
        features.push("Amount caps");
    }
    if config.rate_limiting.is_some() {
        features.push("Rate limiting");
    }

    if !features.is_empty() {
        println!();
        println!("{}", style("🔒 Enabled Features:").bold());
        for feature in features {
            println!("   • {}", feature);
        }
    }

    println!();
    println!("{}", style("📚 Next Steps:").bold());
    println!("   1. cd {}/contracts", output_dir);
    println!("   2. make build");
    println!("   3. make test");
    println!("   4. make deploy-testnet");
    println!();
    println!("{}", style("📖 Documentation:").bold());
    println!("   See {}/README.md for complete usage instructions", output_dir);

    Ok(())
}
