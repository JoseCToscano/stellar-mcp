//! Comprehensive build tests - Generate all policy combinations and verify they compile

use stellar_policy_cli::types::*;
use stellar_policy_cli::generator;
use std::process::Command;
use tempfile::TempDir;

// Test addresses
const ACCOUNT_ADDRESS: &str = "GCURS4DFNCY5BHXG5L4H2BDJD6TEOKMZMDH6FKJHRUIRDLXCJNML3NJO";
const CONTRACT_ADDRESS: &str = "CAHLJEQUCNTV7JPAPCMLCBIHOX7FFB57DUARJ6XGTW27FPCVKKY7JM2A";

/// Helper function to generate and build a policy
fn generate_and_build(config: &PolicyConfig) -> Result<(), String> {
    let temp_dir = TempDir::new().map_err(|e| format!("Failed to create temp dir: {}", e))?;
    let output_path = temp_dir.path().to_str().unwrap();

    // Generate the project
    generator::generate_project(config, output_path)
        .map_err(|e| format!("Generation failed: {}", e))?;

    // Try to build the contract
    let status = Command::new("cargo")
        .args(&["check", "--manifest-path"])
        .arg(temp_dir.path().join("contracts/Cargo.toml"))
        .status()
        .map_err(|e| format!("Failed to run cargo: {}", e))?;

    if !status.success() {
        return Err(format!("Build failed with exit code: {:?}", status.code()));
    }

    Ok(())
}

#[test]
#[ignore] // Run with: cargo test --test build_test -- --ignored --nocapture
fn test_build_simple_no_features() {
    println!("\n🧪 Testing: Simple policy with NO features");

    let config = PolicyConfig {
        name: "simple-none".to_string(),
        description: Some("Simple policy with no features".to_string()),
        function_whitelist: None,
        contract_whitelist: None,
        recipient_whitelist: None,
        amount_cap: None,
        rate_limiting: None,
        admin_managed: false,
    };

    match generate_and_build(&config) {
        Ok(_) => println!("✅ PASS: Simple policy (no features) builds successfully"),
        Err(e) => panic!("❌ FAIL: {}", e),
    }
}

#[test]
#[ignore]
fn test_build_function_whitelist_only() {
    println!("\n🧪 Testing: Function whitelist only (simple)");

    let config = PolicyConfig {
        name: "fn-whitelist".to_string(),
        description: Some("Function whitelist only".to_string()),
        function_whitelist: Some(vec!["transfer".to_string(), "approve".to_string()]),
        contract_whitelist: None,
        recipient_whitelist: None,
        amount_cap: None,
        rate_limiting: None,
        admin_managed: false,
    };

    match generate_and_build(&config) {
        Ok(_) => println!("✅ PASS: Function whitelist builds successfully"),
        Err(e) => panic!("❌ FAIL: {}", e),
    }
}

#[test]
#[ignore]
fn test_build_contract_whitelist_only() {
    println!("\n🧪 Testing: Contract whitelist only (simple)");

    let config = PolicyConfig {
        name: "contract-whitelist".to_string(),
        description: Some("Contract whitelist only".to_string()),
        function_whitelist: None,
        contract_whitelist: Some(vec![CONTRACT_ADDRESS.to_string()]),
        recipient_whitelist: None,
        amount_cap: None,
        rate_limiting: None,
        admin_managed: false,
    };

    match generate_and_build(&config) {
        Ok(_) => println!("✅ PASS: Contract whitelist builds successfully"),
        Err(e) => panic!("❌ FAIL: {}", e),
    }
}

#[test]
#[ignore]
fn test_build_recipient_whitelist_only() {
    println!("\n🧪 Testing: Recipient whitelist only (simple)");

    let config = PolicyConfig {
        name: "recipient-whitelist".to_string(),
        description: Some("Recipient whitelist only".to_string()),
        function_whitelist: None,
        contract_whitelist: None,
        recipient_whitelist: Some(vec![ACCOUNT_ADDRESS.to_string()]),
        amount_cap: None,
        rate_limiting: None,
        admin_managed: false,
    };

    match generate_and_build(&config) {
        Ok(_) => println!("✅ PASS: Recipient whitelist builds successfully"),
        Err(e) => panic!("❌ FAIL: {}", e),
    }
}

