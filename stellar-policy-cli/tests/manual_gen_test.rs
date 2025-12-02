//! Manual test to generate a full-featured policy to a permanent location for review
#![allow(dead_code)]

use stellar_policy_cli::types::*;
use stellar_policy_cli::generator;

#[test]
#[ignore]
fn generate_full_featured_policy_for_review() {
    let config = PolicyConfig {
        name: "review-policy".to_string(),
        description: Some("Full-featured policy for code review".to_string()),
        function_whitelist: Some(vec!["transfer".to_string(), "swap".to_string(), "approve".to_string()]),
        contract_whitelist: Some(vec!["CAHLJEQUCNTV7JPAPCMLCBIHOX7FFB57DUARJ6XGTW27FPCVKKY7JM2A".to_string()]),
        recipient_whitelist: Some(vec!["GCURS4DFNCY5BHXG5L4H2BDJD6TEOKMZMDH6FKJHRUIRDLXCJNML3NJO".to_string()]),
        amount_cap: Some(AmountCapConfig {
            max_amount: 1000000,
            token_contract: None,
        }),
        rate_limiting: Some(RateLimitConfig {
            min_ledgers: 100,
        }),
        admin_managed: true,
    };

    let output_path = "/tmp/review-policy-output";
    std::fs::create_dir_all(output_path).unwrap();

    generator::generate_project(&config, output_path).expect("Failed to generate");
    
    println!("\n✅ Generated full-featured policy at: {}/contracts/review-policy/src/lib.rs", output_path);
    println!("📄 Also check types.rs at: {}/contracts/review-policy/src/types.rs", output_path);
}
