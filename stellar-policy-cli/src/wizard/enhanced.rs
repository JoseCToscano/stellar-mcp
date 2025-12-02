//! Enhanced interactive wizard with colors, navigation, and better UX

use crate::types::{AmountCapConfig, PolicyConfig, RateLimitConfig};
use crate::wizard::{analyzer, questions};
use console::{style, Emoji, Term};
use dialoguer::{theme::ColorfulTheme, Confirm, Input, Select};
use std::fmt;

// Emojis for visual enhancement
static ROCKET: Emoji = Emoji("🚀", ">");
static SPARKLES: Emoji = Emoji("✨", "*");
static CLIPBOARD: Emoji = Emoji("📋", "[]");
static GEAR: Emoji = Emoji("⚙️ ", "[*]");
static CHECK_MARK: Emoji = Emoji("✅", "[OK]");
static INFO: Emoji = Emoji("ℹ️ ", "i");

/// Steps in the wizard
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WizardStep {
    Welcome,
    PolicyName,
    Description,
    FunctionWhitelist,
    ContractWhitelist,
    RecipientWhitelist,
    AmountCap,
    RateLimiting,
    Analysis,
    AdminDecision,
    Complete,
}

impl WizardStep {
    fn number(&self) -> usize {
        match self {
            WizardStep::Welcome => 0,
            WizardStep::PolicyName => 1,
            WizardStep::Description => 2,
            WizardStep::FunctionWhitelist => 3,
            WizardStep::ContractWhitelist => 4,
            WizardStep::RecipientWhitelist => 5,
            WizardStep::AmountCap => 6,
            WizardStep::RateLimiting => 7,
            WizardStep::Analysis => 8,
            WizardStep::AdminDecision => 9,
            WizardStep::Complete => 10,
        }
    }

    fn title(&self) -> &str {
        match self {
            WizardStep::Welcome => "Welcome",
            WizardStep::PolicyName => "Policy Name",
            WizardStep::Description => "Description",
            WizardStep::FunctionWhitelist => "Function Whitelist",
            WizardStep::ContractWhitelist => "Contract Whitelist",
            WizardStep::RecipientWhitelist => "Recipient Whitelist",
            WizardStep::AmountCap => "Amount Cap",
            WizardStep::RateLimiting => "Rate Limiting",
            WizardStep::Analysis => "Policy Analysis",
            WizardStep::AdminDecision => "Admin Management",
            WizardStep::Complete => "Complete",
        }
    }

    fn next(&self) -> Option<WizardStep> {
        match self {
            WizardStep::Welcome => Some(WizardStep::PolicyName),
            WizardStep::PolicyName => Some(WizardStep::Description),
            WizardStep::Description => Some(WizardStep::FunctionWhitelist),
            WizardStep::FunctionWhitelist => Some(WizardStep::ContractWhitelist),
            WizardStep::ContractWhitelist => Some(WizardStep::RecipientWhitelist),
            WizardStep::RecipientWhitelist => Some(WizardStep::AmountCap),
            WizardStep::AmountCap => Some(WizardStep::RateLimiting),
            WizardStep::RateLimiting => Some(WizardStep::Analysis),
            WizardStep::Analysis => Some(WizardStep::AdminDecision),
            WizardStep::AdminDecision => Some(WizardStep::Complete),
            WizardStep::Complete => None,
        }
    }

    fn previous(&self) -> Option<WizardStep> {
        match self {
            WizardStep::Welcome => None,
            WizardStep::PolicyName => Some(WizardStep::Welcome),
            WizardStep::Description => Some(WizardStep::PolicyName),
            WizardStep::FunctionWhitelist => Some(WizardStep::Description),
            WizardStep::ContractWhitelist => Some(WizardStep::FunctionWhitelist),
            WizardStep::RecipientWhitelist => Some(WizardStep::ContractWhitelist),
            WizardStep::AmountCap => Some(WizardStep::RecipientWhitelist),
            WizardStep::RateLimiting => Some(WizardStep::AmountCap),
            WizardStep::Analysis => Some(WizardStep::RateLimiting),
            WizardStep::AdminDecision => Some(WizardStep::Analysis),
            WizardStep::Complete => Some(WizardStep::AdminDecision),
        }
    }
}

