//! Quick verification test - Generate all combinations and verify code structure
//!
//! ⚠️ NOTE: This test only validates code STRUCTURE (imports, signatures, patterns).
//! It does NOT compile the code, so it won't catch semantic errors like:
//! - Missing trait implementations
//! - Incorrect method names
//! - Type mismatches
//! - Ownership issues
//!
//! For comprehensive validation, run: cargo test --test build_test -- --ignored

use stellar_policy_cli::types::*;
use stellar_policy_cli::generator;
use std::fs;
use tempfile::TempDir;

// Test addresses
const ACCOUNT_ADDRESS: &str = "GCURS4DFNCY5BHXG5L4H2BDJD6TEOKMZMDH6FKJHRUIRDLXCJNML3NJO";
const CONTRACT_ADDRESS: &str = "CAHLJEQUCNTV7JPAPCMLCBIHOX7FFB57DUARJ6XGTW27FPCVKKY7JM2A";

/// Helper to verify generated code contains correct imports
fn verify_imports(lib_rs_content: &str) -> Result<(), String> {
    // Check for soroban imports
    if !lib_rs_content.contains("use soroban_sdk::auth::{Context, ContractContext}") {
        return Err("Missing Context and ContractContext imports".to_string());
    }

    // Check for key soroban_sdk imports (flexible check)
    if !lib_rs_content.contains("use soroban_sdk::{") {
        return Err("Missing soroban_sdk imports".to_string());
    }

    if !lib_rs_content.contains("contract") || !lib_rs_content.contains("contractimpl") {
        return Err("Missing contract/contractimpl imports".to_string());
    }

    Ok(())
}

/// Helper to verify policy__ function and SignerKey definition
fn verify_policy_interface(lib_rs_content: &str) -> Result<(), String> {
    // Check for SignerKey definition with export = true
    if !lib_rs_content.contains("pub enum SignerKey") {
        return Err("Missing SignerKey enum definition".to_string());
    }

    if !lib_rs_content.contains("#[contracttype(export = true)]") {
        return Err("SignerKey missing export = true attribute".to_string());
    }

    // Check for policy__ function
    if !lib_rs_content.contains("pub fn policy__") {
        return Err("Missing policy__ function".to_string());
    }

    // Verify correct Context usage with pattern matching
    if !lib_rs_content.contains("Context::Contract(ContractContext") {
        return Err("Missing Context pattern matching".to_string());
    }

    Ok(())
}

#[test]
fn test_verify_all_combinations() {
    println!("\n🧪 Quick Verification Test - All Policy Combinations\n");

    let test_cases = vec![
        (
            "Simple - No features",
            PolicyConfig {
                name: "simple-none".to_string(),
                description: Some("Simple policy with no features".to_string()),
                function_whitelist: None,
                contract_whitelist: None,
                recipient_whitelist: None,
                amount_cap: None,
                rate_limiting: None,
                admin_managed: false,
            },
        ),
        (
            "Function whitelist only",
            PolicyConfig {
                name: "fn-whitelist".to_string(),
                description: None,
                function_whitelist: Some(vec!["transfer".to_string()]),
                contract_whitelist: None,
                recipient_whitelist: None,
                amount_cap: None,
                rate_limiting: None,
                admin_managed: false,
            },
        ),
        (
            "Contract whitelist only",
            PolicyConfig {
                name: "contract-wl".to_string(),
                description: None,
                function_whitelist: None,
                contract_whitelist: Some(vec![CONTRACT_ADDRESS.to_string()]),
                recipient_whitelist: None,
                amount_cap: None,
                rate_limiting: None,
                admin_managed: false,
            },
        ),
        (
            "Recipient whitelist only",
            PolicyConfig {
                name: "recipient-wl".to_string(),
                description: None,
                function_whitelist: None,
                contract_whitelist: None,
                recipient_whitelist: Some(vec![ACCOUNT_ADDRESS.to_string()]),
                amount_cap: None,
                rate_limiting: None,
                admin_managed: false,
            },
        ),
        (
            "Amount cap (admin)",
            PolicyConfig {
                name: "amount-cap".to_string(),
                description: None,
                function_whitelist: None,
                contract_whitelist: None,
                recipient_whitelist: None,
                amount_cap: Some(AmountCapConfig {
                    max_amount: 1000000,
                    token_contract: None,
                }),
                rate_limiting: None,
                admin_managed: true,
            },
        ),
        (
            "Rate limiting (admin)",
            PolicyConfig {
                name: "rate-limit".to_string(),
                description: None,
                function_whitelist: None,
                contract_whitelist: None,
                recipient_whitelist: None,
                amount_cap: None,
                rate_limiting: Some(RateLimitConfig {
                    min_ledgers: 100,
                }),
                admin_managed: true,
            },
        ),
        (
            "All simple features",
            PolicyConfig {
                name: "all-simple".to_string(),
                description: None,
                function_whitelist: Some(vec!["transfer".to_string()]),
                contract_whitelist: Some(vec![CONTRACT_ADDRESS.to_string()]),
                recipient_whitelist: Some(vec![ACCOUNT_ADDRESS.to_string()]),
                amount_cap: None,
                rate_limiting: None,
                admin_managed: false,
            },
        ),
        (
            "ALL features (admin)",
            PolicyConfig {
                name: "all-admin".to_string(),
                description: None,
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
            },
        ),
    ];

    let mut passed = 0;
    let mut failed = 0;

    for (name, config) in test_cases {
        print!("  Testing: {} ... ", name);

        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().to_str().unwrap();

        // Generate
        match generator::generate_project(&config, output_path) {
            Ok(_) => {
                // Read generated lib.rs
                let lib_rs_path = format!("{}/contracts/{}/src/lib.rs", output_path, config.name);
                let lib_rs = fs::read_to_string(&lib_rs_path).unwrap();

                // Verify imports
                if let Err(e) = verify_imports(&lib_rs) {
                    println!("❌ FAIL");
                    println!("    Import error: {}", e);
                    failed += 1;
                    continue;
                }

                // Verify PolicyInterface
                if let Err(e) = verify_policy_interface(&lib_rs) {
                    println!("❌ FAIL");
                    println!("    Interface error: {}", e);
                    failed += 1;
                    continue;
                }

                // Verify admin features
                if config.admin_managed {
                    if !lib_rs.contains("mod types") {
                        println!("❌ FAIL");
                        println!("    Missing types module for admin policy");
                        failed += 1;
                        continue;
                    }

                    if !lib_rs.contains("pub fn init") {
                        println!("❌ FAIL");
                        println!("    Missing init function for admin policy");
                        failed += 1;
                        continue;
                    }
                } else {
                    if lib_rs.contains("mod types") {
                        println!("❌ FAIL");
                        println!("    Should not have types module for simple policy");
                        failed += 1;
                        continue;
                    }
                }

                println!("✅ PASS");
                passed += 1;
            }
            Err(e) => {
                println!("❌ FAIL");
                println!("    Generation error: {}", e);
                failed += 1;
            }
        }
    }

    println!("\n📊 Results: {} passed, {} failed", passed, failed);

    if failed > 0 {
        panic!("Some tests failed!");
    }
}
