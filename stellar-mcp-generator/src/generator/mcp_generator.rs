//! MCP Server generator implementation

use super::template_data::*;
use crate::commands::generate::GenerateArgs;
use crate::spec::{ContractSpec, TypeDef, TypeRef};
use crate::NetworkConfig;
use std::fs;
use std::path::Path;

/// MCP Server generator
pub struct McpGenerator<'a> {
    output_dir: &'a Path,
    contract_name: &'a str,
    server_name: &'a str,
    contract_id: &'a str,
    network: &'a NetworkConfig,
}

impl<'a> McpGenerator<'a> {
    /// Create a new generator
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

    /// Generate the MCP server
    pub fn generate(
        &self,
        spec: &ContractSpec,
        args: &GenerateArgs,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Create directory structure
        self.create_directories()?;

        // Generate official Stellar TypeScript bindings first
        self.generate_official_bindings()?;

        // Generate files
        self.generate_index_ts(spec, args)?;
        self.generate_tools_ts(spec)?;
        self.generate_schemas_ts(spec)?;
        self.generate_lib_files(args)?;
        self.generate_deploy_wallet(args)?;
        self.generate_package_json(args)?;
        self.generate_tsconfig()?;
        self.generate_env_example(args)?;
        self.generate_readme(spec, args)?;

        Ok(())
    }

    fn create_directories(&self) -> Result<(), Box<dyn std::error::Error>> {
        fs::create_dir_all(self.output_dir.join("src/tools"))?;
        fs::create_dir_all(self.output_dir.join("src/schemas"))?;
        fs::create_dir_all(self.output_dir.join("src/lib"))?;
        fs::create_dir_all(self.output_dir.join("src/bindings"))?;
        // Note: src/types removed - using official Stellar bindings instead
        Ok(())
    }

    /// Generate official Stellar TypeScript bindings using stellar CLI
    fn generate_official_bindings(&self) -> Result<(), Box<dyn std::error::Error>> {
        use std::process::Command;

        println!("  Generating official Stellar TypeScript bindings...");

        let bindings_dir = self.output_dir.join("src/bindings");

        // Call stellar contract bindings typescript
        let output = Command::new("stellar")
            .arg("contract")
            .arg("bindings")
            .arg("typescript")
            .arg("--contract-id")
            .arg(self.contract_id)
            .arg("--output-dir")
            .arg(&bindings_dir)
            .arg("--overwrite")
            .arg("--rpc-url")
            .arg(&self.network.rpc_url)
            .arg("--network-passphrase")
            .arg(&self.network.network_passphrase)
            .output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to generate Stellar bindings: {}", stderr).into());
        }

        println!("  ✓ Generated official bindings in src/bindings/");

