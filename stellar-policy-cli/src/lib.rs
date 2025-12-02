//! Stellar Policy CLI
//!
//! A Stellar CLI plugin that generates policy smart contracts for smart wallets
//! through an interactive wizard.

use clap::{Parser, Subcommand};

pub mod commands;
pub mod generator;
pub mod types;
pub mod wizard;

pub use commands::generate::GenerateArgs;
pub use types::PolicyConfig;

/// Stellar Policy CLI - Generate policy smart contracts for smart wallets
#[derive(Parser)]
#[command(
    name = "stellar-policy",
    author = "Stellar Policy Team",
    version,
    about = "Generate policy smart contracts for Stellar smart wallets",
    long_about = "A Stellar CLI plugin that generates production-ready policy smart contracts \
                  for smart wallets through an interactive wizard. Supports function whitelisting, \
                  contract whitelisting, amount caps, rate limiting, and recipient whitelisting."
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Generate a policy smart contract via interactive wizard
    Generate(GenerateArgs),
}

/// Run the CLI with the parsed arguments
pub async fn run(cli: Cli) -> Result<(), Box<dyn std::error::Error>> {
    match cli.command {
        Commands::Generate(args) => {
            commands::generate::execute(args).await?;
        }
    }
    Ok(())
}
