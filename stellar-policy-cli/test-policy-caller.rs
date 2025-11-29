// This is a helper to test if we can invoke policy__ with stellar CLI
// Let's try to manually craft the command to see what format works

use std::process::Command;

fn main() {
    let policy_id = "CAUTLLVWBRLDDT7FIYMZNNAYRKMMPP3MEUJCQLMFOI7KUEK7NKVBJLGV"; // From our test
    let alice = "GBAOLK457RDF3AFRQA3LWD3OZTWUNGSUK4JDAIFBLX5TS5IB5YL5V6OH";
    
    // Try with --help first to see the expected format
    let help_output = Command::new("stellar")
        .args(&[
            "contract", "invoke",
            "--id", policy_id,
            "--network", "standalone",
            "--",
            "policy__",
            "--help"
        ])
        .output()
        .expect("Failed to run help");
    
    println!("Policy__ help:");
    println!("{}", String::from_utf8_lossy(&help_output.stdout));
    println!("{}", String::from_utf8_lossy(&help_output.stderr));
}
