//! Template data structures for Handlebars rendering

use crate::types::PolicyConfig;
use serde::Serialize;

/// Template data with helper flags and formatted values
#[derive(Debug, Clone, Serialize)]
pub struct TemplateData {
    /// Policy name (kebab-case)
    pub policy_name: String,

    /// Policy name in snake_case for Rust/file names
    pub policy_name_snake: String,

    /// Policy name in PascalCase for types
    pub policy_name_pascal: String,

    /// Optional description
    pub description: Option<String>,

    /// Whether this policy has admin management
    pub admin_managed: bool,

    /// Helper flags for template conditionals
    pub has_function_whitelist: bool,
    pub has_contract_whitelist: bool,
    pub has_recipient_whitelist: bool,
    pub has_amount_cap: bool,
    pub has_rate_limiting: bool,

    /// Helper counts for README template
    pub contract_whitelist_count: usize,
    pub recipient_whitelist_count: usize,

    /// Policy configuration details
    #[serde(skip_serializing_if = "Option::is_none")]
    pub function_whitelist: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub contract_whitelist: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub recipient_whitelist: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount_cap: Option<AmountCapData>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub rate_limiting: Option<RateLimitData>,

    /// Individual whitelist items for test templates (first items)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub function_whitelist_0: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub contract_whitelist_0: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub recipient_whitelist_0: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AmountCapData {
    pub max_amount: i128,
    pub token_contract: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RateLimitData {
    pub min_ledgers: u32,
}

impl TemplateData {
    /// Convert PolicyConfig to TemplateData with helper flags
    pub fn from_policy_config(config: &PolicyConfig) -> Self {
        TemplateData {
            policy_name: config.name.clone(),
            policy_name_snake: to_snake_case(&config.name),
            policy_name_pascal: to_pascal_case(&config.name),
            description: config.description.clone(),
            admin_managed: config.admin_managed,
            has_function_whitelist: config.function_whitelist.is_some(),
            has_contract_whitelist: config.contract_whitelist.is_some(),
            has_recipient_whitelist: config.recipient_whitelist.is_some(),
            has_amount_cap: config.amount_cap.is_some(),
            has_rate_limiting: config.rate_limiting.is_some(),
            contract_whitelist_count: config.contract_whitelist.as_ref().map_or(0, |v| v.len()),
            recipient_whitelist_count: config.recipient_whitelist.as_ref().map_or(0, |v| v.len()),
            function_whitelist: config.function_whitelist.clone(),
            contract_whitelist: config.contract_whitelist.clone(),
            recipient_whitelist: config.recipient_whitelist.clone(),
            amount_cap: config.amount_cap.as_ref().map(|ac| AmountCapData {
                max_amount: ac.max_amount,
                token_contract: ac.token_contract.clone(),
            }),
            rate_limiting: config.rate_limiting.as_ref().map(|rl| RateLimitData {
                min_ledgers: rl.min_ledgers,
            }),
            function_whitelist_0: config.function_whitelist.as_ref().and_then(|v| v.get(0).cloned()),
            contract_whitelist_0: config.contract_whitelist.as_ref().and_then(|v| v.get(0).cloned()),
            recipient_whitelist_0: config.recipient_whitelist.as_ref().and_then(|v| v.get(0).cloned()),
        }
    }
}

/// Convert kebab-case to snake_case
pub fn to_snake_case(s: &str) -> String {
    s.replace('-', "_")
}

/// Convert kebab-case to PascalCase
pub fn to_pascal_case(s: &str) -> String {
    s.split('-')
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect()
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{AmountCapConfig, RateLimitConfig};

    #[test]
    fn test_to_snake_case() {
        assert_eq!(to_snake_case("my-policy"), "my_policy");
        assert_eq!(to_snake_case("simple"), "simple");
        assert_eq!(to_snake_case("multi-word-name"), "multi_word_name");
    }

    #[test]
    fn test_to_pascal_case() {
        assert_eq!(to_pascal_case("my-policy"), "MyPolicy");
        assert_eq!(to_pascal_case("simple"), "Simple");
        assert_eq!(to_pascal_case("multi-word-name"), "MultiWordName");
    }

    #[test]
    fn test_template_data_from_simple_config() {
        let config = PolicyConfig {
            name: "test-policy".to_string(),
            description: Some("Test".to_string()),
            function_whitelist: Some(vec!["transfer".to_string()]),
            contract_whitelist: None,
            recipient_whitelist: None,
            amount_cap: None,
            rate_limiting: None,
            admin_managed: false,
        };

        let data = TemplateData::from_policy_config(&config);

        assert_eq!(data.policy_name, "test-policy");
        assert_eq!(data.policy_name_snake, "test_policy");
        assert_eq!(data.policy_name_pascal, "TestPolicy");
        assert!(data.has_function_whitelist);
        assert!(!data.has_amount_cap);
        assert!(!data.admin_managed);
    }

    #[test]
    fn test_template_data_from_admin_config() {
        let config = PolicyConfig {
            name: "admin-policy".to_string(),
            description: None,
            function_whitelist: None,
            contract_whitelist: None,
            recipient_whitelist: None,
            amount_cap: Some(AmountCapConfig {
                max_amount: 1000,
                token_contract: None,
            }),
            rate_limiting: Some(RateLimitConfig { min_ledgers: 10 }),
            admin_managed: true,
        };

        let data = TemplateData::from_policy_config(&config);

        assert!(data.admin_managed);
        assert!(data.has_amount_cap);
        assert!(data.has_rate_limiting);
        assert_eq!(data.amount_cap.unwrap().max_amount, 1000);
        assert_eq!(data.rate_limiting.unwrap().min_ledgers, 10);
    }
}
