//! Python MCP Server generator implementation

use super::pydantic_schemas;
use super::template_data::*;
use crate::commands::generate::GenerateArgs;
use crate::spec::ContractSpec;
use crate::NetworkConfig;
use handlebars::Handlebars;
use std::fs;
use std::path::Path;

/// Python MCP Server generator
pub struct PythonGenerator<'a> {
    output_dir: &'a Path,
    contract_name: &'a str,
    server_name: &'a str,
    contract_id: &'a str,
    network: &'a NetworkConfig,
}

impl<'a> PythonGenerator<'a> {
    /// Create a new Python generator
    pub fn new(
        output_dir: &'a Path,
        contract_name: &'a str,
        server_name: &'a str,
        contract_id: &'a str,
        network: &'a NetworkConfig,
    ) -> Self {
        Self {
            output_dir,
            contract_name,
            server_name,
            contract_id,
            network,
        }
    }

    /// Generate the Python MCP server
    pub fn generate(
        &self,
        spec: &ContractSpec,
        _args: &GenerateArgs,
    ) -> Result<(), Box<dyn std::error::Error>> {
        println!("  Generating Python MCP server...");

        // Create directory structure
        self.create_directories()?;

        // Generate official Stellar Python bindings first
        self.generate_official_bindings()?;

        // Generate Python files
        self.generate_schemas_py(spec)?;
        self.generate_server_py(spec)?;
        self.generate_contract_client(spec)?;
        self.generate_init_py()?;
        self.generate_lib_files()?;
        self.generate_pyproject_toml()?;
        self.generate_env_example()?;
        self.generate_readme(spec)?;

        println!("  Python MCP server generated!");
        println!();
        println!("  Next steps:");
        println!("    1. cd {}", self.output_dir.display());
        println!("    2. uv sync  # Install dependencies");
        println!("    3. cp .env.example .env && edit .env");
        println!("    4. uv run mcp install server.py");

        Ok(())
    }

    fn create_directories(&self) -> Result<(), Box<dyn std::error::Error>> {
        fs::create_dir_all(self.output_dir.join("src"))?;
        fs::create_dir_all(self.output_dir.join("src/bindings"))?;
        fs::create_dir_all(self.output_dir.join("src/lib"))?;
        Ok(())
    }

    /// Generate official Stellar Python bindings using stellar-contract-bindings CLI
    fn generate_official_bindings(&self) -> Result<(), Box<dyn std::error::Error>> {
        use std::process::Command;

        println!("  Generating official Stellar Python bindings...");

        let bindings_dir = self.output_dir.join("src/bindings");

        // Try to call stellar-contract-bindings python
        let output = Command::new("stellar-contract-bindings")
            .arg("python")
            .arg("--contract-id")
            .arg(self.contract_id)
            .arg("--rpc-url")
            .arg(&self.network.rpc_url)
            .arg("--output")
            .arg(&bindings_dir)
            .output();

        match output {
            Ok(result) => {
                if !result.status.success() {
                    let stderr = String::from_utf8_lossy(&result.stderr);

                    // Check if it's a "command not found" type error
                    if stderr.contains("not found") || stderr.contains("No such file") {
                        return Err(self.bindings_not_installed_error());
                    }

                    return Err(format!("Failed to generate Stellar bindings: {}", stderr).into());
                }
                println!("  ✓ Generated official bindings in src/bindings/");
                Ok(())
            }
            Err(e) => {
                // Command failed to execute (likely not installed)
                if e.kind() == std::io::ErrorKind::NotFound {
                    Err(self.bindings_not_installed_error())
                } else {
                    Err(format!("Failed to execute stellar-contract-bindings: {}", e).into())
                }
            }
        }
    }

    fn bindings_not_installed_error(&self) -> Box<dyn std::error::Error> {
        let msg = format!(
            "\n❌ stellar-contract-bindings is not installed!\n\n\
            The Python generator requires the 'stellar-contract-bindings' package.\n\n\
            Install it with:\n\
            \n\
            Option 1 (using pip):\n\
              pip install stellar-contract-bindings\n\
            \n\
            Option 2 (using uv - recommended):\n\
              uv pip install stellar-contract-bindings\n\
            \n\
            Then run the generator again.\n\
            \n\
            Alternatively, you can generate bindings manually after generation:\n\
              stellar-contract-bindings python \\\n\
                --contract-id {} \\\n\
                --rpc-url {} \\\n\
                --output ./src/bindings\n",
            self.contract_id,
            self.network.rpc_url
        );
        msg.into()
    }

