//! Interactive prompt functions with validation

use crate::types::{AmountCapConfig, RateLimitConfig};
use dialoguer::{Confirm, Input};

/// Prompt for policy name with validation
pub fn prompt_policy_name() -> Result<String, Box<dyn std::error::Error>> {
    Input::new()
        .with_prompt("Policy name (lowercase, hyphens allowed)")
        .validate_with(|input: &String| -> Result<(), String> {
            validate_policy_name(input)
        })
        .interact_text()
        .map_err(Into::into)
}

/// Prompt for optional description
pub fn prompt_description() -> Result<Option<String>, Box<dyn std::error::Error>> {
    let has_description = Confirm::new()
        .with_prompt("Add a description?")
        .default(false)
        .interact()?;

    if has_description {
        let desc: String = Input::new()
            .with_prompt("Policy description")
            .allow_empty(false)
            .interact_text()?;
        Ok(Some(desc))
    } else {
        Ok(None)
    }
}

/// Prompt for function whitelist
pub fn prompt_function_whitelist() -> Result<Option<Vec<String>>, Box<dyn std::error::Error>> {
    let enable = Confirm::new()
        .with_prompt("Enable function whitelisting? (restrict which contract functions can be called)")
        .default(false)
        .interact()?;

    if enable {
        let input: String = Input::new()
            .with_prompt("Function names (comma-separated)")
            .validate_with(|input: &String| -> Result<(), String> {
                let functions: Vec<&str> = input.split(',').map(|s| s.trim()).collect();
                for func in functions {
                    validate_function_name(func)?;
                }
                Ok(())
            })
            .interact_text()?;

        let functions: Vec<String> = input
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Ok(Some(functions))
    } else {
        Ok(None)
    }
}

/// Prompt for contract whitelist
pub fn prompt_contract_whitelist() -> Result<Option<Vec<String>>, Box<dyn std::error::Error>> {
    let enable = Confirm::new()
        .with_prompt("Enable contract whitelisting? (restrict which contracts can be called)")
        .default(false)
        .interact()?;

    if enable {
        let input: String = Input::new()
            .with_prompt("Contract addresses (comma-separated, 56 chars starting with 'C')")
            .validate_with(|input: &String| -> Result<(), String> {
                let addresses: Vec<&str> = input.split(',').map(|s| s.trim()).collect();
                for addr in addresses {
                    validate_contract_address(addr)?;
                }
                Ok(())
            })
            .interact_text()?;

        let addresses: Vec<String> = input
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Ok(Some(addresses))
    } else {
        Ok(None)
    }
}

/// Prompt for recipient whitelist
pub fn prompt_recipient_whitelist() -> Result<Option<Vec<String>>, Box<dyn std::error::Error>> {
    let enable = Confirm::new()
        .with_prompt("Enable recipient whitelisting? (restrict destination addresses for transfers)")
        .default(false)
        .interact()?;

    if enable {
        let input: String = Input::new()
            .with_prompt("Recipient addresses (comma-separated, 56 chars starting with 'G')")
            .validate_with(|input: &String| -> Result<(), String> {
                let addresses: Vec<&str> = input.split(',').map(|s| s.trim()).collect();
                for addr in addresses {
                    validate_account_address(addr)?;
                }
                Ok(())
            })
            .interact_text()?;

        let addresses: Vec<String> = input
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Ok(Some(addresses))
    } else {
        Ok(None)
    }
}

/// Prompt for amount cap configuration
pub fn prompt_amount_cap() -> Result<Option<AmountCapConfig>, Box<dyn std::error::Error>> {
    let enable = Confirm::new()
        .with_prompt("Enable amount caps? (maximum transaction amounts)")
        .default(false)
        .interact()?;

    if enable {
        let max_amount: String = Input::new()
            .with_prompt("Maximum amount (positive integer)")
            .validate_with(|input: &String| -> Result<(), String> {
                validate_amount(input)
            })
            .interact_text()?;

        let max_amount: i128 = max_amount.parse()
            .map_err(|_| "Failed to parse amount")?;

        let has_token = Confirm::new()
            .with_prompt("Specify token contract? (leave empty for native token)")
            .default(false)
            .interact()?;

        let token_contract = if has_token {
            let addr: String = Input::new()
                .with_prompt("Token contract address (56 chars starting with 'C')")
                .validate_with(|input: &String| -> Result<(), String> {
                    validate_contract_address(input)
                })
                .interact_text()?;
            Some(addr)
        } else {
            None
        };

        Ok(Some(AmountCapConfig {
            max_amount,
            token_contract,
        }))
    } else {
        Ok(None)
    }
}