impl fmt::Display for WizardStep {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.title())
    }
}

/// Wizard state - stores all collected data
#[derive(Debug, Clone, Default)]
struct WizardState {
    name: Option<String>,
    description: Option<String>,
    function_whitelist: Option<Vec<String>>,
    contract_whitelist: Option<Vec<String>>,
    recipient_whitelist: Option<Vec<String>>,
    amount_cap: Option<AmountCapConfig>,
    rate_limiting: Option<RateLimitConfig>,
    admin_managed: bool,
}

impl WizardState {
    fn to_config(&self) -> PolicyConfig {
        PolicyConfig {
            name: self.name.clone().unwrap_or_default(),
            description: self.description.clone(),
            function_whitelist: self.function_whitelist.clone(),
            contract_whitelist: self.contract_whitelist.clone(),
            recipient_whitelist: self.recipient_whitelist.clone(),
            amount_cap: self.amount_cap.clone(),
            rate_limiting: self.rate_limiting.clone(),
            admin_managed: self.admin_managed,
        }
    }
}

/// Enhanced wizard runner
pub struct EnhancedWizard {
    state: WizardState,
    current_step: WizardStep,
    term: Term,
    theme: ColorfulTheme,
}

impl EnhancedWizard {
    pub fn new() -> Self {
        Self {
            state: WizardState::default(),
            current_step: WizardStep::Welcome,
            term: Term::stdout(),
            theme: ColorfulTheme::default(),
        }
    }

    /// Run the wizard and return the final configuration
    pub async fn run(mut self) -> Result<PolicyConfig, Box<dyn std::error::Error>> {
        loop {
            self.clear_screen()?;
            self.display_header()?;

            match self.current_step {
                WizardStep::Welcome => {
                    if !self.step_welcome()? {
                        return Err("User cancelled wizard".into());
                    }
                }
                WizardStep::PolicyName => {
                    if !self.step_policy_name()? {
                        self.go_back();
                        continue;
                    }
                }
                WizardStep::Description => {
                    if !self.step_description()? {
                        self.go_back();
                        continue;
                    }
                }
                WizardStep::FunctionWhitelist => {
                    if !self.step_function_whitelist()? {
                        self.go_back();
                        continue;
                    }
                }
                WizardStep::ContractWhitelist => {
                    if !self.step_contract_whitelist()? {
                        self.go_back();
                        continue;
                    }
                }
                WizardStep::RecipientWhitelist => {
                    if !self.step_recipient_whitelist()? {
                        self.go_back();
                        continue;
                    }
                }
                WizardStep::AmountCap => {
                    if !self.step_amount_cap()? {
                        self.go_back();
                        continue;
                    }
                }
                WizardStep::RateLimiting => {
                    if !self.step_rate_limiting()? {
                        self.go_back();
                        continue;
                    }
                }
                WizardStep::Analysis => {
                    if !self.step_analysis()? {
                        self.go_back();
                        continue;
                    }
                }
                WizardStep::AdminDecision => {
                    if !self.step_admin_decision()? {
                        self.go_back();
                        continue;
                    }
                }
                WizardStep::Complete => {
                    self.display_completion()?;
                    return Ok(self.state.to_config());
                }
            }

            // Move to next step if not at the end
            if let Some(next) = self.current_step.next() {
                self.current_step = next;
            } else {
                break;
            }
        }

        Ok(self.state.to_config())
    }

    fn clear_screen(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.term.clear_screen()?;
        Ok(())
    }

    fn display_header(&self) -> Result<(), Box<dyn std::error::Error>> {
        println!("{}", style("═".repeat(80)).cyan());
        println!(
            "{} {}",
            ROCKET,
            style("Stellar Policy Generator").bold().bright().cyan()
        );

        // Progress indicator
        let total_steps = 9; // Excluding Welcome and Complete
        if self.current_step.number() > 0 && self.current_step.number() < 10 {
            let current = self.current_step.number();
            let progress = "█".repeat(current) + &"░".repeat(total_steps - current);
            println!(
                "{} Step {}/{}: {}",
                INFO,
                style(current).bold().green(),
                style(total_steps).bold(),
                style(self.current_step.title()).bold().yellow()
            );
            println!("   {}", style(progress).cyan());
        }

        println!("{}", style("═".repeat(80)).cyan());
        println!();
        Ok(())
    }

