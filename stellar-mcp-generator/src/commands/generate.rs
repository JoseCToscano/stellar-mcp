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
    pub contract_id: Option<String>,

    /// Network to use (testnet, mainnet, futurenet, local)
    #[arg(long, short = 'n')]
    pub network: Option<String>,

    /// Custom RPC URL (overrides network default)
    #[arg(long)]
    pub rpc_url: Option<String>,

    /// Network passphrase (required if using custom RPC URL)
    #[arg(long)]
    pub network_passphrase: Option<String>,

    /// Output directory for generated MCP server
    #[arg(long, short = 'o')]
    pub output: Option<PathBuf>,

    /// Contract name (used for tool naming, defaults to contract ID prefix)
    #[arg(long)]
    pub name: Option<String>,

    /// Server name for the MCP server
    #[arg(long)]
    pub server_name: Option<String>,

    /// Language to generate (typescript or python)
    #[arg(long, short = 'l')]
    pub lang: Option<String>,

    /// Overwrite existing output directory
    #[arg(long)]
    pub force: bool,

    /// Enable verbose output for debugging
    #[arg(long, short = 'v')]
    pub verbose: bool,
}

/// Execute the generate command
pub async fn execute(args: GenerateArgs) -> Result<(), Box<dyn std::error::Error>> {
    // Check if user provided ANY flags → Expert mode
    // If NO flags provided → Wizard mode
    let use_wizard = args.contract_id.is_none()
        && args.network.is_none()
        && args.output.is_none()
        && args.lang.is_none()
        && args.name.is_none()
        && args.server_name.is_none()
        && args.rpc_url.is_none()
        && args.network_passphrase.is_none();

    // Get configuration from wizard or flags
    let (contract_id, network_str, output, lang, name, server_name, rpc_url, network_passphrase) = if use_wizard {
        // Run wizard to get all configuration
        let wizard_config = crate::wizard::run_wizard().await?;

        (
            wizard_config.contract_id,
            wizard_config.network,
            wizard_config.output,
            wizard_config.lang,
            wizard_config.name,
            wizard_config.server_name,
            wizard_config.rpc_url,
            wizard_config.network_passphrase,
        )
    } else {
        // Expert mode: use provided flags with defaults
        let contract_id = args.contract_id.clone().ok_or(
            "Contract ID is required. Use --contract-id or run without flags for wizard mode."
        )?;
        let network_str = args.network.clone().unwrap_or_else(|| "testnet".to_string());
        let output = args.output.clone().unwrap_or_else(|| PathBuf::from("./mcp-server"));
        let lang = args.lang.clone().unwrap_or_else(|| "typescript".to_string());
        let server_name = args.server_name.clone().unwrap_or_else(|| "soroban-contract".to_string());

        (
            contract_id,
            network_str,
            output,
            lang,
            args.name.clone(),
            server_name,
            args.rpc_url.clone(),
            args.network_passphrase.clone(),
        )
    };

    // Validate language
    if lang != "typescript" && lang != "python" {
        return Err(format!(
            "Invalid language '{}'. Supported languages: typescript, python",
            lang
        )
        .into());
    }

    println!("Stellar MCP Generator v{}", env!("CARGO_PKG_VERSION"));
    println!("========================================");

    // Validate contract ID format
    if !contract_id.starts_with('C') || contract_id.len() != 56 {
        return Err(format!(
            "Invalid contract ID '{}'. Contract IDs must start with 'C' and be 56 characters long.",
            contract_id
        )
        .into());
    }

    // Resolve network configuration
    let network = if let Some(rpc) = &rpc_url {
        let passphrase = network_passphrase.clone().ok_or(
            "Network passphrase is required when using custom RPC URL. Use --network-passphrase",
        )?;
        NetworkConfig::custom(rpc.clone(), passphrase)
    } else {
        NetworkConfig::from_name(&network_str)?
    };

    println!("Network: {} ({})", network.name, network.rpc_url);
    println!("Contract ID: {}", contract_id);
    println!("Language: {}", lang);
    println!("Output: {}", output.display());
    println!();

    // Check output directory
    if output.exists() && !args.force {
        return Err(format!(
            "Output directory '{}' already exists. Use --force to overwrite.",
            output.display()
        )
        .into());
    }

    // Create output directory
    std::fs::create_dir_all(&output)?;

    // Step 1: Fetch contract specification
    println!("Fetching contract specification...");
    let fetcher = SpecFetcher::with_verbose(&network.rpc_url, args.verbose)?;
    let spec = fetcher.fetch_spec(&contract_id).await?;

    println!(
        "  Found {} functions, {} types",
        spec.functions.len(),
        spec.types.len()
    );

    // Step 2: Generate MCP server
    println!("Generating MCP server...");

    // Priority for contract name:
    // 1. --name CLI argument / wizard input
    // 2. Contract metadata "name" key
    // 3. First 8 chars of contract ID (fallback)
    let contract_name = name.clone().or_else(|| {
        spec.name.clone().map(|n| {
            // Convert to kebab-case for file naming
            n.chars()
                .map(|c| if c.is_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
                .collect::<String>()
                .trim_matches('-')
                .to_string()
        })
    }).unwrap_or_else(|| contract_id[..8].to_lowercase());

    if let Some(ref meta_name) = spec.name {
        println!("  Contract name from metadata: {}", meta_name);
    }

    // Route to appropriate generator based on language
    if lang == "typescript" {
        let generator = McpGenerator::new(
            &output,
            &contract_name,
            &server_name,
            &contract_id,
            &network,
        );

        generator.generate(&spec, &args)?;

        println!();
        println!("MCP server generated successfully!");
        println!();
        println!("Next steps:");
        println!("  1. cd {}", output.display());
        println!("  2. pnpm install");
        println!("  3. cp .env.example .env && edit .env");
        println!("  4. pnpm run build");
        println!("  5. pnpm start");
        println!();
        println!("To use with Claude Desktop, add to claude_desktop_config.json:");
        println!("  See {}/README.md for configuration", output.display());
    } else {
        // Python generation - to be implemented in next tasks
        return Err("Python generation is not yet implemented. Coming soon!".into());
    }

    Ok(())
}
