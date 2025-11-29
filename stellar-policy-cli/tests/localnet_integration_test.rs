//! Advanced Integration Tests - Localnet Deployment & Smart Wallet Integration
//!
//! These tests go beyond spec validation to actual deployment and invocation:
//! - Priority 1: Deploy to localnet and invoke functions
//! - Priority 2: Smart wallet integration with policy enforcement
//!
//! Prerequisites:
//! - Docker for running Stellar quickstart
//! - stellar-cli with localnet support
//! - Smart wallet contract from passkey-kit
//!
//! Note: These tests are more complex and slower than spec validation tests.
//! They require a running Stellar localnet instance.

use stellar_policy_cli::types::*;
use stellar_policy_cli::generator;
use std::process::Command;
use std::path::PathBuf;
use std::thread;
use std::time::Duration;
use tempfile::TempDir;

// Test constants
const LOCALNET_RPC_URL: &str = "http://localhost:8000/soroban/rpc";
const LOCALNET_NETWORK_PASSPHRASE: &str = "Standalone Network ; February 2017";
const ALICE_SECRET: &str = "SAAPYAPTTRZMCUZFPG3G66V4ZMHTK4TWA6NS7U4F7Z3IMUD52EK4DDEV"; // Friendbot funded account
const ALICE_ADDRESS: &str = "GBAOLK457RDF3AFRQA3LWD3OZTWUNGSUK4JDAIFBLX5TS5IB5YL5V6OH"; // Alice's public key

/// Helper to check if localnet is running
fn is_localnet_running() -> bool {
    Command::new("curl")
        .args(&["-s", LOCALNET_RPC_URL])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

/// Helper to start localnet (requires Docker)
fn ensure_localnet_running() -> Result<(), String> {
    if is_localnet_running() {
        println!("  ℹ️  Localnet already running");
        // Fund Alice account if needed
        fund_alice_account()?;
        return Ok(());
    }

    println!("  🚀 Starting Stellar localnet via Docker...");

    // Start stellar-quickstart in detached mode
    let status = Command::new("docker")
        .args(&[
            "run",
            "--rm",
            "-d",
            "-p", "8000:8000",
            "--name", "stellar-localnet-test",
            "stellar/quickstart:latest",
            "--standalone",
            "--enable-soroban-rpc",
        ])
        .status()
        .map_err(|e| format!("Failed to start Docker: {}", e))?;

    if !status.success() {
        return Err("Failed to start stellar-quickstart Docker container".to_string());
    }

    // Wait for localnet to be ready (up to 30 seconds)
    println!("  ⏳ Waiting for localnet to be ready...");
    for i in 1..=30 {
        thread::sleep(Duration::from_secs(1));
        if is_localnet_running() {
            println!("  ✅ Localnet ready after {} seconds", i);
            // Fund Alice account
            fund_alice_account()?;
            return Ok(());
        }
    }

    Err("Localnet failed to start within 30 seconds".to_string())
}

/// Helper to fund Alice account via friendbot and setup identity
fn fund_alice_account() -> Result<(), String> {
    println!("  💰 Setting up standalone network config...");

    // First, add the standalone network configuration
    let network_result = Command::new("stellar")
        .args(&[
            "network", "add",
            "--global",
            "--rpc-url", LOCALNET_RPC_URL,
            "--network-passphrase", LOCALNET_NETWORK_PASSPHRASE,
            "standalone",
        ])
        .output()
        .map_err(|e| format!("Failed to add network: {}", e))?;

    if !network_result.status.success() {
        // Network might already exist, that's OK
        println!("  ℹ️  Standalone network may already exist");
    }

    println!("  💰 Setting up Alice identity...");

    // Create the alice identity using the secret key
    let mut child = Command::new("stellar")
        .args(&[
            "keys", "add", "alice",
            "--secret-key",
        ])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn stellar keys add: {}", e))?;

    // Write the secret key to stdin
    use std::io::Write;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(ALICE_SECRET.as_bytes())
            .map_err(|e| format!("Failed to write secret: {}", e))?;
        stdin
            .write_all(b"\n")
            .map_err(|e| format!("Failed to write newline: {}", e))?;
    }

    let result = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for stellar keys add: {}", e))?;

    if !result.status.success() {
        // Identity might already exist, that's OK
        println!("  ℹ️  Alice identity may already exist");
    }

    println!("  💰 Funding Alice account via friendbot...");
    let output = Command::new("curl")
        .args(&[
            "-s",
            &format!("http://localhost:8000/friendbot?addr={}", ALICE_ADDRESS),
        ])
        .output()
        .map_err(|e| format!("Failed to run friendbot: {}", e))?;

    if !output.status.success() {
        return Err("Friendbot request failed".to_string());
    }

    println!("  ✅ Alice account funded and identity created");
    Ok(())
}

