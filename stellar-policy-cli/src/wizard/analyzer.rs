//! Policy analysis and recommendation engine

use crate::types::PolicyConfig;
use console::{style, Emoji};

/// Result of policy analysis
#[derive(Debug, Clone)]
pub struct PolicyAnalysis {
    /// Whether the policy requires persistent state
    pub is_stateful: bool,
    /// Recommendation text for admin functionality
    pub recommendation: String,
    /// Detailed reasoning for the recommendation
    pub reasoning: String,
}

/// Analyze policy configuration to determine statefulness and admin recommendation
pub fn analyze_policy(config: &PolicyConfig) -> PolicyAnalysis {
    let is_stateful = config.amount_cap.is_some() || config.rate_limiting.is_some();

    let (recommendation, reasoning) = if is_stateful {
        (
            "Admin functionality recommended".to_string(),
            generate_stateful_reasoning(config),
        )
    } else {
        (
            "Simple policy recommended (no admin overhead)".to_string(),
            generate_stateless_reasoning(config),
        )
    };

    PolicyAnalysis {
        is_stateful,
        recommendation,
        reasoning,
    }
}

/// Generate reasoning for stateful policy recommendation
fn generate_stateful_reasoning(config: &PolicyConfig) -> String {
    let mut reasons = vec![
        "Your policy requires persistent state storage because it includes:".to_string()
    ];

    if config.amount_cap.is_some() {
        reasons.push("  - Amount caps (requires tracking transaction amounts)".to_string());
    }

    if config.rate_limiting.is_some() {
        reasons.push("  - Rate limiting (requires tracking transaction timestamps)".to_string());
    }

    reasons.push("".to_string());
    reasons.push("Admin functionality allows you to:".to_string());
    reasons.push("  - Initialize the policy with admin address".to_string());
    reasons.push("  - Update policy rules at runtime".to_string());
    reasons.push("  - Add/remove authorized wallet addresses".to_string());
    reasons.push("  - Manage persistent storage effectively".to_string());

    reasons.join("\n")
}

/// Generate reasoning for stateless policy recommendation
fn generate_stateless_reasoning(config: &PolicyConfig) -> String {
    let mut reasons = vec![
        "Your policy is stateless (no persistent storage needed) because it only uses:".to_string()
    ];

    if config.function_whitelist.is_some() {
        reasons.push("  - Function whitelisting (hardcoded list)".to_string());
    }

    if config.contract_whitelist.is_some() {
        reasons.push("  - Contract whitelisting (hardcoded list)".to_string());
    }

    if config.recipient_whitelist.is_some() {
        reasons.push("  - Recipient whitelisting (hardcoded list)".to_string());
    }

    if config.function_whitelist.is_none()
        && config.contract_whitelist.is_none()
        && config.recipient_whitelist.is_none() {
        reasons.push("  - No restrictions (fully permissive)".to_string());
    }

    reasons.push("".to_string());
    reasons.push("A simple policy is more efficient because it:".to_string());
    reasons.push("  - Has lower deployment costs".to_string());
    reasons.push("  - Executes faster (no storage reads)".to_string());
    reasons.push("  - Is easier to audit and verify".to_string());

    reasons.join("\n")
}