    fn go_back(&mut self) {
        if let Some(prev) = self.current_step.previous() {
            self.current_step = prev;
        }
    }

    fn step_welcome(&self) -> Result<bool, Box<dyn std::error::Error>> {
        println!("{}", style("Welcome to the Stellar Policy Generator!").bold().green());
        println!();
        println!("This wizard will guide you through creating a custom policy smart contract");
        println!("for your Stellar smart wallet. {} Let's get started!", SPARKLES);
        println!();
        println!("{} {}", INFO, style("What you'll configure:").bold());
        println!("  • Policy name and description");
        println!("  • Authorization rules (whitelists, caps, rate limits)");
        println!("  • Admin management options");
        println!();
        println!("{}", style("Tip: You can go back to any previous step if you make a mistake!").italic().dim());
        println!();

        Ok(Confirm::with_theme(&self.theme)
            .with_prompt("Ready to begin?")
            .default(true)
            .interact()?)
    }

    fn step_policy_name(&mut self) -> Result<bool, Box<dyn std::error::Error>> {
        self.display_section_header("Policy Name", "Choose a unique name for your policy contract");

        println!("{} {}", INFO, style("Requirements:").dim());
        println!("  • Lowercase letters only");
        println!("  • Hyphens allowed");
        println!("  • Example: my-transfer-policy");
        println!();

        let name: String = Input::with_theme(&self.theme)
            .with_prompt("Policy name")
            .validate_with(|input: &String| -> Result<(), String> {
                questions::validate_policy_name(input)
            })
            .interact_text()?;

        self.state.name = Some(name);

        self.prompt_continue_or_back()
    }

    fn step_description(&mut self) -> Result<bool, Box<dyn std::error::Error>> {
        self.display_section_header("Description", "Add an optional description for your policy");

        let has_description = Confirm::with_theme(&self.theme)
            .with_prompt("Add a description?")
            .default(false)
            .interact()?;

        if has_description {
            let desc: String = Input::with_theme(&self.theme)
                .with_prompt("Description")
                .allow_empty(false)
                .interact_text()?;
            self.state.description = Some(desc);
        } else {
            self.state.description = None;
        }

        self.prompt_continue_or_back()
    }

    fn step_function_whitelist(&mut self) -> Result<bool, Box<dyn std::error::Error>> {
        self.display_section_header(
            "Function Whitelist",
            "Restrict which contract functions can be called"
        );

        println!("{} {}", INFO, style("What this does:").dim());
        println!("  • Only allow specific functions like 'transfer', 'swap'");
        println!("  • Block all other function calls");
        println!("  • Useful for limiting wallet capabilities");
        println!();

        let enable = Confirm::with_theme(&self.theme)
            .with_prompt("Enable function whitelisting?")
            .default(false)
            .interact()?;

        if enable {
            println!();
            let input: String = Input::with_theme(&self.theme)
                .with_prompt("Function names (comma-separated)")
                .validate_with(|input: &String| -> Result<(), String> {
                    let functions: Vec<&str> = input.split(',').map(|s| s.trim()).collect();
                    for func in functions {
                        questions::validate_function_name(func)?;
                    }
                    Ok(())
                })
                .interact_text()?;

            let functions: Vec<String> = input
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();

            self.state.function_whitelist = Some(functions);
        } else {
            self.state.function_whitelist = None;
        }

        self.prompt_continue_or_back()
    }