#[test]
#[ignore]
fn test_build_amount_cap_admin() {
    println!("\n🧪 Testing: Amount cap (admin-managed)");

    let config = PolicyConfig {
        name: "amount-cap".to_string(),
        description: Some("Amount cap with admin".to_string()),
        function_whitelist: None,
        contract_whitelist: None,
        recipient_whitelist: None,
        amount_cap: Some(AmountCapConfig {
            max_amount: 1000000,
            token_contract: None,
        }),
        rate_limiting: None,
        admin_managed: true,
    };

    match generate_and_build(&config) {
        Ok(_) => println!("✅ PASS: Amount cap (admin) builds successfully"),
        Err(e) => panic!("❌ FAIL: {}", e),
    }
}

#[test]
#[ignore]
fn test_build_rate_limiting_admin() {
    println!("\n🧪 Testing: Rate limiting (admin-managed)");

    let config = PolicyConfig {
        name: "rate-limit".to_string(),
        description: Some("Rate limiting with admin".to_string()),
        function_whitelist: None,
        contract_whitelist: None,
        recipient_whitelist: None,
        amount_cap: None,
        rate_limiting: Some(RateLimitConfig {
            min_ledgers: 100,
        }),
        admin_managed: true,
    };

    match generate_and_build(&config) {
        Ok(_) => println!("✅ PASS: Rate limiting (admin) builds successfully"),
        Err(e) => panic!("❌ FAIL: {}", e),
    }
}

#[test]
#[ignore]
fn test_build_all_features_simple() {
    println!("\n🧪 Testing: All simple features (no admin)");

    let config = PolicyConfig {
        name: "all-simple".to_string(),
        description: Some("All simple features".to_string()),
        function_whitelist: Some(vec!["transfer".to_string()]),
        contract_whitelist: Some(vec![CONTRACT_ADDRESS.to_string()]),
        recipient_whitelist: Some(vec![ACCOUNT_ADDRESS.to_string()]),
        amount_cap: None,
        rate_limiting: None,
        admin_managed: false,
    };

    match generate_and_build(&config) {
        Ok(_) => println!("✅ PASS: All simple features build successfully"),
        Err(e) => panic!("❌ FAIL: {}", e),
    }
}

#[test]
#[ignore]
fn test_build_all_features_admin() {
    println!("\n🧪 Testing: ALL features (admin-managed)");

    let config = PolicyConfig {
        name: "all-admin".to_string(),
        description: Some("All features with admin".to_string()),
        function_whitelist: Some(vec!["transfer".to_string(), "swap".to_string()]),
        contract_whitelist: Some(vec![CONTRACT_ADDRESS.to_string()]),
        recipient_whitelist: Some(vec![ACCOUNT_ADDRESS.to_string()]),
        amount_cap: Some(AmountCapConfig {
            max_amount: 1000000,
            token_contract: None,
        }),
        rate_limiting: Some(RateLimitConfig {
            min_ledgers: 100,
        }),
        admin_managed: true,
    };

    match generate_and_build(&config) {
        Ok(_) => println!("✅ PASS: All features (admin) build successfully"),
        Err(e) => panic!("❌ FAIL: {}", e),
    }
}

#[test]
#[ignore]
fn test_build_mixed_features_admin() {
    println!("\n🧪 Testing: Mixed features (admin-managed)");

    let config = PolicyConfig {
        name: "mixed-admin".to_string(),
        description: Some("Mixed features with admin".to_string()),
        function_whitelist: Some(vec!["transfer".to_string()]),
        contract_whitelist: None,
        recipient_whitelist: Some(vec![ACCOUNT_ADDRESS.to_string()]),
        amount_cap: Some(AmountCapConfig {
            max_amount: 500000,
            token_contract: Some(CONTRACT_ADDRESS.to_string()),
        }),
        rate_limiting: None,
        admin_managed: true,
    };

    match generate_and_build(&config) {
        Ok(_) => println!("✅ PASS: Mixed features (admin) build successfully"),
        Err(e) => panic!("❌ FAIL: {}", e),
    }
}

#[test]
#[ignore]
fn test_build_recipient_and_amount_cap() {
    println!("\n🧪 Testing: Recipient whitelist + Amount cap (admin)");

    let config = PolicyConfig {
        name: "recipient-amount".to_string(),
        description: Some("Recipient whitelist and amount cap".to_string()),
        function_whitelist: None,
        contract_whitelist: None,
        recipient_whitelist: Some(vec![ACCOUNT_ADDRESS.to_string()]),
        amount_cap: Some(AmountCapConfig {
            max_amount: 100000,
            token_contract: None,
        }),
        rate_limiting: None,
        admin_managed: true,
    };

    match generate_and_build(&config) {
        Ok(_) => println!("✅ PASS: Recipient + Amount cap build successfully"),
        Err(e) => panic!("❌ FAIL: {}", e),
    }
}
