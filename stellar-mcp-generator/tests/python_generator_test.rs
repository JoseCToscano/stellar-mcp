use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;

#[test]
fn test_python_generator_creates_lib_directory() {
    // Create a temporary directory for the test
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let _output_path = temp_dir.path().join("test-python-mcp");

    // Run the generator (this would need to be mocked or use a real contract)
    // For now, we'll just test the template structure exists

    // Verify lib templates exist
    let lib_init = PathBuf::from("templates/python/lib/__init__.py.hbs");
    let lib_utils = PathBuf::from("templates/python/lib/utils.py.hbs");
    let lib_submit = PathBuf::from("templates/python/lib/submit.py.hbs");

    assert!(lib_init.exists(), "lib/__init__.py.hbs template should exist");
    assert!(lib_utils.exists(), "lib/utils.py.hbs template should exist");
    assert!(lib_submit.exists(), "lib/submit.py.hbs template should exist");
}

#[test]
fn test_lib_utils_contains_sign_transaction() {
    let utils_content = fs::read_to_string("templates/python/lib/utils.py.hbs")
        .expect("Failed to read utils.py.hbs");

    assert!(utils_content.contains("async def sign_transaction"),
        "utils.py should contain sign_transaction function");
    assert!(utils_content.contains("secret_key: Optional[str]"),
        "sign_transaction should accept optional secret_key");
    assert!(utils_content.contains("SIGNER_SECRET"),
        "Should check SIGNER_SECRET environment variable");
    assert!(utils_content.contains("TransactionEnvelope"),
        "Should use stellar_sdk TransactionEnvelope");
}

#[test]
fn test_lib_submit_contains_submit_transaction() {
    let submit_content = fs::read_to_string("templates/python/lib/submit.py.hbs")
        .expect("Failed to read submit.py.hbs");

    assert!(submit_content.contains("async def submit_transaction"),
        "submit.py should contain submit_transaction function");
    assert!(submit_content.contains("SorobanServer"),
        "Should use SorobanServer");
    assert!(submit_content.contains("for attempt in range(60)"),
        "Should poll 60 times for transaction result");
    assert!(submit_content.contains("await asyncio.sleep(0.5)"),
        "Should sleep 500ms between polls");
}

#[test]
fn test_server_template_has_sign_and_submit_tool() {
    let server_content = fs::read_to_string("templates/python/server.py.hbs")
        .expect("Failed to read server.py.hbs");

    assert!(server_content.contains("async def sign_and_submit"),
        "server.py should contain sign_and_submit function");
    assert!(server_content.contains("@mcp.tool()"),
        "sign_and_submit should be decorated as MCP tool");
    assert!(server_content.contains("from src.lib.utils import sign_transaction"),
        "Should import sign_transaction from lib");
    assert!(server_content.contains("from src.lib.submit import submit_transaction"),
        "Should import submit_transaction from lib");
}

#[test]
fn test_contract_client_integrates_bindings() {
    let client_content = fs::read_to_string("templates/python/contract_client.py.hbs")
        .expect("Failed to read contract_client.py.hbs");

    assert!(client_content.contains("from .bindings.bindings import ClientAsync"),
        "Should import ClientAsync from generated bindings");
    assert!(client_content.contains("self.client = GeneratedClient"),
        "Should initialize GeneratedClient");
    assert!(client_content.contains("assembled = await self.client"),
        "Should call client methods and get AssembledTransaction");
    assert!(!client_content.contains("NotImplementedError"),
        "Should not contain NotImplementedError stubs");
}

#[test]
fn test_readme_documents_limitations() {
    let readme_content = fs::read_to_string("templates/python/README.md.hbs")
        .expect("Failed to read README.md.hbs");

    assert!(readme_content.contains("## Limitations"),
        "README should have Limitations section");
    assert!(readme_content.contains("PasskeyKit"),
        "Should mention PasskeyKit limitation");
    assert!(readme_content.contains("sign_and_submit"),
        "Should document sign_and_submit tool");
    assert!(readme_content.contains("secret key signing"),
        "Should mention secret key signing support");
}

#[test]
fn test_lib_init_exports_functions() {
    let init_content = fs::read_to_string("templates/python/lib/__init__.py.hbs")
        .expect("Failed to read lib/__init__.py.hbs");

    assert!(init_content.contains("from .utils import sign_transaction"),
        "Should export sign_transaction");
    assert!(init_content.contains("from .submit import submit_transaction"),
        "Should export submit_transaction");
    assert!(init_content.contains("__all__"),
        "Should define __all__ for explicit exports");
}
