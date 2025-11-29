//! Policy configuration types

use serde::{Deserialize, Serialize};

/// Policy configuration for generated smart contracts
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PolicyConfig {
    /// Policy name (lowercase, hyphens allowed)
    pub name: String,

    /// Optional policy description
    pub description: Option<String>,

    /// Function whitelist - restrict which functions can be called
    pub function_whitelist: Option<Vec<String>>,

    /// Contract whitelist - restrict which contracts can be called
    pub contract_whitelist: Option<Vec<String>>,

    /// Recipient whitelist - restrict destination addresses
    pub recipient_whitelist: Option<Vec<String>>,

    /// Amount cap configuration
    pub amount_cap: Option<AmountCapConfig>,

    /// Rate limiting configuration
    pub rate_limiting: Option<RateLimitConfig>,

    /// Whether to include admin functionality for runtime updates
    pub admin_managed: bool,
}

/// Amount cap configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AmountCapConfig {
    /// Maximum amount allowed per transaction
    pub max_amount: i128,

    /// Optional token contract address (if None, applies to native token)
    pub token_contract: Option<String>,
}

/// Rate limiting configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    /// Minimum number of ledgers between transactions
    pub min_ledgers: u32,
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_policy_config_serialization() {
        let config = PolicyConfig {
            name: "test-policy".to_string(),
            description: Some("Test policy".to_string()),
            function_whitelist: Some(vec!["transfer".to_string(), "approve".to_string()]),
            contract_whitelist: None,
            recipient_whitelist: None,
            amount_cap: Some(AmountCapConfig {
                max_amount: 1000,
                token_contract: Some("CTOKEN123".to_string()),
            }),
            rate_limiting: Some(RateLimitConfig { min_ledgers: 10 }),
            admin_managed: true,
        };

        // Test serialization roundtrip
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: PolicyConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(config.name, deserialized.name);
        assert_eq!(config.description, deserialized.description);
        assert_eq!(config.admin_managed, deserialized.admin_managed);
    }

    #[test]
    fn test_policy_config_default() {
        let config = PolicyConfig::default();
        assert_eq!(config.name, "");
        assert_eq!(config.description, None);
        assert_eq!(config.admin_managed, false);
    }
}
