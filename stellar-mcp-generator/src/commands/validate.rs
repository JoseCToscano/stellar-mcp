//! Validate command - validates a generated MCP server

use clap::Parser;
use std::path::PathBuf;

/// Arguments for the validate command
#[derive(Parser, Debug)]
pub struct ValidateArgs {
    /// Path to the generated MCP server directory
    #[arg(default_value = "./mcp-server")]
    pub path: PathBuf,

    /// Run type checking with tsc
    #[arg(long)]
    pub typecheck: bool,

    /// Check if dependencies are installed
    #[arg(long)]
    pub check_deps: bool,

    /// Try to build the project
    #[arg(long)]
    pub build: bool,
}

/// Execute the validate command
pub async fn execute(args: ValidateArgs) -> Result<(), Box<dyn std::error::Error>> {
    println!("Validating MCP server at: {}", args.path.display());

    // Check if directory exists
    if !args.path.exists() {
        return Err(format!("Directory '{}' does not exist", args.path.display()).into());
    }

    // Check required files
    let required_files = vec![
        "package.json",
        "tsconfig.json",
        "src/index.ts",
        ".env.example",
    ];

    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    for file in required_files {
        let file_path = args.path.join(file);
        if !file_path.exists() {
            errors.push(format!("Missing required file: {}", file));
        }
    }

    // Check optional files
    let optional_files = vec!["vercel.json", "README.md", ".github/workflows/deploy.yml"];

    for file in optional_files {
        let file_path = args.path.join(file);
        if !file_path.exists() {
            warnings.push(format!("Missing optional file: {}", file));
        }
    }

    // Check package.json for required dependencies
    let package_json_path = args.path.join("package.json");
    if package_json_path.exists() {
        let content = std::fs::read_to_string(&package_json_path)?;
        let package: serde_json::Value = serde_json::from_str(&content)?;

        let required_deps = vec![
            "@modelcontextprotocol/sdk",
            "@stellar/stellar-sdk",
            "zod",
        ];

        if let Some(deps) = package.get("dependencies") {
            for dep in required_deps {
                if deps.get(dep).is_none() {
                    errors.push(format!("Missing required dependency: {}", dep));
                }
            }
        }
    }

    // Check if node_modules exists (dependencies installed)
    if args.check_deps {
        let node_modules = args.path.join("node_modules");
        if !node_modules.exists() {
            errors.push("node_modules not found. Run 'npm install' or 'pnpm install' first.".to_string());
        } else {
            println!("  Dependencies installed");
        }
    }

    // Run typecheck if requested
    if args.typecheck {
        println!("Running TypeScript type checking...");
        let output = std::process::Command::new("npx")
            .args(["tsc", "--noEmit"])
            .current_dir(&args.path)
            .output();

        match output {
            Ok(result) => {
                if !result.status.success() {
                    let stderr = String::from_utf8_lossy(&result.stderr);
                    let stdout = String::from_utf8_lossy(&result.stdout);
                    errors.push(format!("TypeScript errors:\n{}{}", stdout, stderr));
                } else {
                    println!("  TypeScript check passed");
                }
            }
            Err(e) => {
                warnings.push(format!("Could not run tsc: {}", e));
            }
        }
    }

    // Run build if requested
    if args.build {
        println!("Building project...");
        let output = std::process::Command::new("npm")
            .args(["run", "build"])
            .current_dir(&args.path)
            .output();

        match output {
            Ok(result) => {
                if !result.status.success() {
                    let stderr = String::from_utf8_lossy(&result.stderr);
                    let stdout = String::from_utf8_lossy(&result.stdout);
                    errors.push(format!("Build failed:\n{}{}", stdout, stderr));
                } else {
                    println!("  Build succeeded");

                    // Check if dist/index.js was created
                    let dist_index = args.path.join("dist/index.js");
                    if dist_index.exists() {
                        println!("  Output: dist/index.js created");
                    } else {
                        warnings.push("dist/index.js not found after build".to_string());
                    }
                }
            }
            Err(e) => {
                warnings.push(format!("Could not run build: {}", e));
            }
        }
    }

    // Print results
    println!();
    if errors.is_empty() && warnings.is_empty() {
        println!("Validation passed! MCP server is valid.");
    } else {
        if !warnings.is_empty() {
            println!("Warnings:");
            for warning in &warnings {
                println!("  - {}", warning);
            }
        }

        if !errors.is_empty() {
            println!("Errors:");
            for error in &errors {
                println!("  - {}", error);
            }
            return Err("Validation failed with errors".into());
        }

        println!();
        println!("Validation passed with warnings.");
    }

    Ok(())
}