        Ok(())
    }

    fn generate_index_ts(
        &self,
        spec: &ContractSpec,
        args: &GenerateArgs,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let functions: Vec<FunctionTemplateData> = spec
            .functions
            .iter()
            .map(|f| FunctionTemplateData {
                name: f.name.clone(),
                name_kebab: to_kebab_case(&f.name),
                name_camel: to_camel_case(&f.name),
                doc: f.doc.clone().unwrap_or_else(|| format!("Call {} function", f.name)),
                inputs: f
                    .inputs
                    .iter()
                    .enumerate()
                    .map(|(i, p)| InputTemplateData {
                        name: p.name.clone(),
                        name_camel: to_camel_case(&p.name),
                        doc: p.doc.clone().unwrap_or_default(),
                        ts_type: p.type_ref.to_typescript(),
                        zod_type: p.type_ref.to_zod(),
                        is_last: i == f.inputs.len() - 1,
                    })
                    .collect(),
                has_inputs: !f.inputs.is_empty(),
                output_type: f
                    .output
                    .as_ref()
                    .map(|t| t.to_typescript())
                    .unwrap_or_else(|| "void".to_string()),
                has_output: f.output.is_some(),
            })
            .collect();

        let content = self.render_index_template(&functions, args)?;
        fs::write(self.output_dir.join("src/index.ts"), content)?;

        println!("  Generated src/index.ts");
        Ok(())
    }

    fn render_index_template(
        &self,
        functions: &[FunctionTemplateData],
        args: &GenerateArgs,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let mut content = String::new();

        // Imports (shebang added by esbuild via --banner)
        content.push_str("import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';\n");
        content.push_str("import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';\n");
        content.push_str("import { z } from 'zod';\n");
        content.push_str(&format!("import * as tools from './tools/{}.js';\n", self.contract_name));
        content.push_str(&format!("import * as schemas from './schemas/{}.js';\n", self.contract_name));

        // Import transaction helpers
        content.push_str("import { submitTransaction } from './lib/submit.js';\n");
        content.push_str("import { signTransaction } from './lib/utils.js';\n");
        content.push_str("import { signAndSendWithPasskey } from './lib/passkey.js';\n");
        content.push_str("\n");

        // Server configuration
        content.push_str("// Configuration from environment\n");
        content.push_str(&format!("const CONTRACT_ID = process.env.CONTRACT_ID || '{}';\n", self.contract_id));
        content.push_str(&format!("const RPC_URL = process.env.RPC_URL || '{}';\n", self.network.rpc_url));
        content.push_str(&format!("const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE || '{}';\n", self.network.network_passphrase));
        content.push_str("\n");

        // BigInt serialization helper
        content.push_str("// Helper to serialize BigInt values (Soroban uses i128/u128 which become BigInt in JS)\n");
        content.push_str("const jsonStringify = (obj: unknown, space?: number): string => {\n");
        content.push_str("  return JSON.stringify(obj, (_, value) =>\n");
        content.push_str("    typeof value === 'bigint' ? value.toString() : value, space);\n");
        content.push_str("};\n\n");

        // Server initialization
        content.push_str("// Initialize MCP server\n");
        content.push_str("const server = new McpServer({\n");
        content.push_str(&format!("  name: '{}-mcp',\n", self.server_name));
        content.push_str("  version: '1.0.0',\n");
        content.push_str("});\n\n");

        // Generate tool registrations
        for func in functions {
            content.push_str(&format!("// Tool: {}\n", func.name));
            content.push_str("server.tool(\n");
            content.push_str(&format!("  '{}',\n", func.name_kebab));
            // Escape newlines and single quotes for JavaScript string
            let escaped_doc = func.doc
                .replace('\\', "\\\\")
                .replace('\'', "\\'")
                .replace('\n', "\\n");
            content.push_str(&format!("  '{}',\n", escaped_doc));

            // Schema
            if func.has_inputs {
                content.push_str("  {\n");
                for input in &func.inputs {
                    // If zod_type references a custom schema (ends with Schema and starts with uppercase),
                    // prefix with schemas. namespace
                    let zod_ref = if input.zod_type.ends_with("Schema") &&
                        input.zod_type.chars().next().map(|c| c.is_uppercase()).unwrap_or(false) {
                        format!("schemas.{}", input.zod_type)
                    } else {
                        input.zod_type.clone()
                    };
                    // Use snake_case field names to match official Stellar bindings
                    content.push_str(&format!(
                        "    {}: {}.describe('{}'),\n",
                        input.name, // Use original snake_case name
                        zod_ref,
                        input.doc.replace('\'', "\\'")
                    ));
                }
                content.push_str("  },\n");
            } else {
                content.push_str("  {},\n");
            }

            // Handler
            content.push_str("  async (params) => {\n");
            content.push_str("    try {\n");
            content.push_str(&format!(
                "      const result = await tools.{}(params, {{\n",
                func.name_camel
            ));
            content.push_str("        contractId: CONTRACT_ID,\n");
            content.push_str("        rpcUrl: RPC_URL,\n");
            content.push_str("        networkPassphrase: NETWORK_PASSPHRASE,\n");
            content.push_str("      });\n");
            content.push_str("\n");
            content.push_str("      return {\n");
            content.push_str("        content: [{\n");
            content.push_str("          type: 'text',\n");
            content.push_str("          text: jsonStringify(result, 2),\n");
            content.push_str("        }],\n");
            content.push_str("      };\n");
            content.push_str("    } catch (error) {\n");
            content.push_str("      return {\n");
            content.push_str("        content: [{\n");
            content.push_str("          type: 'text',\n");
            content.push_str("          text: jsonStringify({\n");
            content.push_str("            error: 'Tool execution failed',\n");
            content.push_str("            message: error instanceof Error ? error.message : 'Unknown error',\n");
            content.push_str("          }),\n");
            content.push_str("        }],\n");
            content.push_str("      };\n");
            content.push_str("    }\n");
            content.push_str("  }\n");
            content.push_str(");\n\n");
        }

        // Sign and submit tool
        content.push_str("// Tool: sign-and-submit\n");
        content.push_str("server.tool(\n");
        content.push_str("  'sign-and-submit',\n");
        content.push_str("  'Sign a transaction XDR and submit to the network. Use walletContractId for passkey smart wallet signing (requires WALLET_SIGNER_SECRET env var), or secretKey for regular keypair signing. secretKey is always required as fee payer.',\n");
        content.push_str("  {\n");
        content.push_str("    xdr: z.string().describe('Transaction XDR to sign and submit'),\n");
        content.push_str("    secretKey: z.string().optional().describe('Secret key for signing. For passkey flow, this becomes the fee payer secret.'),\n");
        content.push_str("    walletContractId: z.string().optional().describe('Smart wallet contract ID for passkey signing (uses WALLET_SIGNER_SECRET from env, secretKey as fee payer)'),\n");
        content.push_str("  },\n");
        content.push_str("  async ({ xdr, secretKey, walletContractId }) => {\n");
        content.push_str("    try {\n");

        // Always validate secretKey first
        content.push_str("      if (!secretKey) {\n");
        content.push_str("        throw new Error('Either secretKey (for regular signing) or walletContractId (for passkey signing) is required');\n");
        content.push_str("      }\n\n");

        // Add passkey signing conditional - simplified, signAndSendWithPasskey handles everything
        content.push_str("      // Use passkey signing if walletContractId is provided\n");
        content.push_str("      if (walletContractId) {\n");
        content.push_str("        // Passkey signing uses WALLET_SIGNER_SECRET from env for auth, secretKey as fee payer\n");
        content.push_str("        const result = await signAndSendWithPasskey(xdr, walletContractId, secretKey);\n");
        content.push_str("        return {\n");
        content.push_str("          content: [{\n");
        content.push_str("            type: 'text',\n");
        content.push_str("            text: jsonStringify({ success: true, result }),\n");
        content.push_str("          }],\n");
        content.push_str("        };\n");
        content.push_str("      }\n\n");

        // Use SDK-based signing and submission for regular flow
        content.push_str("      // Regular signing: signAuthEntries + sign envelope + submit\n");
        content.push_str("      const signedXdr = await signTransaction(xdr, secretKey);\n");
        content.push_str("      const result = await submitTransaction(signedXdr);\n");
        content.push_str("      return {\n");
        content.push_str("        content: [{\n");
        content.push_str("          type: 'text',\n");
        content.push_str("          text: jsonStringify({ success: true, result }),\n");
        content.push_str("        }],\n");
        content.push_str("      };\n");
        content.push_str("    } catch (error) {\n");
        content.push_str("      return {\n");
        content.push_str("        content: [{\n");
        content.push_str("          type: 'text',\n");
        content.push_str("          text: jsonStringify({\n");
        content.push_str("            error: 'Submission failed',\n");
        content.push_str("            message: error instanceof Error ? error.message : 'Unknown error',\n");
        content.push_str("          }),\n");
        content.push_str("        }],\n");
        content.push_str("      };\n");
        content.push_str("    }\n");
        content.push_str("  }\n");
        content.push_str(");\n\n");

        // Main function
        content.push_str("// Start server\n");
        content.push_str("async function main() {\n");
        content.push_str("  const transport = new StdioServerTransport();\n");
        content.push_str("  await server.connect(transport);\n");
        content.push_str(&format!("  console.error('{}-mcp MCP server running on stdio');\n", self.server_name));
        content.push_str("}\n\n");
        content.push_str("main().catch((error) => {\n");
        content.push_str("  console.error('Fatal error:', error);\n");
        content.push_str("  process.exit(1);\n");
        content.push_str("});\n");

        Ok(content)
    }

    fn generate_tools_ts(&self, spec: &ContractSpec) -> Result<(), Box<dyn std::error::Error>> {
        let mut content = String::new();

        content.push_str("// Generated tool handlers using official Stellar bindings\n");
        content.push_str("import { rpc } from '@stellar/stellar-sdk';\n");
        content.push_str("import { Client } from '../bindings/dist/index.js';\n");
        content.push_str("import type * as ContractTypes from '../bindings/dist/index.js';\n");
        content.push_str("\n");

        content.push_str("export interface ContractConfig {\n");
        content.push_str("  contractId: string;\n");
        content.push_str("  rpcUrl: string;\n");
        content.push_str("  networkPassphrase: string;\n");
        content.push_str("}\n\n");

        // Helper to create client
        content.push_str("// Helper to create contract client\n");
        content.push_str("function createClient(config: ContractConfig): Client {\n");
        content.push_str("  return new Client(config);\n");
        content.push_str("}\n\n");

        // Helper to convert types for Stellar SDK
        content.push_str("// Helper to convert types for Stellar SDK:\n");
        content.push_str("// - null → undefined (for Option<T>)\n");
        content.push_str("// - hex strings → Buffer (for Bytes/BytesN fields like 'salt', '*_hash', etc.)\n");
        content.push_str("// - numeric strings → bigint (for i128/u128 fields like '*_supply', 'cap', 'amount', etc.)\n");
        content.push_str("function convertNullToUndefined<T>(obj: T): T {\n");
        content.push_str("  if (obj === null || obj === undefined) return undefined as any;\n");
        content.push_str("  if (typeof obj !== 'object') return obj;\n");
        content.push_str("  if (Array.isArray(obj)) return obj.map(convertNullToUndefined) as any;\n");
        content.push_str("  \n");
        content.push_str("  const result: any = {};\n");
        content.push_str("  for (const [key, value] of Object.entries(obj)) {\n");
        content.push_str("    // Convert null to undefined\n");
        content.push_str("    if (value === null) {\n");
        content.push_str("      result[key] = undefined;\n");
        content.push_str("    }\n");
        content.push_str("    // Convert hex strings to Buffer for known Bytes fields\n");
        content.push_str("    else if (typeof value === 'string' && \n");
        content.push_str("            (key === 'salt' || key.endsWith('_hash') || key.endsWith('_wasm')) &&\n");
        content.push_str("            /^[0-9a-fA-F]+$/.test(value)) {\n");
        content.push_str("      result[key] = Buffer.from(value, 'hex');\n");
        content.push_str("    }\n");
        content.push_str("    // Convert numeric strings to bigint for known i128/u128 fields\n");
        content.push_str("    else if (typeof value === 'string' && \n");
        content.push_str("            (key.includes('supply') || key === 'cap' || key === 'amount' || key === 'balance' || \n");
        content.push_str("             key === 'value' || key.includes('_amount') || key.includes('_balance')) &&\n");
        content.push_str("            /^-?[0-9]+$/.test(value)) {\n");
        content.push_str("      result[key] = BigInt(value);\n");
        content.push_str("    }\n");
        content.push_str("    // Recursively convert nested objects\n");
        content.push_str("    else if (typeof value === 'object') {\n");
        content.push_str("      result[key] = convertNullToUndefined(value);\n");
        content.push_str("    }\n");
        content.push_str("    else {\n");
        content.push_str("      result[key] = value;\n");
        content.push_str("    }\n");
        content.push_str("  }\n");
        content.push_str("  return result;\n");
        content.push_str("}\n\n");

        // Generate typed functions that use the official Client
        for func in &spec.functions {
            // Helper function to check if a type needs conversion
            fn needs_conversion(type_ref: &TypeRef) -> bool {
                matches!(type_ref,
                    TypeRef::Bytes |
                    TypeRef::BytesN(_) |
                    TypeRef::Option(_) |
                    TypeRef::Custom(_) // Custom types might contain Option/Bytes fields
                )
            }

            let needs_type_conversion = func.inputs.iter().any(|p| needs_conversion(&p.type_ref));

            let param_str = if func.inputs.is_empty() {
                "{}".to_string()
            } else if needs_type_conversion {
                // Build an object with type conversions
                let fields: Vec<String> = func
                    .inputs
                    .iter()
                    .map(|p| {
                        match &p.type_ref {
                            TypeRef::Bytes | TypeRef::BytesN(_) => {
                                format!("{}: Buffer.from(params.{}, 'hex')", p.name, p.name)
                            }
                            TypeRef::Option(_) => {
                                // Convert null to undefined for Stellar's Option<T>
                                format!("{}: params.{} === null ? undefined : params.{}", p.name, p.name, p.name)
                            }
                            TypeRef::Custom(_) => {
                                // For custom types, convert null to undefined recursively
                                format!("{}: convertNullToUndefined(params.{})", p.name, p.name)
                            }
                            _ => format!("{}: params.{}", p.name, p.name)
                        }
                    })
                    .collect();
                format!("{{\n    {}\n  }}", fields.join(",\n    "))
            } else {
                "params".to_string()
            };

            let param_type_str = if func.inputs.is_empty() {
                "{}".to_string()
            } else {
                // Use ContractTypes for parameter types
                let params: Vec<String> = func
                    .inputs
                    .iter()
                    .map(|p| {
                        let ts_type = match &p.type_ref {
                            TypeRef::Custom(name) => format!("ContractTypes.{}", name),
                            _ => p.type_ref.to_typescript(),
                        };
                        format!("{}: {}", p.name, ts_type)
                    })
                    .collect();
                format!("{{ {} }}", params.join(", "))
            };

            content.push_str(&format!(
                "/**\n * {}\n */\n",
                func.doc.as_ref().unwrap_or(&func.name)
            ));
            content.push_str(&format!(
                "export async function {}(\n",
                to_camel_case(&func.name)
            ));
            content.push_str(&format!("  params: {},\n", param_type_str));
            content.push_str("  config: ContractConfig\n");
            content.push_str("): Promise<{ xdr: string; simulationResult?: any }> {\n");

            content.push_str("  const client = createClient(config);\n\n");

            content.push_str(&format!("  // Call {} using official bindings\n", func.name));
            content.push_str(&format!("  const assembled = await client.{}({});\n\n", func.name, param_str));

            content.push_str("  // assembled.result contains the simulated result\n");
            content.push_str("  return {\n");
            content.push_str("    xdr: assembled.built!.toXDR(),\n");
            content.push_str("    simulationResult: assembled.result,\n");
            content.push_str("  };\n");
            content.push_str("}\n\n");
        }

        fs::write(
            self.output_dir.join(&format!("src/tools/{}.ts", self.contract_name)),
            content,
        )?;

        println!("  Generated src/tools/{}.ts", self.contract_name);
        Ok(())
    }

    fn generate_schemas_ts(&self, spec: &ContractSpec) -> Result<(), Box<dyn std::error::Error>> {
        let mut content = String::new();

        content.push_str("// Generated Zod schemas matching official Stellar bindings\n");
        content.push_str("import { z } from 'zod';\n\n");

        // Generate schemas for custom types with snake_case field names
        for type_spec in &spec.types {
            match &type_spec.definition {
                TypeDef::Struct { fields } => {
                    content.push_str(&format!(
                        "export const {}Schema = z.object({{\n",
                        to_pascal_case(&type_spec.name)
                    ));
                    for field in fields {
                        // Use snake_case field names to match official bindings
                        content.push_str(&format!(
                            "  {}: {},\n",
                            field.name, // Keep original snake_case name
                            field.type_ref.to_zod()
                        ));
                    }
                    content.push_str("});\n\n");
                }
                TypeDef::Enum { variants } => {
                    let variant_names: Vec<String> =
                        variants.iter().map(|v| format!("'{}'", v.name)).collect();
                    content.push_str(&format!(
                        "export const {}Schema = z.enum([{}]);\n\n",
                        to_pascal_case(&type_spec.name),
                        variant_names.join(", ")
                    ));
                }
                TypeDef::Union { cases } => {
                    // Use 'tag' instead of 'type' to match official binding format
                    // Accept objects with just 'tag', values field is added automatically
                    content.push_str(&format!(
                        "export const {}Schema = z.union([\n",
                        to_pascal_case(&type_spec.name)
                    ));
                    for case in cases {
                        content.push_str(&format!(
                            "  z.object({{ tag: z.literal('{}') }}).transform(v => ({{ ...v, values: undefined as void }})),\n",
                            case.name
                        ));
                    }
                    content.push_str("]) as any;\n\n");
                }
            }
        }

        // Generate schemas for function parameters with snake_case field names
        for func in &spec.functions {
            if !func.inputs.is_empty() {
                content.push_str(&format!(
                    "export const {}ParamsSchema = z.object({{\n",
                    to_pascal_case(&func.name)
                ));
                for input in &func.inputs {
                    // Use snake_case field names to match official bindings
                    content.push_str(&format!(
                        "  {}: {},\n",
                        input.name, // Keep original snake_case name
                        input.type_ref.to_zod()
                    ));
                }
                content.push_str("});\n\n");
            }
        }

        fs::write(
            self.output_dir.join(&format!("src/schemas/{}.ts", self.contract_name)),
            content,
        )?;

        println!("  Generated src/schemas/{}.ts", self.contract_name);
        Ok(())
    }

    // Custom type generation removed - using official Stellar bindings instead

    fn generate_lib_files(&self, _args: &GenerateArgs) -> Result<(), Box<dyn std::error::Error>> {
        // Transaction utility
        let tx_content = r#"// Transaction utilities
import { xdr, scValToNative } from '@stellar/stellar-sdk';

export function parseTransactionResult(resultMetaXdr: string): any {
  const meta = xdr.TransactionMeta.fromXDR(resultMetaXdr, 'base64');
  const v3 = meta.v3();
  const sorobanMeta = v3.sorobanMeta();

  if (!sorobanMeta) {
    return null;
  }

  const returnValue = sorobanMeta.returnValue();
  return scValToNative(returnValue);
}
"#;
        fs::write(self.output_dir.join("src/lib/transaction.ts"), tx_content)?;

        // Always generate submit.ts (simple transaction submission)
        let submit_content = r#"// Transaction submission using Stellar SDK
import {
  TransactionBuilder,
  rpc,
  scValToNative,
} from '@stellar/stellar-sdk';

const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
const RPC_URL = process.env.RPC_URL || 'https://soroban-testnet.stellar.org';

export interface SubmitResult {
  hash: string;
  status: string;
  parsedResult?: unknown;
  resultMetaXdr?: string;
}

/**
 * Submit a signed transaction to the Stellar network
 *
 * NOTE: This function expects the transaction to already be signed!
 * Use this after signing with signAuthEntries + sign in the MCP tool.
 *
 * @param signedXdr - Signed transaction XDR
 * @returns Submission result with hash and parsed response
 */
export async function submitTransaction(
  signedXdr: string
): Promise<SubmitResult> {
  const server = new rpc.Server(RPC_URL, { allowHttp: true });

  // Parse the signed transaction
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  // Submit to network
  const response = await server.sendTransaction(tx);

  if (response.status !== 'PENDING') {
    const errorMessage =
      (response as any).errorResult?.toXDR?.('base64') ||
      (response as any).errorResultXdr ||
      JSON.stringify(response);
    throw new Error(`Transaction failed: ${response.status} - ${errorMessage}`);
  }

  // Poll for result using SDK's pollTransaction
  const txResult = await server.pollTransaction(response.hash, {
    sleepStrategy: () => 500,
    attempts: 60, // 30 seconds total
  });

  // Parse result if available
  let parsedResult;
  let resultMetaXdrString: string | undefined;

  // Type guard: only SUCCESS and FAILED have resultMetaXdr
  if (txResult.status === 'SUCCESS' || txResult.status === 'FAILED') {
    // Now TypeScript knows txResult has resultMetaXdr
    resultMetaXdrString = txResult.resultMetaXdr.toXDR('base64');

    if (txResult.status === 'SUCCESS') {
      try {
        // Try to get return value - handle different meta versions
        const meta = txResult.resultMetaXdr;
        const metaSwitch = meta.switch();

        if (metaSwitch.value === 3) {
          const sorobanMeta = meta.v3().sorobanMeta();
          if (sorobanMeta) {
            parsedResult = scValToNative(sorobanMeta.returnValue());
          }
        }
      } catch {
        // Result parsing failed, but transaction succeeded
        parsedResult = 'Transaction succeeded (result parsing unavailable)';
      }
    }
  }

  return {
    hash: response.hash,
    status: txResult.status,
    parsedResult,
    resultMetaXdr: resultMetaXdrString,
  };
}
"#;
        fs::write(self.output_dir.join("src/lib/submit.ts"), submit_content)?;
        println!("  Generated src/lib/submit.ts");

        // Always generate utils.ts with signing helper (rebuild pattern - no Client dependency)
        let utils_content = r#"// Signing utilities
import {
  Keypair,
  rpc,
  authorizeEntry,
  TransactionBuilder,
  Operation,
} from '@stellar/stellar-sdk';

const RPC_URL = process.env.RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE =
  process.env.NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

/**
 * Sign auth entries and optionally the transaction envelope
 *
 * This function applies the "rebuild with fresh sequence" pattern:
 * 1. Parse XDR directly (no Client dependency)
 * 2. Sign auth entries using SDK's authorizeEntry()
 * 3. Fetch fresh account (fresh sequence number)
 * 4. Rebuild transaction with fresh sequence
 * 5. Re-simulate for fresh footprint/resources
 * 6. Sign envelope and return
 *
 * @param xdr - Unsigned transaction XDR
 * @param secretKey - Secret key for signing
 * @param signEnvelope - If true, also signs the transaction envelope (default: true)
 * @returns Signed XDR (with auth entries, and optionally envelope signature)
 */
export async function signTransaction(
  xdr: string,
  secretKey: string,
  signEnvelope: boolean = true
): Promise<string> {
  const keypair = Keypair.fromSecret(secretKey);
  const server = new rpc.Server(RPC_URL, { allowHttp: true });

  // Step 1: Parse original transaction
  const originalTx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
  const operation = originalTx.operations[0] as Operation.InvokeHostFunction;

  // Step 2: Get current ledger for auth expiration
  const ledgerSeq = (await server.getLatestLedger()).sequence;
  const validUntilLedger = ledgerSeq + 100;

  // Step 3: Sign auth entries that need signing by this keypair
  const signedAuth: typeof operation.auth = [];
  if (operation.auth) {
    for (const entry of operation.auth) {
      const creds = entry.credentials();
      // Check if this is an address credential that matches our keypair
      if (creds.switch().name === 'sorobanCredentialsAddress') {
        try {
          const address = creds.address().address();
          const accountId = address.accountId();
          if (accountId) {
            const pubKeyHex = accountId.ed25519()?.toString('hex');
            const keypairHex = keypair.rawPublicKey().toString('hex');
            if (pubKeyHex === keypairHex) {
              // Sign this auth entry (authorizeEntry is async!)
              const signed = await authorizeEntry(
                entry,
                keypair,
                validUntilLedger,
                NETWORK_PASSPHRASE
              );
              signedAuth.push(signed);
              continue;
            }
          }
        } catch {
          // If we can't parse the address, just keep the entry as-is
        }
      }
      // Keep entry unchanged if we don't need to sign it
      signedAuth.push(entry);
    }
  }

  // Step 4: Fetch fresh account (current sequence number)
  const sourceAccount = await server.getAccount(keypair.publicKey());

  // Step 5: Rebuild transaction with fresh sequence, preserving signed auth
  const rebuiltTx = new TransactionBuilder(sourceAccount, {
    fee: originalTx.fee,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: operation.func,
        auth: signedAuth,
      })
    )
    .setTimeout(30)
    .build();

  // Step 6: Simulate to get fresh footprint/resources
  const simResponse = await server.simulateTransaction(rebuiltTx);
  if (rpc.Api.isSimulationError(simResponse)) {
    throw new Error(`Simulation failed: ${simResponse.error}`);
  }

  // Step 7: Assemble with simulation data
  const finalTx = rpc.assembleTransaction(rebuiltTx, simResponse).build();

  // Step 8: Optionally sign envelope
  if (signEnvelope) {
    finalTx.sign(keypair);
  }

  return finalTx.toXDR();
}
"#;
        fs::write(self.output_dir.join("src/lib/utils.ts"), utils_content)?;
        println!("  Generated src/lib/utils.ts");

        // Always generate passkey.ts with rebuild pattern
        let passkey_content = r#"// PasskeyKit integration