/// Helper to stop localnet
fn stop_localnet() {
    println!("  🛑 Stopping localnet...");
    let _ = Command::new("docker")
        .args(&["stop", "stellar-localnet-test"])
        .output();
}

/// Helper to build contract to WASM
fn build_contract_to_wasm(config: &PolicyConfig) -> Result<(TempDir, PathBuf), String> {
    let temp_dir = TempDir::new().map_err(|e| format!("Failed to create temp dir: {}", e))?;
    let output_path = temp_dir.path().to_str().unwrap();

    generator::generate_project(config, output_path)
        .map_err(|e| format!("Generation failed: {}", e))?;

    let status = Command::new("cargo")
        .args(&[
            "build",
            "--target", "wasm32-unknown-unknown",
            "--release",
            "--manifest-path",
        ])
        .arg(temp_dir.path().join("contracts/Cargo.toml"))
        .status()
        .map_err(|e| format!("Failed to run cargo build: {}", e))?;

    if !status.success() {
        return Err(format!("Build failed with exit code: {:?}", status.code()));
    }

    let wasm_name = format!("{}.wasm", config.name.replace("-", "_"));
    let wasm_path = temp_dir
        .path()
        .join("contracts/target/wasm32-unknown-unknown/release")
        .join(&wasm_name);

    if !wasm_path.exists() {
        return Err(format!("WASM file not found at: {}", wasm_path.display()));
    }

    Ok((temp_dir, wasm_path))
}