/// Prompt for rate limiting configuration
pub fn prompt_rate_limiting() -> Result<Option<RateLimitConfig>, Box<dyn std::error::Error>> {
    let enable = Confirm::new()
        .with_prompt("Enable rate limiting? (time delays between transactions)")
        .default(false)
        .interact()?;

    if enable {
        let min_ledgers: String = Input::new()
            .with_prompt("Minimum ledgers between transactions (positive integer)")
            .validate_with(|input: &String| -> Result<(), String> {
                validate_ledgers(input)
            })
            .interact_text()?;

        let min_ledgers: u32 = min_ledgers.parse()
            .map_err(|_| "Failed to parse ledger count")?;

        Ok(Some(RateLimitConfig { min_ledgers }))
    } else {
        Ok(None)
    }
}

// ============================================================================
// Validation Functions
// ============================================================================

/// Validate policy name: lowercase, hyphens allowed, 3-50 characters
pub fn validate_policy_name(name: &str) -> Result<(), String> {
    if name.len() < 3 || name.len() > 50 {
        return Err("Policy name must be 3-50 characters".to_string());
    }

    if !name.chars().all(|c| c.is_lowercase() || c == '-') {
        return Err("Policy name must be lowercase letters and hyphens only".to_string());
    }

    if name.starts_with('-') || name.ends_with('-') {
        return Err("Policy name cannot start or end with hyphen".to_string());
    }

    Ok(())
}

/// Validate contract address: 56 characters, starts with 'C'
pub fn validate_contract_address(addr: &str) -> Result<(), String> {
    if addr.len() != 56 {
        return Err(format!("Contract address must be exactly 56 characters (got {})", addr.len()));
    }

    if !addr.starts_with('C') {
        return Err("Contract address must start with 'C'".to_string());
    }

    // Check all characters are alphanumeric (Stellar addresses are base32)
    if !addr.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err("Contract address must contain only alphanumeric characters".to_string());
    }

    Ok(())
}

/// Validate account address: 56 characters, starts with 'G'
pub fn validate_account_address(addr: &str) -> Result<(), String> {
    if addr.len() != 56 {
        return Err(format!("Account address must be exactly 56 characters (got {})", addr.len()));
    }

    if !addr.starts_with('G') {
        return Err("Account address must start with 'G'".to_string());
    }

    // Check all characters are alphanumeric (Stellar addresses are base32)
    if !addr.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err("Account address must contain only alphanumeric characters".to_string());
    }

    Ok(())
}

/// Validate function name: valid Rust identifier
pub fn validate_function_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("Function name cannot be empty".to_string());
    }

    // First character must be letter or underscore
    if let Some(first) = name.chars().next() {
        if !first.is_alphabetic() && first != '_' {
            return Err("Function name must start with a letter or underscore".to_string());
        }
    }

    // Remaining characters must be alphanumeric or underscore
    if !name.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err("Function name must contain only letters, numbers, and underscores".to_string());
    }

    Ok(())
}

/// Validate amount: positive i128
pub fn validate_amount(amount_str: &str) -> Result<(), String> {
    let amount: i128 = amount_str.parse()
        .map_err(|_| "Amount must be a valid integer".to_string())?;

    if amount <= 0 {
        return Err("Amount must be positive".to_string());
    }

    Ok(())
}