import { PasskeyKit, PasskeyClient } from 'passkey-kit';
import {
  Keypair,
  TransactionBuilder,
  rpc,
  Operation,
} from '@stellar/stellar-sdk';

// Configuration from environment (read once at module level)
const RPC_URL = process.env.RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE =
  process.env.NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

/**
 * Get a PasskeyKit instance configured for a specific wallet contract
 *
 * @param walletContractId - Smart wallet contract ID
 * @returns Configured PasskeyKit instance
 */
export function getPasskeyWallet(walletContractId: string): PasskeyKit {
  const WALLET_WASM_HASH = process.env.WALLET_WASM_HASH;

  if (!WALLET_WASM_HASH) {
    throw new Error(
      'Passkey signing requires WALLET_WASM_HASH environment variable'
    );
  }

  const passkeyKit = new PasskeyKit({
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    walletWasmHash: WALLET_WASM_HASH,
  });

  // Set the wallet to the specific smart wallet contract
  passkeyKit.wallet = new PasskeyClient({
    contractId: walletContractId,
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  return passkeyKit;
}

/**
 * Sign and submit transaction using passkey wallet
 *
 * This function handles the sequence number staleness issue by:
 * 1. Having PasskeyKit sign the auth entries (which are sequence-independent)
 * 2. Rebuilding the transaction with a fresh sequence number
 * 3. Re-simulating for fresh footprint/resources
 * 4. Signing the envelope and submitting
 *
 * Environment variables required:
 * - WALLET_WASM_HASH: Smart wallet WASM hash
 * - WALLET_SIGNER_SECRET: Secret key for wallet signer (signs auth entries)
 *
 * @param xdr - Transaction XDR to sign and submit
 * @param walletContractId - Smart wallet contract ID
 * @param feePayerSecret - Secret key for fee payer (signs envelope)
 * @returns Submission result
 */
export async function signAndSendWithPasskey(
  xdr: string,
  walletContractId: string,
  feePayerSecret: string
): Promise<any> {
  const WALLET_SIGNER_SECRET = process.env.WALLET_SIGNER_SECRET;

  if (!WALLET_SIGNER_SECRET) {
    throw new Error(
      'Passkey signing requires WALLET_SIGNER_SECRET environment variable'
    );
  }

  const walletSignerKeypair = Keypair.fromSecret(WALLET_SIGNER_SECRET);
  const feePayerKeypair = feePayerSecret
    ? Keypair.fromSecret(feePayerSecret)
    : walletSignerKeypair;
  const server = new rpc.Server(RPC_URL, { allowHttp: true });
  const passkeyWallet = getPasskeyWallet(walletContractId);

  // Step 1: PasskeyKit signs auth entries using wallet signer
  // Auth entries sign the invocation payload, NOT the transaction envelope
  // This means they are sequence-number independent
  const assembledTx = await passkeyWallet.sign(xdr, {
    keypair: walletSignerKeypair,
  });

  // Step 2: Extract operation with signed auth entries
  const builtTx = assembledTx.built!;
  const operation = builtTx.operations[0] as Operation.InvokeHostFunction;

  // Step 3: Fetch fresh account for fee payer (current sequence number)
  const sourceAccount = await server.getAccount(feePayerKeypair.publicKey());

  // Step 4: Rebuild transaction with fresh sequence, preserving signed auth
  const rebuiltTx = new TransactionBuilder(sourceAccount, {
    fee: builtTx.fee,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: operation.func,
        auth: operation.auth, // Signed auth entries preserved!
      })
    )
    .setTimeout(30)
    .build();

  // Step 5: Simulate to get fresh footprint/resources
  const simResponse = await server.simulateTransaction(rebuiltTx);

  if (rpc.Api.isSimulationError(simResponse)) {
    throw new Error(`Simulation failed: ${simResponse.error}`);
  }

  // Step 6: Assemble with simulation data
  const assembledRebuilt = rpc
    .assembleTransaction(rebuiltTx, simResponse)
    .build();

  // Step 7: Sign envelope with fee payer and submit
  assembledRebuilt.sign(feePayerKeypair);
  const response = await server.sendTransaction(assembledRebuilt);

  if (response.status !== 'PENDING') {
    const errorMessage =
      (response as any).errorResult?.toXDR?.('base64') ||
      (response as any).errorResultXdr ||
      JSON.stringify(response);
    throw new Error(`Transaction failed: ${response.status} - ${errorMessage}`);
  }

  // Step 8: Poll for result
  const txResult = await server.pollTransaction(response.hash, {
    sleepStrategy: () => 500,
    attempts: 60,
  });

  return {
    hash: response.hash,
    status: txResult.status,
    parsedResult: txResult.status === 'SUCCESS' ? txResult : undefined,
  };
}
"#;
        fs::write(self.output_dir.join("src/lib/passkey.ts"), passkey_content)?;
        println!("  Generated src/lib/passkey.ts");

        println!("  Generated src/lib/transaction.ts");
        Ok(())
    }

    fn generate_package_json(&self, _args: &GenerateArgs) -> Result<(), Box<dyn std::error::Error>> {
        let deps = serde_json::json!({
            "@modelcontextprotocol/sdk": "^1.8.0",
            "@stellar/stellar-sdk": "^14.0.0",
            "zod": "^3.23.0",
            "dotenv": "^16.4.0",
            "passkey-kit": "^0.10.19",
            "passkey-kit-sdk": "^0.7.2"
        });

        let scripts = serde_json::json!({
            "build:bindings": "cd src/bindings && pnpm install && pnpm build",
            "build:server": "esbuild src/index.ts --bundle --platform=node --target=node20 --format=esm --outfile=dist/index.js --external:@modelcontextprotocol/sdk --external:@stellar/stellar-sdk --external:zod --external:dotenv --banner:js=\"#!/usr/bin/env node\"",
            "build": "pnpm run build:bindings && pnpm run build:server",
            "start": "node dist/index.js",
            "dev": "esbuild src/index.ts --bundle --platform=node --target=node20 --format=esm --outfile=dist/index.js --external:@modelcontextprotocol/sdk --external:@stellar/stellar-sdk --external:zod --external:dotenv --banner:js=\"#!/usr/bin/env node\" --watch",
            "deploy-passkey": "tsx deploy-wallet.ts",
            "typecheck": "tsc --noEmit"
        });

        let dev_deps = serde_json::json!({
            "@types/node": "^22.0.0",
            "typescript": "^5.5.0",
            "esbuild": "^0.24.0",
            "tsx": "^4.19.0"
        });

        let package_json = serde_json::json!({
            "name": format!("{}-mcp-server", self.contract_name),
            "version": "1.0.0",
            "description": format!("MCP server for {} Soroban contract", self.contract_name),
            "type": "module",
            "main": "dist/index.js",
            "bin": {
                format!("{}-mcp", self.contract_name): "./dist/index.js"
            },
            "scripts": scripts,
            "dependencies": deps,
            "devDependencies": dev_deps,
            "engines": {
                "node": ">=20"
            }
        });

        let content = serde_json::to_string_pretty(&package_json)?;
        fs::write(self.output_dir.join("package.json"), content)?;

        println!("  Generated package.json");
        Ok(())
    }

    fn generate_tsconfig(&self) -> Result<(), Box<dyn std::error::Error>> {
        let tsconfig = serde_json::json!({
            "compilerOptions": {
                "target": "ES2022",
                "module": "NodeNext",
                "moduleResolution": "NodeNext",
                "lib": ["ES2022"],
                "outDir": "./dist",
                "rootDir": "./src",
                "strict": true,
                "esModuleInterop": true,
                "skipLibCheck": true,
                "forceConsistentCasingInFileNames": true,
                "declaration": true,
                "declarationMap": true,
                "sourceMap": true
            },
            "include": ["src/**/*"],
            "exclude": ["node_modules", "dist"]
        });

        let content = serde_json::to_string_pretty(&tsconfig)?;
        fs::write(self.output_dir.join("tsconfig.json"), content)?;

        println!("  Generated tsconfig.json");
        Ok(())
    }

    fn generate_env_example(&self, _args: &GenerateArgs) -> Result<(), Box<dyn std::error::Error>> {
        let mut content = String::new();

        content.push_str("# Contract configuration\n");
        content.push_str(&format!("CONTRACT_ID={}\n", self.contract_id));
        content.push_str(&format!("RPC_URL={}\n", self.network.rpc_url));
        content.push_str(&format!("NETWORK_PASSPHRASE=\"{}\"\n", self.network.network_passphrase));
        content.push_str("\n");

        content.push_str("# PasskeyKit configuration (for smart wallet signing)\n");
        content.push_str("WALLET_WASM_HASH=your_wallet_wasm_hash_here\n");
        content.push_str("WALLET_CONTRACT_ID=your_wallet_contract_id_here\n");
        content.push_str("WALLET_SIGNER_SECRET=your_wallet_signer_secret_here\n");

        fs::write(self.output_dir.join(".env.example"), content)?;

        println!("  Generated .env.example");
        Ok(())
    }

    fn generate_deploy_wallet(&self, _args: &GenerateArgs) -> Result<(), Box<dyn std::error::Error>> {
        let content = format!(r#"#!/usr/bin/env tsx
/**
 * Deploy a PasskeyKit smart wallet contract using PasskeyClient
 *
 * Usage: tsx deploy-wallet.ts <wasm_hash>
 */

import {{ Keypair }} from '@stellar/stellar-sdk';
import {{ basicNodeSigner }} from '@stellar/stellar-sdk/contract';
import {{ Buffer }} from 'buffer';

// Import the generated wallet client
import {{ Client as PasskeyClient }} from 'passkey-kit-sdk';

async function deployWallet() {{
  console.log('🚀 Deploying PasskeyKit Wallet Contract\n');

  // Get WASM hash from args or use default
  const wasmHash = process.argv[2];
  if (!wasmHash) {{
    console.error('❌ Error: WASM hash required');
    console.error('Usage: pnpm deploy-passkey <wasm_hash>');
    console.error('\nTo get WASM hash, first upload the wallet WASM:');
    console.error('  stellar contract upload --wasm wallet.wasm --source your-key --network testnet');
    process.exit(1);
  }}

  // Get deployer keypair from environment or stellar CLI
  const secretKey = process.env.DEPLOYER_SECRET || 'YOUR_DEPLOYER_SECRET_KEY';
  if (secretKey === 'YOUR_DEPLOYER_SECRET_KEY') {{
    console.error('❌ Error: DEPLOYER_SECRET environment variable not set');
    console.error('Set it with: export DEPLOYER_SECRET=SXXXXXXXXXXXXXXX');
    process.exit(1);
  }}

  const deployer = Keypair.fromSecret(secretKey);

  console.log('Deployer:', deployer.publicKey());
  console.log('Network: {}');
  console.log('RPC: {}');
  console.log('WASM Hash:', wasmHash);
  console.log();

  try {{
    // Create a dummy Ed25519 signer for testing (instead of real passkey)
    const dummyKey = Keypair.random();
    const dummyPublicKey = dummyKey.rawPublicKey();

    console.log('📦 Deploying wallet contract with Ed25519 signer...');
    console.log('Signer Public Key:', dummyKey.publicKey());
    console.log();

    // Deploy using PasskeyClient.deploy
    const assembledTx = await PasskeyClient.deploy(
      {{
        signer: {{
          tag: 'Ed25519',
          values: [
            dummyPublicKey,
            [undefined], // SignerExpiration - no expiration
            [undefined], // SignerLimits - no limits
            {{ tag: 'Persistent', values: undefined }}, // SignerStorage
          ]
        }}
      }},
      {{
        rpcUrl: '{}',
        networkPassphrase: '{}',
        wasmHash: Buffer.from(wasmHash, 'hex'),
        publicKey: deployer.publicKey(),
        salt: Buffer.from(Keypair.random().rawPublicKey()), // Random salt
        timeoutInSeconds: 30,
      }}
    );

    const contractId = assembledTx.result.options.contractId;

    console.log('Contract ID (pre-simulation):', contractId);
    console.log('Signing and sending transaction...');

    // Sign and send
    await assembledTx.sign({{
      signTransaction: basicNodeSigner(deployer, '{}').signTransaction
    }});

    const result = await assembledTx.send();

    console.log('\n✅ Wallet Deployed Successfully!\n');
    console.log('Wallet Contract ID:', contractId);
    console.log('Transaction Hash:', result.hash);
    console.log('Signer Public Key:', dummyKey.publicKey());
    console.log('Signer Secret Key:', dummyKey.secret());

    console.log('\n📝 Add these to your .env file:');
    console.log(`WALLET_WASM_HASH=${{wasmHash}}`);
    console.log(`WALLET_CONTRACT_ID=${{contractId}}`);
    console.log(`WALLET_SIGNER_SECRET=${{dummyKey.secret()}}`);

  }} catch (error) {{
    console.error('\n❌ Deployment failed:', error);
    if (error instanceof Error) {{
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }}
    process.exit(1);
  }}
}}

deployWallet();
"#, self.network.network_passphrase, self.network.rpc_url, self.network.rpc_url, self.network.network_passphrase, self.network.network_passphrase);

        fs::write(self.output_dir.join("deploy-wallet.ts"), content)?;
        println!("  Generated deploy-wallet.ts");
        Ok(())
    }

    fn generate_readme(
        &self,
        spec: &ContractSpec,
        _args: &GenerateArgs,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut content = String::new();

        content.push_str(&format!("# {} MCP Server\n\n", to_pascal_case(self.contract_name)));
        content.push_str(&format!(
            "Auto-generated MCP server for the {} contract on Stellar {}.\n\n",
            self.contract_name, self.network.name
        ));

        content.push_str("## Contract Information\n\n");
        content.push_str(&format!("- **Contract ID**: `{}`\n", self.contract_id));
        content.push_str(&format!("- **Network**: {}\n", self.network.name));
        content.push_str(&format!("- **RPC URL**: {}\n\n", self.network.rpc_url));

        content.push_str("## Requirements\n\n");
        content.push_str("- **Node.js 20+** recommended\n");
        content.push_str("- For Node.js 18.x users experiencing SSL certificate errors, add `NODE_TLS_REJECT_UNAUTHORIZED=0` to environment variables (development only)\n\n");

        content.push_str("## Available Tools\n\n");
        for func in &spec.functions {
            // Create collapsible dropdown for each tool
            content.push_str(&format!("<details>\n<summary><code>{}</code></summary>\n\n", to_kebab_case(&func.name)));

            if let Some(doc) = &func.doc {
                content.push_str(&format!("{}\n\n", doc));
            }

            if !func.inputs.is_empty() {
                content.push_str("**Parameters:**\n\n");
                for input in &func.inputs {
                    content.push_str(&format!(
                        "- `{}` ({}): {}\n",
                        input.name,
                        input.type_ref.to_typescript(),
                        input.doc.as_ref().unwrap_or(&"No description".to_string())
                    ));
                }
                content.push_str("\n");
            }

            if let Some(output) = &func.output {
                content.push_str(&format!("**Returns:** `{}`\n\n", output.to_typescript()));
            }

            content.push_str("</details>\n\n");
        }

        // Environment Variables section
        content.push_str("## Environment Variables\n\n");
        content.push_str("Create a `.env` file in the project root with the following variables:\n\n");
        content.push_str("### Core Contract Configuration\n\n");
        content.push_str("```bash\n");
        content.push_str(&format!("CONTRACT_ID={}\n", self.contract_id));
        content.push_str(&format!("RPC_URL={}\n", self.network.rpc_url));
        content.push_str(&format!("NETWORK_PASSPHRASE={}\n", self.network.network_passphrase));
        content.push_str("```\n\n");

        content.push_str("### PasskeyKit Configuration (Optional)\n\n");
        content.push_str("For passkey-based transaction signing:\n\n");
        content.push_str("```bash\n");
        content.push_str("WALLET_WASM_HASH=your_wallet_wasm_hash_here\n");
        content.push_str("WALLET_CONTRACT_ID=your_wallet_contract_id_here\n");
        content.push_str("WALLET_SIGNER_SECRET=your_wallet_signer_secret_here\n");
        content.push_str("```\n\n");

        // Deployment section
        content.push_str("## Deploying a PasskeyKit Wallet\n\n");
        content.push_str("To enable passkey-based signing, deploy a PasskeyKit wallet contract:\n\n");
        content.push_str("### 1. Build or obtain the wallet WASM\n\n");
        content.push_str("```bash\n");
        content.push_str("# Option 1: Build from passkey-kit source\n");
        content.push_str("cd /path/to/passkey-kit/contracts\n");
        content.push_str("make build\n");
        content.push_str("cp out/smart_wallet.optimized.wasm ./wallet.wasm\n\n");
        content.push_str("# Option 2: Use pre-built WASM\n");
        content.push_str("# Download from passkey-kit releases\n");
        content.push_str("```\n\n");

        content.push_str("### 2. Upload WASM to network\n\n");
        content.push_str("```bash\n");
        content.push_str("stellar contract upload \\\n");
        content.push_str("  --wasm wallet.wasm \\\n");
        content.push_str("  --source your-keypair-alias \\\n");
        content.push_str(&format!("  --network {}\n", self.network.name.to_lowercase()));
        content.push_str("\n# Save the WASM hash from output\n");
        content.push_str("```\n\n");

        content.push_str("### 3. Deploy wallet using the script\n\n");
        content.push_str("```bash\n");
        content.push_str("# Set your deployer secret\n");
        content.push_str("export DEPLOYER_SECRET=SXXXXXXXXXXXXXXX\n\n");
        content.push_str("# Deploy with the WASM hash from step 2\n");
        content.push_str("pnpm deploy-passkey <WASM_HASH>\n");
        content.push_str("```\n\n");

        content.push_str("The script will output the wallet contract ID and signer credentials. Add these to your `.env` file.\n\n");

        // Quick Start section
        content.push_str("## Quick Start\n\n");
        content.push_str("```bash\n");
        content.push_str("# Install dependencies\n");
        content.push_str("pnpm install\n\n");
        content.push_str("# Configure environment\n");
        content.push_str("cp .env.example .env\n");
        content.push_str("# Edit .env with your values\n\n");
        content.push_str("# Build\n");
        content.push_str("pnpm run build\n\n");
        content.push_str("# Start server\n");
        content.push_str("pnpm start\n");
        content.push_str("```\n\n");

        // Claude Desktop Configuration
        content.push_str("## Claude Desktop Configuration\n\n");
        content.push_str("Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:\n\n");

        // Basic configuration without passkey
        content.push_str("### Basic Configuration (Standard Keypair Signing)\n\n");
        content.push_str("```json\n");
        content.push_str("{\n");
        content.push_str("  \"mcpServers\": {\n");
        content.push_str(&format!("    \"{}\": {{\n", self.contract_name));
        content.push_str("      \"command\": \"node\",\n");
        content.push_str("      \"args\": [\"/absolute/path/to/this/project/dist/index.js\"],\n");
        content.push_str("      \"env\": {\n");
        content.push_str(&format!("        \"CONTRACT_ID\": \"{}\",\n", self.contract_id));
        content.push_str(&format!("        \"RPC_URL\": \"{}\",\n", self.network.rpc_url));
        content.push_str(&format!("        \"NETWORK_PASSPHRASE\": \"{}\"\n", self.network.network_passphrase));
        content.push_str("      }\n");
        content.push_str("    }\n");
        content.push_str("  }\n");
        content.push_str("}\n");
        content.push_str("```\n\n");

        // Configuration with passkey support
        content.push_str("### With PasskeyKit Support\n\n");
        content.push_str("If you want to use passkey-based signing, add `WALLET_WASM_HASH`:\n\n");
        content.push_str("```json\n");
        content.push_str("{\n");
        content.push_str("  \"mcpServers\": {\n");
        content.push_str(&format!("    \"{}\": {{\n", self.contract_name));
        content.push_str("      \"command\": \"node\",\n");
        content.push_str("      \"args\": [\"/absolute/path/to/this/project/dist/index.js\"],\n");
        content.push_str("      \"env\": {\n");
        content.push_str(&format!("        \"CONTRACT_ID\": \"{}\",\n", self.contract_id));
        content.push_str(&format!("        \"RPC_URL\": \"{}\",\n", self.network.rpc_url));
        content.push_str(&format!("        \"NETWORK_PASSPHRASE\": \"{}\",\n", self.network.network_passphrase));
        content.push_str("        \"WALLET_WASM_HASH\": \"your_wallet_wasm_hash_here\"\n");
        content.push_str("      }\n");
        content.push_str("    }\n");
        content.push_str("  }\n");
        content.push_str("}\n");
        content.push_str("```\n\n");

        content.push_str("**Important Notes:**\n");
        content.push_str("- Replace `/absolute/path/to/this/project/` with the actual absolute path to this directory\n");
        content.push_str("- For passkey support: Replace `your_wallet_wasm_hash_here` with your deployed wallet WASM hash (get this from `pnpm deploy-passkey`)\n");
        content.push_str("- Build the project first with `pnpm run build` before starting Claude Desktop\n");
        content.push_str("- Restart Claude Desktop after making configuration changes\n");
        content.push_str("- If using Node.js 18.x and encountering SSL errors, add `\"NODE_TLS_REJECT_UNAUTHORIZED\": \"0\"` to the `env` object (development only)\n\n");

        // Transaction Signing section
        content.push_str("## Transaction Signing\n\n");
        content.push_str("This MCP server supports two transaction signing methods:\n\n");
        content.push_str("### 1. Standard Keypair Signing\n\n");
        content.push_str("Use your Stellar secret key directly:\n");
        content.push_str("- Signs authorization entries\n");
        content.push_str("- Signs transaction envelope\n");
        content.push_str("- Submits to network\n\n");
        content.push_str("### 2. PasskeyKit Smart Wallet Signing\n\n");
        content.push_str("Use a deployed PasskeyKit wallet for enhanced security:\n");
        content.push_str("- Signs authorization entries with keypair\n");
        content.push_str("- Signs envelope with smart wallet contract\n");
        content.push_str("- Supports passkey-based authentication\n\n");
        content.push_str("To use passkey signing, provide the `walletContractId` parameter to the `sign-and-submit` tool.\n\n");

        content.push_str("## Generated by\n\n");
        content.push_str("[stellar-mcp-generator](https://github.com/stellar/stellar-mcp-generator)\n\n");
        content.push_str("This MCP server was auto-generated from the Stellar smart contract and includes production-ready transaction signing with support for both standard keypairs and PasskeyKit smart wallets.\n");

        fs::write(self.output_dir.join("README.md"), content)?;

        println!("  Generated README.md");
        Ok(())
    }
}