    fn generate_server_py(&self, spec: &ContractSpec) -> Result<(), Box<dyn std::error::Error>> {
        let template = include_str!("../../templates/python/server.py.hbs");
        let data = self.create_template_data(spec)?;

        let mut hbs = Handlebars::new();
        hbs.register_template_string("server", template)?;

        let output = hbs.render("server", &data)?;
        fs::write(self.output_dir.join("server.py"), output)?;

        Ok(())
    }

    fn generate_contract_client(&self, spec: &ContractSpec) -> Result<(), Box<dyn std::error::Error>> {
        let template = include_str!("../../templates/python/contract_client.py.hbs");
        let data = self.create_template_data(spec)?;

        let mut hbs = Handlebars::new();
        hbs.register_template_string("client", template)?;

        let output = hbs.render("client", &data)?;
        fs::write(self.output_dir.join("src/contract_client.py"), output)?;

        Ok(())
    }

    fn generate_init_py(&self) -> Result<(), Box<dyn std::error::Error>> {
        let template = include_str!("../../templates/python/init.py.hbs");
        let data = serde_json::json!({
            "contract_name": self.contract_name,
        });

        let mut hbs = Handlebars::new();
        hbs.register_template_string("init", template)?;

        let output = hbs.render("init", &data)?;
        fs::write(self.output_dir.join("src/__init__.py"), output)?;

        Ok(())
    }

    fn generate_schemas_py(&self, spec: &ContractSpec) -> Result<(), Box<dyn std::error::Error>> {
        // Generate Pydantic schemas
        let schemas_content = pydantic_schemas::generate_pydantic_schemas(spec);

        // Generate conversion helpers
        let conversions_content = pydantic_schemas::generate_conversion_helpers(spec);

        // Combine both
        let output = format!("{}\n{}", schemas_content, conversions_content);

        fs::write(self.output_dir.join("src/schemas.py"), output)?;

        Ok(())
    }

    fn generate_pyproject_toml(&self) -> Result<(), Box<dyn std::error::Error>> {
        let template = include_str!("../../templates/python/pyproject.toml.hbs");
        let data = serde_json::json!({
            "contract_name": self.contract_name,
            "package_name": to_python_package_name(self.contract_name),
        });

        let mut hbs = Handlebars::new();
        hbs.register_template_string("pyproject", template)?;

        let output = hbs.render("pyproject", &data)?;
        fs::write(self.output_dir.join("pyproject.toml"), output)?;

        Ok(())
    }

    fn generate_env_example(&self) -> Result<(), Box<dyn std::error::Error>> {
        let template = include_str!("../../templates/python/env.example.hbs");
        let data = serde_json::json!({
            "contract_id": self.contract_id,
            "rpc_url": self.network.rpc_url,
            "network_passphrase": self.network.network_passphrase,
        });

        let mut hbs = Handlebars::new();
        hbs.register_template_string("env", template)?;

        let output = hbs.render("env", &data)?;
        fs::write(self.output_dir.join(".env.example"), output)?;

        Ok(())
    }

    fn generate_readme(&self, spec: &ContractSpec) -> Result<(), Box<dyn std::error::Error>> {
        let template = include_str!("../../templates/python/README.md.hbs");
        let data = self.create_template_data(spec)?;

        let mut hbs = Handlebars::new();
        hbs.register_template_string("readme", template)?;

        let output = hbs.render("readme", &data)?;
        fs::write(self.output_dir.join("README.md"), output)?;

        Ok(())
    }

    fn generate_lib_files(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Generate lib/__init__.py
        let init_template = include_str!("../../templates/python/lib/__init__.py.hbs");
        fs::write(self.output_dir.join("src/lib/__init__.py"), init_template)?;

        // Generate lib/utils.py
        let utils_template = include_str!("../../templates/python/lib/utils.py.hbs");
        fs::write(self.output_dir.join("src/lib/utils.py"), utils_template)?;

        // Generate lib/submit.py
        let submit_template = include_str!("../../templates/python/lib/submit.py.hbs");
        fs::write(self.output_dir.join("src/lib/submit.py"), submit_template)?;

        Ok(())
    }