/// Validate ledger count: positive u32
pub fn validate_ledgers(ledgers_str: &str) -> Result<(), String> {
    let ledgers: u32 = ledgers_str.parse()
        .map_err(|_| "Ledger count must be a valid positive integer".to_string())?;

    if ledgers == 0 {
        return Err("Ledger count must be greater than 0".to_string());
    }

    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_policy_name_valid() {
        assert!(validate_policy_name("my-policy").is_ok());
        assert!(validate_policy_name("simple").is_ok());
        assert!(validate_policy_name("multi-word-policy-name").is_ok());
    }

    #[test]
    fn test_validate_policy_name_invalid_uppercase() {
        assert!(validate_policy_name("MyPolicy").is_err());
        assert!(validate_policy_name("POLICY").is_err());
    }

    #[test]
    fn test_validate_policy_name_invalid_length() {
        assert!(validate_policy_name("ab").is_err()); // too short
        assert!(validate_policy_name(&"a".repeat(51)).is_err()); // too long
    }

    #[test]
    fn test_validate_policy_name_invalid_characters() {
        assert!(validate_policy_name("my_policy").is_err()); // underscore not allowed
        assert!(validate_policy_name("my policy").is_err()); // space not allowed
        assert!(validate_policy_name("my.policy").is_err()); // dot not allowed
    }

    #[test]
    fn test_validate_policy_name_invalid_edges() {
        assert!(validate_policy_name("-policy").is_err()); // starts with hyphen
        assert!(validate_policy_name("policy-").is_err()); // ends with hyphen
    }

    #[test]
    fn test_validate_contract_address_valid() {
        let valid_addr = "C".to_string() + &"A".repeat(55);
        assert!(validate_contract_address(&valid_addr).is_ok());
    }

    #[test]
    fn test_validate_contract_address_invalid_length() {
        assert!(validate_contract_address("CSHORTADDR").is_err());
        let long_addr = "C".to_string() + &"A".repeat(60);
        assert!(validate_contract_address(&long_addr).is_err());
    }

    #[test]
    fn test_validate_contract_address_invalid_prefix() {
        let wrong_prefix = "G".to_string() + &"A".repeat(55);
        assert!(validate_contract_address(&wrong_prefix).is_err());
    }

    #[test]
    fn test_validate_account_address_valid() {
        let valid_addr = "G".to_string() + &"A".repeat(55);
        assert!(validate_account_address(&valid_addr).is_ok());
    }

    #[test]
    fn test_validate_account_address_invalid_length() {
        assert!(validate_account_address("GSHORTADDR").is_err());
        let long_addr = "G".to_string() + &"A".repeat(60);
        assert!(validate_account_address(&long_addr).is_err());
    }

    #[test]
    fn test_validate_account_address_invalid_prefix() {
        let wrong_prefix = "C".to_string() + &"A".repeat(55);
        assert!(validate_account_address(&wrong_prefix).is_err());
    }

    #[test]
    fn test_validate_function_name_valid() {
        assert!(validate_function_name("transfer").is_ok());
        assert!(validate_function_name("approve").is_ok());
        assert!(validate_function_name("_private").is_ok());
        assert!(validate_function_name("func_123").is_ok());
    }

    #[test]
    fn test_validate_function_name_invalid() {
        assert!(validate_function_name("").is_err());
        assert!(validate_function_name("123func").is_err()); // starts with number
        assert!(validate_function_name("func-name").is_err()); // hyphen not allowed
        assert!(validate_function_name("func name").is_err()); // space not allowed
    }

    #[test]
    fn test_validate_amount_positive() {
        assert!(validate_amount("1000").is_ok());
        assert!(validate_amount("1").is_ok());
        assert!(validate_amount("999999999999999").is_ok());
    }

    #[test]
    fn test_validate_amount_invalid() {
        assert!(validate_amount("0").is_err());
        assert!(validate_amount("-100").is_err());
        assert!(validate_amount("abc").is_err());
    }

    #[test]
    fn test_validate_ledgers_positive() {
        assert!(validate_ledgers("10").is_ok());
        assert!(validate_ledgers("1").is_ok());
        assert!(validate_ledgers("100000").is_ok());
    }

    #[test]
    fn test_validate_ledgers_invalid() {
        assert!(validate_ledgers("0").is_err());
        assert!(validate_ledgers("abc").is_err());
    }
}
