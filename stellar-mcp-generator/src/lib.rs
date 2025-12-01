//! Stellar MCP Generator
//!
//! A Stellar CLI plugin that generates MCP (Model Context Protocol) servers
//! from Soroban smart contract specifications.

use clap::{Parser, Subcommand};

pub mod commands;
pub mod generator;
pub mod spec;
pub mod wizard;

pub use commands::generate::GenerateArgs;
pub use commands::validate::ValidateArgs;

/// Stellar MCP Generator - Generate MCP servers from Soroban contracts
#[derive(Parser)]
#[command(
    name = "stellar-mcp",
    author = "Stellar MCP Team",
    version,
    about = "Generate MCP servers from Soroban smart contract specifications",
    long_about = "A Stellar CLI plugin that reads contract specifications from deployed \
                  Soroban contracts and generates TypeScript MCP servers that enable \
                  AI agents to interact with the contracts through standardized tools."
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Generate an MCP server from a deployed Soroban contract
    Generate(GenerateArgs),

    /// Validate a generated MCP server
    Validate(ValidateArgs),
}

/// Run the CLI with the parsed arguments
pub async fn run(cli: Cli) -> Result<(), Box<dyn std::error::Error>> {
    match cli.command {
        Commands::Generate(args) => {
            commands::generate::execute(args).await?;
        }
        Commands::Validate(args) => {
            commands::validate::execute(args).await?;
        }
    }
    Ok(())
}

/// Network configuration
#[derive(Debug, Clone)]
pub struct NetworkConfig {
    pub name: String,
    pub rpc_url: String,
    pub network_passphrase: String,
}

impl NetworkConfig {
    /// Get network configuration from network name
    pub fn from_name(name: &str) -> Result<Self, String> {
        match name.to_lowercase().as_str() {
            "testnet" => Ok(Self {
                name: "testnet".to_string(),
                rpc_url: "https://soroban-testnet.stellar.org".to_string(),
                network_passphrase: "Test SDF Network ; September 2015".to_string(),
            }),
            "mainnet" | "pubnet" => Ok(Self {
                name: "mainnet".to_string(),
                rpc_url: "https://soroban.stellar.org".to_string(),
                network_passphrase: "Public Global Stellar Network ; September 2015".to_string(),
            }),
            "futurenet" => Ok(Self {
                name: "futurenet".to_string(),
                rpc_url: "https://rpc-futurenet.stellar.org".to_string(),
                network_passphrase: "Test SDF Future Network ; October 2022".to_string(),
            }),
            "local" | "standalone" => Ok(Self {
                name: "local".to_string(),
                rpc_url: "http://localhost:8000/soroban/rpc".to_string(),
                network_passphrase: "Standalone Network ; February 2017".to_string(),
            }),
            _ => Err(format!(
                "Unknown network '{}'. Use testnet, mainnet, futurenet, local, or provide --rpc-url",
                name
            )),
        }
    }

    /// Create custom network configuration
    pub fn custom(rpc_url: String, network_passphrase: String) -> Self {
        Self {
            name: "custom".to_string(),
            rpc_url,
            network_passphrase,
        }
    }
}