    fn create_template_data(&self, spec: &ContractSpec) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        let functions: Vec<_> = spec.functions.iter().map(|f| {
            let inputs: Vec<_> = f.inputs.iter().map(|input| {
                let is_custom_type = matches!(input.type_ref, crate::spec::TypeRef::Custom(_));
                let custom_type_name = if let crate::spec::TypeRef::Custom(name) = &input.type_ref {
                    Some(name.clone())
                } else {
                    None
                };

                serde_json::json!({
                    "name": input.name,
                    "name_snake": to_snake_case(&input.name),
                    "py_type": map_type_to_python(&input.type_ref),
                    "pydantic_type": input.type_ref.to_pydantic(),
                    "doc": input.doc.as_deref().unwrap_or(""),
                    "is_custom_type": is_custom_type,
                    "custom_type_name": custom_type_name,
                    "conversion_function": custom_type_name.as_ref().map(|name| format!("{}_to_bindings", name.to_lowercase())),
                })
            }).collect();

            serde_json::json!({
                "name": f.name,
                "name_snake": to_snake_case(&f.name),
                "doc": f.doc.as_deref().unwrap_or(""),
                "inputs": inputs,
                "has_inputs": !f.inputs.is_empty(),
            })
        }).collect();

        Ok(serde_json::json!({
            "contract_name": self.contract_name,
            "package_name": to_python_package_name(self.contract_name),
            "contract_id": self.contract_id,
            "server_name": self.server_name,
            "network_name": self.network.name,
            "rpc_url": self.network.rpc_url,
            "network_passphrase": self.network.network_passphrase,
            "functions": functions,
            "version": env!("CARGO_PKG_VERSION"),
        }))
    }
}

/// Convert string to snake_case
fn to_snake_case(s: &str) -> String {
    let mut result = String::new();
    let mut prev_is_lower = false;

    for (i, c) in s.chars().enumerate() {
        if c.is_uppercase() {
            if i > 0 && prev_is_lower {
                result.push('_');
            }
            result.push(c.to_ascii_lowercase());
            prev_is_lower = false;
        } else {
            result.push(c);
            prev_is_lower = c.is_lowercase();
        }
    }

    result
}

/// Convert string to Python package name (PEP 508 compliant)
/// Replaces spaces and invalid characters with hyphens, converts to lowercase
fn to_python_package_name(s: &str) -> String {
    let mut result = String::new();
    let mut prev_was_separator = false;

    for c in s.chars() {
        if c.is_alphanumeric() {
            result.push(c.to_ascii_lowercase());
            prev_was_separator = false;
        } else if !prev_was_separator {
            // Replace any non-alphanumeric character (including spaces) with hyphen
            result.push('-');
            prev_was_separator = true;
        }
    }

    // Remove leading/trailing hyphens
    result.trim_matches('-').to_string()
}

/// Map Soroban type to Python type hint
/// For MCP tool signatures, we need types that Pydantic can generate JSON Schema for.
/// Custom types (dataclasses from stellar-contract-bindings) can't be used directly,
/// so we use Dict[str, Any] and convert them in the function body.
fn map_type_to_python(type_ref: &crate::spec::TypeRef) -> String {
    use crate::spec::TypeRef;

    match type_ref {
        TypeRef::U32 | TypeRef::I32 | TypeRef::U64 | TypeRef::I64
        | TypeRef::U128 | TypeRef::I128 | TypeRef::U256 | TypeRef::I256 => "int".to_string(),
        TypeRef::Bool => "bool".to_string(),
        TypeRef::String | TypeRef::Symbol => "str".to_string(),
        TypeRef::Address => "str".to_string(), // Address as string
        TypeRef::Bytes | TypeRef::BytesN(_) => "bytes".to_string(),
        TypeRef::Vec(inner) => {
            // Check if inner type is custom (complex type)
            if matches!(inner.as_ref(), TypeRef::Custom(_)) {
                "List[Dict[str, Any]]".to_string()
            } else {
                format!("List[{}]", map_type_to_python(inner))
            }
        }
        TypeRef::Option(inner) => {
            // Check if inner type is custom (complex type)
            if matches!(inner.as_ref(), TypeRef::Custom(_)) {
                "Optional[Dict[str, Any]]".to_string()
            } else {
                format!("Optional[{}]", map_type_to_python(inner))
            }
        }
        TypeRef::Map { key, value } => format!("Dict[{}, {}]", map_type_to_python(key), map_type_to_python(value)),
        TypeRef::Tuple(types) => {
            let type_strs: Vec<_> = types.iter().map(|t| map_type_to_python(t)).collect();
            format!("Tuple[{}]", type_strs.join(", "))
        }
        // Custom types (structs/enums from contract) → use Dict for Pydantic compatibility
        // The convert_mcp_params helper will handle conversion to actual dataclass types
        TypeRef::Custom(_name) => "Dict[str, Any]".to_string(),
        _ => "Any".to_string(), // Fallback
    }
}