    fn step_contract_whitelist(&mut self) -> Result<bool, Box<dyn std::error::Error>> {
        self.display_section_header(
            "Contract Whitelist",
            "Restrict which contracts can be interacted with"
        );

        println!("{} {}", INFO, style("What this does:").dim());
        println!("  • Only allow interactions with specific contract addresses");
        println!("  • Block calls to unknown/untrusted contracts");
        println!("  • Enhances security by limiting contract exposure");
        println!();

        let enable = Confirm::with_theme(&self.theme)
            .with_prompt("Enable contract whitelisting?")
            .default(false)
            .interact()?;

        if enable {
            println!();
            println!("{} Contract addresses must:", INFO);
            println!("  • Be 56 characters long");
            println!("  • Start with 'C'");
            println!();

            let input: String = Input::with_theme(&self.theme)
                .with_prompt("Contract addresses (comma-separated)")
                .validate_with(|input: &String| -> Result<(), String> {
                    let addresses: Vec<&str> = input.split(',').map(|s| s.trim()).collect();
                    for addr in addresses {
                        questions::validate_contract_address(addr)?;
                    }
                    Ok(())
                })
                .interact_text()?;

            let addresses: Vec<String> = input
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();

            self.state.contract_whitelist = Some(addresses);
        } else {
            self.state.contract_whitelist = None;
        }

        self.prompt_continue_or_back()
    }

    fn step_recipient_whitelist(&mut self) -> Result<bool, Box<dyn std::error::Error>> {
        self.display_section_header(
            "Recipient Whitelist",
            "Restrict destination addresses for transfers"
        );

        println!("{} {}", INFO, style("What this does:").dim());
        println!("  • Only allow transfers to approved addresses");
        println!("  • Prevent sending funds to unknown recipients");
        println!("  • Useful for business/treasury wallets");
        println!();

        let enable = Confirm::with_theme(&self.theme)
            .with_prompt("Enable recipient whitelisting?")
            .default(false)
            .interact()?;

        if enable {
            println!();
            println!("{} Account addresses must:", INFO);
            println!("  • Be 56 characters long");
            println!("  • Start with 'G'");
            println!();

            let input: String = Input::with_theme(&self.theme)
                .with_prompt("Recipient addresses (comma-separated)")
                .validate_with(|input: &String| -> Result<(), String> {
                    let addresses: Vec<&str> = input.split(',').map(|s| s.trim()).collect();
                    for addr in addresses {
                        questions::validate_account_address(addr)?;
                    }
                    Ok(())
                })
                .interact_text()?;

            let addresses: Vec<String> = input
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();

            self.state.recipient_whitelist = Some(addresses);
        } else {
            self.state.recipient_whitelist = None;
        }

        self.prompt_continue_or_back()
    }

    fn step_amount_cap(&mut self) -> Result<bool, Box<dyn std::error::Error>> {
        self.display_section_header(
            "Amount Cap",
            "Set maximum transaction amounts"
        );

        println!("{} {}", INFO, style("What this does:").dim());
        println!("  • Block transactions exceeding a maximum amount");
        println!("  • Can be configured per-wallet by admin");
        println!("  • Requires admin management");
        println!();

        let enable = Confirm::with_theme(&self.theme)
            .with_prompt("Enable amount cap?")
            .default(false)
            .interact()?;

        if enable {
            println!();
            let amount: String = Input::with_theme(&self.theme)
                .with_prompt("Maximum amount (in stroops, 1 XLM = 10,000,000 stroops)")
                .validate_with(|input: &String| -> Result<(), String> {
                    questions::validate_amount(input)
                })
                .interact_text()?;

            self.state.amount_cap = Some(AmountCapConfig {
                max_amount: amount.parse().unwrap(),
                token_contract: None,
            });
        } else {
            self.state.amount_cap = None;
        }

        self.prompt_continue_or_back()
    }