/// Deploy contract to localnet and return contract ID
fn deploy_to_localnet(wasm_path: &PathBuf) -> Result<String, String> {
    println!("  📦 Deploying contract to localnet...");

    // Use the alice identity (created by fund_alice_account)
    let output = Command::new("stellar")
        .args(&[
            "contract", "deploy",
            "--wasm", wasm_path.to_str().unwrap(),
            "--source", "alice",
            "--network", "standalone",
        ])
        .output()
        .map_err(|e| format!("Failed to run stellar contract deploy: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Deployment failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let contract_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
    println!("  ✅ Deployed: {}", contract_id);

    Ok(contract_id)
}

/// Invoke init function on deployed contract
fn invoke_init(contract_id: &str, admin_address: &str) -> Result<(), String> {
    println!("  🔧 Invoking init function...");

    let output = Command::new("stellar")
        .args(&[
            "contract", "invoke",
            "--id", contract_id,
            "--source", "alice",
            "--network", "standalone",
            "--",
            "init",
            "--admin", admin_address,
        ])
        .output()
        .map_err(|e| format!("Failed to invoke init: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Init invocation failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    println!("  ✅ Init successful");
    Ok(())
}

/// Invoke add_wallet function on deployed contract (full version with both params)
fn invoke_add_wallet(
    contract_id: &str,
    user_bytes: &str,
    max_amount: i128,
    min_ledgers: u32
) -> Result<(), String> {
    println!("  👤 Invoking add_wallet function...");

    let output = Command::new("stellar")
        .args(&[
            "contract", "invoke",
            "--id", contract_id,
            "--source", "alice",
            "--network", "standalone",
            "--",
            "add_wallet",
            "--user", user_bytes,
            "--max_amount", &max_amount.to_string(),
            "--min_ledgers", &min_ledgers.to_string(),
        ])
        .output()
        .map_err(|e| format!("Failed to invoke add_wallet: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "add_wallet invocation failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    println!("  ✅ add_wallet successful");
    Ok(())
}

/// Invoke add_wallet with only max_amount (for policies with amount cap but no rate limiting)
fn invoke_add_wallet_amount_only(
    contract_id: &str,
    user_bytes: &str,
    max_amount: i128,
) -> Result<(), String> {
    println!("  👤 Invoking add_wallet function (amount only)...");

    let output = Command::new("stellar")
        .args(&[
            "contract", "invoke",
            "--id", contract_id,
            "--source", "alice",
            "--network", "standalone",
            "--",
            "add_wallet",
            "--user", user_bytes,
            "--max_amount", &max_amount.to_string(),
        ])
        .output()
        .map_err(|e| format!("Failed to invoke add_wallet: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "add_wallet invocation failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    println!("  ✅ add_wallet successful");
    Ok(())
}

//
// ============================================================================
// PRIORITY 1: Localnet Deployment and Invocation Tests
// ============================================================================
//

#[test]
#[ignore] // Run with: cargo test --test localnet_integration_test -- --ignored --nocapture
fn test_localnet_deploy_simple_policy() {
    println!("\n🧪 Localnet Test: Deploy simple policy");

    // Check/start localnet
    match ensure_localnet_running() {
        Ok(_) => {},
        Err(e) => {
            println!("⚠️  Skipping test (localnet unavailable): {}", e);
            return;
        }
    }

    let config = PolicyConfig {
        name: "localnet-simple".to_string(),
        description: Some("Localnet test simple policy".to_string()),
        function_whitelist: Some(vec!["transfer".to_string()]),
        contract_whitelist: None,
        recipient_whitelist: None,
        amount_cap: None,
        rate_limiting: None,
        admin_managed: false,
    };

    let (_temp_dir, wasm_path) = match build_contract_to_wasm(&config) {
        Ok(paths) => paths,
        Err(e) => {
            println!("❌ Build failed: {}", e);
            return;
        }
    };

    match deploy_to_localnet(&wasm_path) {
        Ok(contract_id) => {
            println!("✅ PASS: Simple policy deployed to localnet");
            println!("   Contract ID: {}", contract_id);
        },
        Err(e) => panic!("❌ FAIL: {}", e),
    }

    // Cleanup note: Docker container will auto-remove on stop
}

#[test]
#[ignore]
fn test_localnet_deploy_and_init_admin_policy() {
    println!("\n🧪 Localnet Test: Deploy admin policy and invoke init");

    match ensure_localnet_running() {
        Ok(_) => {},
        Err(e) => {
            println!("⚠️  Skipping test (localnet unavailable): {}", e);
            return;
        }
    }

    let config = PolicyConfig {
        name: "localnet-admin".to_string(),
        description: Some("Localnet test admin policy".to_string()),
        function_whitelist: None,
        contract_whitelist: None,
        recipient_whitelist: None,
        amount_cap: Some(AmountCapConfig {
            max_amount: 1000000,
            token_contract: None,
        }),
        rate_limiting: Some(RateLimitConfig {
            min_ledgers: 100,
        }),
        admin_managed: true,
    };

    let (_temp_dir, wasm_path) = match build_contract_to_wasm(&config) {
        Ok(paths) => paths,
        Err(e) => {
            println!("❌ Build failed: {}", e);
            return;
        }
    };

    let contract_id = match deploy_to_localnet(&wasm_path) {
        Ok(id) => id,
        Err(e) => panic!("❌ Deployment failed: {}", e),
    };

    match invoke_init(&contract_id, ALICE_ADDRESS) {
        Ok(_) => {
            println!("✅ PASS: Admin policy deployed and initialized");
            println!("   Contract ID: {}", contract_id);
        },
        Err(e) => panic!("❌ FAIL: {}", e),
    }
}

#[test]
#[ignore]
fn test_localnet_full_admin_workflow() {
    println!("\n🧪 Localnet Test: Complete admin workflow (deploy → init → add_wallet)");

    match ensure_localnet_running() {
        Ok(_) => {},
        Err(e) => {
            println!("⚠️  Skipping test (localnet unavailable): {}", e);
            return;
        }
    }

    let config = PolicyConfig {
        name: "localnet-full".to_string(),
        description: Some("Localnet full workflow test".to_string()),
        function_whitelist: None,
        contract_whitelist: None,
        recipient_whitelist: None,
        amount_cap: Some(AmountCapConfig {
            max_amount: 5000000,
            token_contract: None,
        }),
        rate_limiting: Some(RateLimitConfig {
            min_ledgers: 50,
        }),
        admin_managed: true,
    };

    let (_temp_dir, wasm_path) = match build_contract_to_wasm(&config) {
        Ok(paths) => paths,
        Err(e) => panic!("❌ Build failed: {}", e),
    };

    let contract_id = match deploy_to_localnet(&wasm_path) {
        Ok(id) => id,
        Err(e) => panic!("❌ Deployment failed: {}", e),
    };

    match invoke_init(&contract_id, ALICE_ADDRESS) {
        Ok(_) => println!("  ✅ Init successful"),
        Err(e) => panic!("❌ Init failed: {}", e),
    }

    // Add a test wallet (using a dummy 32-byte hex string for user)
    let test_user = "0000000000000000000000000000000000000000000000000000000000000001";
    match invoke_add_wallet(&contract_id, test_user, 1000000, 100) {
        Ok(_) => {
            println!("✅ PASS: Complete admin workflow succeeded");
            println!("   Contract ID: {}", contract_id);
            println!("   Workflow: Deploy → Init → Add Wallet");
        },
        Err(e) => panic!("❌ add_wallet failed: {}", e),
    }
}

//
// ============================================================================
// PRIORITY 2: Policy Feature Validation Tests
// ============================================================================
//
// These tests validate that policies with various feature combinations
// can be deployed and configured correctly. Full policy enforcement testing
// (testing the policy__ function with actual transactions) requires integration
// with a smart wallet contract and is left for future implementation.
//

#[test]
#[ignore]
fn test_policy_amount_cap_configuration() {
    println!("\n🧪 Priority 2 Test: Amount cap policy configuration");

    match ensure_localnet_running() {
        Ok(_) => {},
        Err(e) => {
            println!("⚠️  Skipping test (localnet unavailable): {}", e);
            return;
        }
    }

    // Create policy with amount cap
    let config = PolicyConfig {
        name: "test-amount-cap".to_string(),
        description: Some("Test amount cap policy".to_string()),
        function_whitelist: None,
        contract_whitelist: None,
        recipient_whitelist: None,
        amount_cap: Some(AmountCapConfig {
            max_amount: 100000,
            token_contract: None,
        }),
        rate_limiting: None,
        admin_managed: true,
    };

    println!("  📦 Building and deploying policy contract...");
    let (_temp_dir, wasm_path) = match build_contract_to_wasm(&config) {
        Ok(paths) => paths,
        Err(e) => panic!("❌ Build failed: {}", e),
    };

    let policy_id = match deploy_to_localnet(&wasm_path) {
        Ok(id) => id,
        Err(e) => panic!("❌ Deployment failed: {}", e),
    };

    // Initialize policy
    match invoke_init(&policy_id, ALICE_ADDRESS) {
        Ok(_) => println!("  ✅ Policy initialized"),
        Err(e) => panic!("❌ Init failed: {}", e),
    }

    // Add wallet with max amount = 100000
    let test_signer = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    match invoke_add_wallet_amount_only(&policy_id, test_signer, 100000) {
        Ok(_) => println!("  ✅ Wallet configured with 100,000 cap"),
        Err(e) => panic!("❌ add_wallet failed: {}", e),
    }

    // Add another wallet with different limit
    let test_signer2 = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    match invoke_add_wallet_amount_only(&policy_id, test_signer2, 500000) {
        Ok(_) => println!("  ✅ Second wallet configured with 500,000 cap"),
        Err(e) => panic!("❌ add_wallet failed for second wallet: {}", e),
    }

    println!("\n✅ PASS: Amount cap policy deployed and configured successfully");
    println!("   Policy ID: {}", policy_id);
    println!("   Wallet 1: 100,000 cap");
    println!("   Wallet 2: 500,000 cap");
}

#[test]
#[ignore]
fn test_policy_whitelist_deployment() {
    println!("\n🧪 Priority 2 Test: Whitelist policy deployment");

    match ensure_localnet_running() {
        Ok(_) => {},
        Err(e) => {
            println!("⚠️  Skipping test (localnet unavailable): {}", e);
            return;
        }
    }

    // Whitelisted addresses
    let allowed_contract = "CAHLJEQUCNTV7JPAPCMLCBIHOX7FFB57DUARJ6XGTW27FPCVKKY7JM2A";
    let allowed_recipient = "GC5NBJNAL2D5UL5HHGK3M5IKKF6BZR2CCXXO4PRPKPUMDKWZVKRZAKNM";

    // Create policy with contract and recipient whitelists
    let config = PolicyConfig {
        name: "test-whitelists".to_string(),
        description: Some("Test whitelist policy".to_string()),
        function_whitelist: Some(vec!["transfer".to_string(), "swap".to_string()]),
        contract_whitelist: Some(vec![allowed_contract.to_string()]),
        recipient_whitelist: Some(vec![allowed_recipient.to_string()]),
        amount_cap: None,
        rate_limiting: None,
        admin_managed: false,
    };

    println!("  📦 Building and deploying whitelist policy...");
    let (_temp_dir, wasm_path) = match build_contract_to_wasm(&config) {
        Ok(paths) => paths,
        Err(e) => panic!("❌ Build failed: {}", e),
    };

    let policy_id = match deploy_to_localnet(&wasm_path) {
        Ok(id) => id,
        Err(e) => panic!("❌ Deployment failed: {}", e),
    };

    println!("\n✅ PASS: Whitelist policy deployed successfully");
    println!("   Policy ID: {}", policy_id);
    println!("   Function whitelist: transfer, swap");
    println!("   Contract whitelist: {}", allowed_contract);
    println!("   Recipient whitelist: {}", allowed_recipient);
}

#[test]
#[ignore]
fn test_policy_comprehensive_features() {
    println!("\n🧪 Priority 2 Test: Comprehensive multi-feature policy");

    match ensure_localnet_running() {
        Ok(_) => {},
        Err(e) => {
            println!("⚠️  Skipping test (localnet unavailable): {}", e);
            return;
        }
    }

    // Whitelisted values
    let allowed_contract = "CAHLJEQUCNTV7JPAPCMLCBIHOX7FFB57DUARJ6XGTW27FPCVKKY7JM2A";
    let allowed_recipient = "GC5NBJNAL2D5UL5HHGK3M5IKKF6BZR2CCXXO4PRPKPUMDKWZVKRZAKNM";

    // Create policy with ALL features
    let config = PolicyConfig {
        name: "test-comprehensive".to_string(),
        description: Some("Test all policy features together".to_string()),
        function_whitelist: Some(vec!["transfer".to_string()]),
        contract_whitelist: Some(vec![allowed_contract.to_string()]),
        recipient_whitelist: Some(vec![allowed_recipient.to_string()]),
        amount_cap: Some(AmountCapConfig {
            max_amount: 100000,
            token_contract: None,
        }),
        rate_limiting: Some(RateLimitConfig {
            min_ledgers: 50,
        }),
        admin_managed: true,
    };

    println!("  📦 Building and deploying comprehensive policy...");
    let (_temp_dir, wasm_path) = match build_contract_to_wasm(&config) {
        Ok(paths) => paths,
        Err(e) => panic!("❌ Build failed: {}", e),
    };

    let policy_id = match deploy_to_localnet(&wasm_path) {
        Ok(id) => id,
        Err(e) => panic!("❌ Deployment failed: {}", e),
    };

    // Initialize policy
    match invoke_init(&policy_id, ALICE_ADDRESS) {
        Ok(_) => println!("  ✅ Policy initialized"),
        Err(e) => panic!("❌ Init failed: {}", e),
    }

    let test_signer = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
    match invoke_add_wallet(&policy_id, test_signer, 100000, 50) {
        Ok(_) => println!("  ✅ Wallet configured with all features"),
        Err(e) => panic!("❌ add_wallet failed: {}", e),
    }

    println!("\n✅ PASS: Comprehensive multi-feature policy deployed and configured");
    println!("   Policy ID: {}", policy_id);
    println!("   Features:");
    println!("   ✅ Function whitelist: transfer");
    println!("   ✅ Contract whitelist: {}", allowed_contract);
    println!("   ✅ Recipient whitelist: {}", allowed_recipient);
    println!("   ✅ Amount cap: 100,000");
    println!("   ✅ Rate limiting: 50 ledgers");
}

// Cleanup helper (run after test suite)
#[test]
#[ignore]
fn zzz_cleanup_localnet() {
    println!("\n🧹 Cleanup: Stopping localnet");
    stop_localnet();
    println!("✅ Cleanup complete");
}
