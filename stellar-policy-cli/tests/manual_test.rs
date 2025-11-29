//! Manual test to generate and inspect policies

use stellar_policy_cli::types::*;
use stellar_policy_cli::generator;

#[test]
fn manual_generate_simple_policy() {
    let config = PolicyConfig {
        name: "simple-test".to_string(),
        description: Some("Test simple policy".to_string()),
        function_whitelist: Some(vec!["transfer".to_string()]),
        contract_whitelist: None,
        recipient_whitelist: None,
        amount_cap: None,
        rate_limiting: None,
        admin_managed: false,
    };

    let output_dir = "/tmp/simple-test-policy";

    // Clean up if exists
    let _ = std::fs::remove_dir_all(output_dir);

    let result = generator::generate_project(&config, output_dir);
    assert!(result.is_ok(), "Generation failed: {:?}", result.err());

    // Read the generated lib.rs
    let lib_rs_path = format!("{}/contracts/simple-test/src/lib.rs", output_dir);
    let lib_rs = std::fs::read_to_string(&lib_rs_path).unwrap();

    println!("========== GENERATED LIB.RS ==========");
    println!("{}", lib_rs);
    println!("========================================");

    // Keep the directory for manual inspection
    println!("\n✅ Generated project at: {}", output_dir);
    println!("   Inspect with: cat {}/contracts/simple-test/src/lib.rs\n", output_dir);
}