    fn step_rate_limiting(&mut self) -> Result<bool, Box<dyn std::error::Error>> {
        self.display_section_header(
            "Rate Limiting",
            "Control transaction frequency"
        );

        println!("{} {}", INFO, style("What this does:").dim());
        println!("  • Enforce minimum time between transactions");
        println!("  • Can be configured per-wallet by admin");
        println!("  • Requires admin management");
        println!("  • Measured in ledgers (~5 seconds per ledger)");
        println!();

        let enable = Confirm::with_theme(&self.theme)
            .with_prompt("Enable rate limiting?")
            .default(false)
            .interact()?;

        if enable {
            println!();
            let ledgers: String = Input::with_theme(&self.theme)
                .with_prompt("Minimum ledgers between transactions")
                .validate_with(|input: &String| -> Result<(), String> {
                    questions::validate_ledgers(input)
                })
                .interact_text()?;

            self.state.rate_limiting = Some(RateLimitConfig {
                min_ledgers: ledgers.parse().unwrap(),
            });
        } else {
            self.state.rate_limiting = None;
        }

        self.prompt_continue_or_back()
    }

    fn step_analysis(&self) -> Result<bool, Box<dyn std::error::Error>> {
        self.display_section_header(
            "Policy Analysis",
            "Review your policy configuration"
        );

        let config = self.state.to_config();
        let analysis = analyzer::analyze_policy(&config);

        println!();
        analyzer::display_analysis(&config, &analysis);
        println!();

        self.prompt_continue_or_back()
    }

    fn step_admin_decision(&mut self) -> Result<bool, Box<dyn std::error::Error>> {
        self.display_section_header(
            "Admin Management",
            "Configure administrative capabilities"
        );

        let config = self.state.to_config();
        let analysis = analyzer::analyze_policy(&config);

        println!("{} {}", INFO, style("What admin management enables:").dim());
        println!("  • Dynamic wallet configuration (add_wallet, remove_wallet)");
        println!("  • Per-wallet settings for caps and rate limits");
        println!("  • Runtime policy updates by admin address");
        println!();

        if analysis.is_stateful {
            println!("{} {}", GEAR, style("Recommendation:").yellow().bold());
            println!("  Your policy uses stateful features (amount caps or rate limiting).");
            println!("  Admin management is REQUIRED for these features to work.");
            println!();
        }

        let admin_managed = Confirm::with_theme(&self.theme)
            .with_prompt("Enable admin management?")
            .default(analysis.is_stateful)
            .interact()?;

        self.state.admin_managed = admin_managed;

        self.prompt_continue_or_back()
    }

    fn display_completion(&self) -> Result<(), Box<dyn std::error::Error>> {
        println!();
        println!("{} {}", CHECK_MARK, style("Policy Configuration Complete!").bold().green());
        println!();
        println!("{}", style("Your policy will be generated with:").bold());

        let config = self.state.to_config();

        println!("  {} Name: {}", SPARKLES, style(&config.name).cyan());
        if let Some(desc) = &config.description {
            println!("  {} Description: {}", CLIPBOARD, style(desc).dim());
        }
        if config.function_whitelist.is_some() {
            println!("  {} Function whitelist: enabled", CHECK_MARK);
        }
        if config.contract_whitelist.is_some() {
            println!("  {} Contract whitelist: enabled", CHECK_MARK);
        }
        if config.recipient_whitelist.is_some() {
            println!("  {} Recipient whitelist: enabled", CHECK_MARK);
        }
        if config.amount_cap.is_some() {
            println!("  {} Amount cap: enabled", CHECK_MARK);
        }
        if config.rate_limiting.is_some() {
            println!("  {} Rate limiting: enabled", CHECK_MARK);
        }
        if config.admin_managed {
            println!("  {} Admin management: enabled", GEAR);
        }

        println!();
        Ok(())
    }

    fn display_section_header(&self, title: &str, subtitle: &str) {
        println!("{}", style(format!("┌─ {} ─", title)).bold().cyan());
        println!("{}", style(format!("│  {}", subtitle)).dim());
        println!("{}", style("└─").cyan());
        println!();
    }

    fn prompt_continue_or_back(&self) -> Result<bool, Box<dyn std::error::Error>> {
        if self.current_step.previous().is_none() {
            // Can't go back from first step
            return Ok(true);
        }

        println!();
        let choices = vec!["Continue", "Go back"];
        let selection = Select::with_theme(&self.theme)
            .with_prompt("What would you like to do?")
            .items(&choices)
            .default(0)
            .interact()?;

        Ok(selection == 0) // true if Continue, false if Go back
    }
}
