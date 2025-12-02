//! Interactive wizard for MCP server generation

use console::{style, Emoji, Term};
use dialoguer::{theme::ColorfulTheme, Input, Select};
use std::path::PathBuf;

// Emojis for visual enhancement
static ROCKET: Emoji = Emoji("🚀", ">");
static SPARKLES: Emoji = Emoji("✨", "*");
static GEAR: Emoji = Emoji("⚙️ ", "[*]");
static CHECK_MARK: Emoji = Emoji("✅", "[OK]");

/// Configuration collected from wizard
#[derive(Debug, Clone)]
pub struct GeneratorConfig {
    pub contract_id: String,
    pub network: String,
    pub rpc_url: Option<String>,
    pub network_passphrase: Option<String>,
    pub output: PathBuf,
    pub name: Option<String>,
    pub server_name: String,
    pub lang: String,
}

/// Run the interactive wizard to collect generation configuration
pub async fn run_wizard() -> Result<GeneratorConfig, Box<dyn std::error::Error>> {
    let term = Term::stdout();
    let theme = ColorfulTheme::default();

    // Clear screen and show welcome
    term.clear_screen()?;
    println!();
    println!("{} {}", ROCKET, style("Stellar MCP Generator Wizard").cyan().bold());
    println!();
    println!("This wizard will guide you through generating an MCP server from a Soroban contract.");
    println!();

    // Step 1: Contract ID
    println!("{} {}", GEAR, style("Step 1: Contract ID").cyan().bold());
    println!();
    let contract_id: String = Input::with_theme(&theme)
        .with_prompt("Enter the contract ID (starts with 'C', 56 characters)")
        .validate_with(|input: &String| -> Result<(), &str> {
            if input.starts_with('C') && input.len() == 56 {
                Ok(())
            } else {
                Err("Contract ID must start with 'C' and be 56 characters long")
            }
        })
        .interact_text()?;
    println!();

    // Step 2: Network
    println!("{} {}", GEAR, style("Step 2: Network").cyan().bold());
    println!();
    let networks = vec!["testnet", "mainnet", "futurenet", "local", "custom"];
    let network_idx = Select::with_theme(&theme)
        .with_prompt("Select the network")
        .items(&networks)
        .default(0)
        .interact()?;

    let network = networks[network_idx].to_string();

    // Handle custom network
    let (rpc_url, network_passphrase) = if network == "custom" {
        println!();
        let rpc: String = Input::with_theme(&theme)
            .with_prompt("Enter custom RPC URL")
            .interact_text()?;

        let passphrase: String = Input::with_theme(&theme)
            .with_prompt("Enter network passphrase")
            .interact_text()?;

        (Some(rpc), Some(passphrase))
    } else {
        (None, None)
    };
    println!();

    // Step 3: Language
    println!("{} {}", GEAR, style("Step 3: Language").cyan().bold());
    println!();
    let languages = vec!["typescript", "python"];
    let lang_idx = Select::with_theme(&theme)
        .with_prompt("Select the target language")
        .items(&languages)
        .default(0)
        .interact()?;

    let lang = languages[lang_idx].to_string();
    println!();

    // Step 4: Output directory
    println!("{} {}", GEAR, style("Step 4: Output Directory").cyan().bold());
    println!();
    let output_str: String = Input::with_theme(&theme)
        .with_prompt("Enter output directory")
        .default("./mcp-server".to_string())
        .interact_text()?;

    let output = PathBuf::from(output_str);
    println!();

    // Step 5: Contract name (optional)
    println!("{} {}", GEAR, style("Step 5: Contract Name (Optional)").cyan().bold());
    println!();
    println!("{}", style("Leave empty to use contract metadata or contract ID prefix").dim());
    let name_input: String = Input::with_theme(&theme)
        .with_prompt("Enter contract name")
        .allow_empty(true)
        .interact_text()?;

    let name = if name_input.is_empty() {
        None
    } else {
        Some(name_input)
    };
    println!();

    // Step 6: Server name
    println!("{} {}", GEAR, style("Step 6: MCP Server Name").cyan().bold());
    println!();
    let server_name: String = Input::with_theme(&theme)
        .with_prompt("Enter MCP server name")
        .default("soroban-contract".to_string())
        .interact_text()?;
    println!();

    // Show summary
    println!("{} {}", CHECK_MARK, style("Configuration Summary").green().bold());
    println!();
    println!("  Contract ID: {}", style(&contract_id).yellow());
    println!("  Network: {}", style(&network).yellow());
    if let Some(ref rpc) = rpc_url {
        println!("  RPC URL: {}", style(rpc).yellow());
    }
    println!("  Language: {}", style(&lang).yellow());
    println!("  Output: {}", style(output.display()).yellow());
    if let Some(ref n) = name {
        println!("  Contract Name: {}", style(n).yellow());
    }
    println!("  Server Name: {}", style(&server_name).yellow());
    println!();

    println!("{} {}", SPARKLES, style("Starting generation...").green());
    println!();

    Ok(GeneratorConfig {
        contract_id,
        network,
        rpc_url,
        network_passphrase,
        output,
        name,
        server_name,
        lang,
    })
}
