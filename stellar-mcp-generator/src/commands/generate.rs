//! Generate command - creates MCP server from contract spec

use crate::generator::McpGenerator;
use crate::spec::SpecFetcher;
use crate::NetworkConfig;
use clap::Parser;
use std::path::PathBuf;

/// Arguments for the generate command
#[derive(Parser, Debug)]
pub struct GenerateArgs {
    /// Contract ID to generate MCP server for
    #[arg(long, short = 'c', value_name = "CONTRACT_ID")]
    pub contract_id: String,

    /// Network to use (testnet, mainnet, futurenet, local)
    #[arg(long, short = 'n', default_value = "testnet")]
    pub network: String,

    /// Custom RPC URL (overrides network default)
    #[arg(long)]
    pub rpc_url: Option<String>,

    /// Network passphrase (required if using custom RPC URL)
    #[arg(long)]
    pub network_passphrase: Option<String>,

    /// Output directory for generated MCP server
    #[arg(long, short = 'o', default_value = "./mcp-server")]
    pub output: PathBuf,

    /// Contract name (used for tool naming, defaults to contract ID prefix)
    #[arg(long)]
    pub name: Option<String>,

    /// Server name for the MCP server
    #[arg(long, default_value = "soroban-contract")]
    pub server_name: String,

    /// Overwrite existing output directory
    #[arg(long)]
    pub force: bool,

    /// Enable verbose output for debugging
    #[arg(long, short = 'v')]
    pub verbose: bool,
}

/// Execute the generate command
pub async fn execute(args: GenerateArgs) -> Result<(), Box<dyn std::error::Error>> {
    println!("Stellar MCP Generator v{}", env!("CARGO_PKG_VERSION"));
    println!("========================================");

    // Validate contract ID format
    if !args.contract_id.starts_with('C') || args.contract_id.len() != 56 {
        return Err(format!(
            "Invalid contract ID '{}'. Contract IDs must start with 'C' and be 56 characters long.",
            args.contract_id
        )
        .into());
    }

    // Resolve network configuration
    let network = if let Some(rpc_url) = &args.rpc_url {
        let passphrase = args.network_passphrase.clone().ok_or(
            "Network passphrase is required when using custom RPC URL. Use --network-passphrase",
        )?;
        NetworkConfig::custom(rpc_url.clone(), passphrase)
    } else {
        NetworkConfig::from_name(&args.network)?
    };

    println!("Network: {} ({})", network.name, network.rpc_url);
    println!("Contract ID: {}", args.contract_id);
    println!("Output: {}", args.output.display());
    println!();

    // Check output directory
    if args.output.exists() && !args.force {
        return Err(format!(
            "Output directory '{}' already exists. Use --force to overwrite.",
            args.output.display()
        )
        .into());
    }

    // Create output directory
    std::fs::create_dir_all(&args.output)?;

    // Step 1: Fetch contract specification
    println!("Fetching contract specification...");
    let fetcher = SpecFetcher::with_verbose(&network.rpc_url, args.verbose)?;
    let spec = fetcher.fetch_spec(&args.contract_id).await?;

    println!(
        "  Found {} functions, {} types",
        spec.functions.len(),
        spec.types.len()
    );

    // Step 2: Generate MCP server
    println!("Generating MCP server...");

    // Priority for contract name:
    // 1. --name CLI argument
    // 2. Contract metadata "name" key
    // 3. First 8 chars of contract ID (fallback)
    let contract_name = args.name.clone().or_else(|| {
        spec.name.clone().map(|n| {
            // Convert to kebab-case for file naming
            n.chars()
                .map(|c| if c.is_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
                .collect::<String>()
                .trim_matches('-')
                .to_string()
        })
    }).unwrap_or_else(|| args.contract_id[..8].to_lowercase());

    if let Some(ref meta_name) = spec.name {
        println!("  Contract name from metadata: {}", meta_name);
    }

    let generator = McpGenerator::new(
        &args.output,
        &contract_name,
        &args.server_name,
        &args.contract_id,
        &network,
    );

    generator.generate(&spec, &args)?;

    println!();
    println!("MCP server generated successfully!");
    println!();
    println!("Next steps:");
    println!("  1. cd {}", args.output.display());
    println!("  2. pnpm install");
    println!("  3. cp .env.example .env && edit .env");
    println!("  4. pnpm run build");
    println!("  5. pnpm start");
    println!();
    println!("To use with Claude Desktop, add to claude_desktop_config.json:");
    println!("  See {}/README.md for configuration", args.output.display());

    Ok(())
}