/// Display policy analysis with colored output
pub fn display_analysis(config: &PolicyConfig, analysis: &PolicyAnalysis) {
    static CHECK: Emoji = Emoji("✅ ", "[x]");
    static CROSS: Emoji = Emoji("❌ ", "[ ]");
    static WARNING: Emoji = Emoji("⚠️  ", "[!]");

    println!("{}", style("Policy Features:").bold().cyan());
    println!();

    // Display enabled features
    if let Some(ref funcs) = config.function_whitelist {
        println!("{} Function whitelisting ({} functions)", CHECK, funcs.len());
    } else {
        println!("{} Function whitelisting", CROSS);
    }

    if let Some(ref contracts) = config.contract_whitelist {
        println!("{} Contract whitelisting ({} contracts)", CHECK, contracts.len());
    } else {
        println!("{} Contract whitelisting", CROSS);
    }

    if let Some(ref recipients) = config.recipient_whitelist {
        println!("{} Recipient whitelisting ({} addresses)", CHECK, recipients.len());
    } else {
        println!("{} Recipient whitelisting", CROSS);
    }

    if let Some(ref cap) = config.amount_cap {
        println!("{} {} Amount caps (max: {})",
            WARNING,
            style("STATEFUL:").yellow().bold(),
            cap.max_amount
        );
    } else {
        println!("{} Amount caps", CROSS);
    }

    if let Some(ref limit) = config.rate_limiting {
        println!("{} {} Rate limiting ({} ledgers)",
            WARNING,
            style("STATEFUL:").yellow().bold(),
            limit.min_ledgers
        );
    } else {
        println!("{} Rate limiting", CROSS);
    }

    println!();
    println!("{}", style(&analysis.recommendation).bold().green());
    println!();
    println!("{}", analysis.reasoning);
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{AmountCapConfig, RateLimitConfig};

    #[test]
    fn test_stateful_detection_amount_cap() {
        let config = PolicyConfig {
            name: "test-policy".to_string(),
            description: None,
            function_whitelist: None,
            contract_whitelist: None,
            recipient_whitelist: None,
            amount_cap: Some(AmountCapConfig {
                max_amount: 1000,
                token_contract: None,
            }),
            rate_limiting: None,
            admin_managed: false,
        };

        let analysis = analyze_policy(&config);
        assert!(analysis.is_stateful);
        assert!(analysis.recommendation.contains("Admin"));
    }

    #[test]
    fn test_stateful_detection_rate_limiting() {
        let config = PolicyConfig {
            name: "test-policy".to_string(),
            description: None,
            function_whitelist: None,
            contract_whitelist: None,
            recipient_whitelist: None,
            amount_cap: None,
            rate_limiting: Some(RateLimitConfig { min_ledgers: 10 }),
            admin_managed: false,
        };

        let analysis = analyze_policy(&config);
        assert!(analysis.is_stateful);
        assert!(analysis.recommendation.contains("Admin"));
    }

    #[test]
    fn test_stateful_detection_both() {
        let config = PolicyConfig {
            name: "test-policy".to_string(),
            description: None,
            function_whitelist: None,
            contract_whitelist: None,
            recipient_whitelist: None,
            amount_cap: Some(AmountCapConfig {
                max_amount: 1000,
                token_contract: None,
            }),
            rate_limiting: Some(RateLimitConfig { min_ledgers: 10 }),
            admin_managed: false,
        };

        let analysis = analyze_policy(&config);
        assert!(analysis.is_stateful);
    }

    #[test]
    fn test_stateless_detection() {
        let config = PolicyConfig {
            name: "test-policy".to_string(),
            description: None,
            function_whitelist: Some(vec!["transfer".to_string()]),
            contract_whitelist: None,
            recipient_whitelist: None,
            amount_cap: None,
            rate_limiting: None,
            admin_managed: false,
        };

        let analysis = analyze_policy(&config);
        assert!(!analysis.is_stateful);
        assert!(analysis.recommendation.contains("Simple"));
    }

    #[test]
    fn test_recommendation_text_stateful() {
        let config = PolicyConfig {
            name: "test-policy".to_string(),
            description: None,
            function_whitelist: None,
            contract_whitelist: None,
            recipient_whitelist: None,
            amount_cap: Some(AmountCapConfig {
                max_amount: 5000,
                token_contract: Some("CTOKEN123".to_string()),
            }),
            rate_limiting: None,
            admin_managed: false,
        };

        let analysis = analyze_policy(&config);
        assert!(analysis.reasoning.contains("Amount caps"));
        assert!(analysis.reasoning.contains("admin address"));
    }

    #[test]
    fn test_recommendation_text_stateless() {
        let config = PolicyConfig {
            name: "test-policy".to_string(),
            description: None,
            function_whitelist: Some(vec!["transfer".to_string(), "approve".to_string()]),
            contract_whitelist: None,
            recipient_whitelist: None,
            amount_cap: None,
            rate_limiting: None,
            admin_managed: false,
        };

        let analysis = analyze_policy(&config);
        assert!(analysis.reasoning.contains("Function whitelisting"));
        assert!(analysis.reasoning.contains("deployment costs"));
    }
}
