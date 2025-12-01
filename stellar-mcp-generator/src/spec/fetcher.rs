//! Contract specification fetcher
//!
//! Fetches contract WASM from the Stellar network and extracts spec metadata.

use super::parser::SpecParser;
use super::types::ContractSpec;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::error::Error;

/// Fetches contract specifications from the Stellar network
pub struct SpecFetcher {
    rpc_url: String,
    client: Client,
    verbose: bool,
}

impl SpecFetcher {
    /// Create a new spec fetcher for the given RPC URL
    pub fn new(rpc_url: &str) -> Result<Self, Box<dyn Error>> {
        Ok(Self {
            rpc_url: rpc_url.to_string(),
            client: Client::new(),
            verbose: false,
        })
    }

    /// Create a new spec fetcher with verbose output
    pub fn with_verbose(rpc_url: &str, verbose: bool) -> Result<Self, Box<dyn Error>> {
        Ok(Self {
            rpc_url: rpc_url.to_string(),
            client: Client::new(),
            verbose,
        })
    }

    /// Log message if verbose mode is enabled
    fn log(&self, msg: &str) {
        if self.verbose {
            eprintln!("{}", msg);
        }
    }

    /// Fetch contract specification from a deployed contract
    pub async fn fetch_spec(&self, contract_id: &str) -> Result<ContractSpec, Box<dyn Error>> {
        self.log("  [1/3] Fetching contract WASM ID...");

        // Step 1: Get contract code (ledger entry)
        let wasm_id = self.get_contract_wasm_id(contract_id).await
            .map_err(|e| format!("Failed to get WASM ID: {}", e))?;
        self.log(&format!("  [1/3] WASM ID: {}", wasm_id));

        self.log("  [2/3] Fetching WASM code...");
        // Step 2: Get WASM code
        let wasm_bytes = self.get_wasm_code(&wasm_id).await
            .map_err(|e| format!("Failed to get WASM code: {}", e))?;
        self.log(&format!("  [2/3] WASM size: {} bytes", wasm_bytes.len()));

        self.log("  [3/3] Parsing contract spec...");
        // Step 3: Parse spec from WASM
        let spec = SpecParser::parse_wasm(&wasm_bytes)
            .map_err(|e| format!("Failed to parse spec: {}", e))?;
        self.log(&format!("  [3/3] Found {} functions", spec.functions.len()));

        Ok(spec)
    }

    /// Get the WASM ID for a contract
    async fn get_contract_wasm_id(&self, contract_id: &str) -> Result<String, Box<dyn Error>> {
        self.log("    Creating ledger key for contract...");
        let ledger_key = self.contract_data_key(contract_id)
            .map_err(|e| format!("Failed to create ledger key: {}", e))?;
        self.log(&format!("    Ledger key (base64): {}...", &ledger_key[..50.min(ledger_key.len())]));

        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "getLedgerEntries".to_string(),
            params: GetLedgerEntriesParams {
                keys: vec![ledger_key],
            },
        };

        self.log("    Sending RPC request...");
        let response: JsonRpcResponse<GetLedgerEntriesResult> = self
            .client
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await?
            .json()
            .await?;

        if let Some(error) = response.error {
            return Err(format!("RPC error: {} - {}", error.code, error.message).into());
        }

        let result = response
            .result
            .ok_or("No result in RPC response")?;

        self.log(&format!("    Got {} ledger entries", result.entries.len()));

        let entry = result
            .entries
            .first()
            .ok_or("Contract not found")?;

        self.log(&format!("    Parsing XDR entry ({} chars)...", entry.xdr.len()));

        // Parse the XDR to extract WASM hash
        let wasm_id = self.extract_wasm_id_from_entry(&entry.xdr)?;

        Ok(wasm_id)
    }

    /// Get WASM code by its ID
    async fn get_wasm_code(&self, wasm_id: &str) -> Result<Vec<u8>, Box<dyn Error>> {
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: 2,
            method: "getLedgerEntries".to_string(),
            params: GetLedgerEntriesParams {
                keys: vec![self.wasm_code_key(wasm_id)?],
            },
        };

        let response: JsonRpcResponse<GetLedgerEntriesResult> = self
            .client
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await?
            .json()
            .await?;

        if let Some(error) = response.error {
            return Err(format!("RPC error: {} - {}", error.code, error.message).into());
        }

        let result = response
            .result
            .ok_or("No result in RPC response")?;

        let entry = result
            .entries
            .first()
            .ok_or("WASM code not found")?;

        // Parse the XDR to extract WASM bytes
        let wasm_bytes = self.extract_wasm_from_entry(&entry.xdr)?;

        Ok(wasm_bytes)
    }

    /// Create contract data ledger key XDR
    fn contract_data_key(&self, contract_id: &str) -> Result<String, Box<dyn Error>> {
        // Build LedgerKey for ContractData (Instance)
        use stellar_xdr::curr::{
            ContractDataDurability, LedgerKey, LedgerKeyContractData, ScAddress, ScVal,
        };

        let contract_address = ScAddress::Contract(
            stellar_xdr::curr::ContractId(stellar_xdr::curr::Hash(
                self.decode_contract_id(contract_id)?
            ))
        );

        let key = LedgerKey::ContractData(LedgerKeyContractData {
            contract: contract_address,
            key: ScVal::LedgerKeyContractInstance,
            durability: ContractDataDurability::Persistent,
        });

        let xdr_bytes = stellar_xdr::curr::WriteXdr::to_xdr(&key, stellar_xdr::curr::Limits::none())?;
        Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &xdr_bytes))
    }

    /// Create WASM code ledger key XDR
    fn wasm_code_key(&self, wasm_id: &str) -> Result<String, Box<dyn Error>> {
        use stellar_xdr::curr::{LedgerKey, LedgerKeyContractCode};

        let hash_bytes = hex::decode(wasm_id)?;
        let mut hash_array = [0u8; 32];
        hash_array.copy_from_slice(&hash_bytes);

        let key = LedgerKey::ContractCode(LedgerKeyContractCode {
            hash: stellar_xdr::curr::Hash(hash_array),
        });

        let xdr_bytes = stellar_xdr::curr::WriteXdr::to_xdr(&key, stellar_xdr::curr::Limits::none())?;
        Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &xdr_bytes))
    }

    /// Decode contract ID (strkey) to bytes
    fn decode_contract_id(&self, contract_id: &str) -> Result<[u8; 32], Box<dyn Error>> {
        // Simple strkey decoding for contract addresses
        let decoded = self.strkey_decode(contract_id)?;
        let mut result = [0u8; 32];
        result.copy_from_slice(&decoded);
        Ok(result)
    }

    /// Decode strkey encoded string
    fn strkey_decode(&self, encoded: &str) -> Result<Vec<u8>, Box<dyn Error>> {
        // Stellar strkey uses base32 encoding with CRC16 checksum
        // For contract IDs (C prefix), version byte is 2

        if !encoded.starts_with('C') {
            return Err("Invalid contract ID: must start with 'C'".into());
        }

        // Stellar uses uppercase base32 (RFC4648 without padding)
        let encoded_upper = encoded.to_uppercase();
        let alphabet = base32::Alphabet::Rfc4648 { padding: false };
        let decoded = base32::decode(alphabet, &encoded_upper)
            .ok_or_else(|| format!("Failed to decode base32 for: {}", encoded))?;

        // Strkey format: 1 byte version + 32 bytes payload + 2 bytes CRC16 = 35 bytes
        if decoded.len() != 35 {
            return Err(format!(
                "Invalid strkey length: expected 35 bytes, got {} bytes",
                decoded.len()
            ).into());
        }

        // Verify CRC16 checksum
        let payload = &decoded[0..33]; // version + 32-byte payload
        let checksum = &decoded[33..35];
        let computed_crc = self.crc16_xmodem(payload);
        let expected_crc = u16::from_le_bytes([checksum[0], checksum[1]]);

        if computed_crc != expected_crc {
            return Err(format!(
                "Invalid strkey checksum: computed {:04x}, expected {:04x}",
                computed_crc, expected_crc
            ).into());
        }

        // Return the 32-byte payload (skip version byte)
        Ok(decoded[1..33].to_vec())
    }

    /// CRC16-XMODEM checksum (used by Stellar strkey)
    fn crc16_xmodem(&self, data: &[u8]) -> u16 {
        let mut crc: u16 = 0;
        for byte in data {
            crc ^= (*byte as u16) << 8;
            for _ in 0..8 {
                if crc & 0x8000 != 0 {
                    crc = (crc << 1) ^ 0x1021;
                } else {
                    crc <<= 1;
                }
            }
        }
        crc
    }

    /// Extract WASM ID from contract instance ledger entry
    fn extract_wasm_id_from_entry(&self, xdr_base64: &str) -> Result<String, Box<dyn Error>> {
        use stellar_xdr::curr::{LedgerEntryData, ReadXdr};

        let xdr_bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, xdr_base64)?;
        self.log(&format!("    XDR bytes length: {}", xdr_bytes.len()));
        self.log(&format!("    XDR hex (first 50): {}...", hex::encode(&xdr_bytes[..50.min(xdr_bytes.len())])));

        // Try parsing as LedgerEntry first, then fall back to LedgerEntryData
        let data = if let Ok(entry) = stellar_xdr::curr::LedgerEntry::from_xdr(&xdr_bytes, stellar_xdr::curr::Limits::none()) {
            self.log("    Parsed as LedgerEntry");
            entry.data
        } else {
            // Fall back to parsing just the data part
            self.log("    Trying to parse as LedgerEntryData...");
            LedgerEntryData::from_xdr(&xdr_bytes, stellar_xdr::curr::Limits::none())
                .map_err(|e| format!("Failed to parse XDR as LedgerEntry or LedgerEntryData: {:?}", e))?
        };

        match data {
            LedgerEntryData::ContractData(contract_data) => {
                self.log("    Got ContractData entry");
                match contract_data.val {
                    stellar_xdr::curr::ScVal::ContractInstance(instance) => {
                        self.log("    Got ContractInstance");
                        match instance.executable {
                            stellar_xdr::curr::ContractExecutable::Wasm(hash) => {
                                Ok(hex::encode(hash.0))
                            }
                            stellar_xdr::curr::ContractExecutable::StellarAsset => {
                                Err("Contract is a Stellar Asset contract, not WASM".into())
                            }
                        }
                    }
                    other => Err(format!("Expected ContractInstance, got {:?}", other).into()),
                }
            }
            other => Err(format!("Expected ContractData, got {:?}", other).into()),
        }
    }

    /// Extract WASM bytes from contract code ledger entry
    fn extract_wasm_from_entry(&self, xdr_base64: &str) -> Result<Vec<u8>, Box<dyn Error>> {
        use stellar_xdr::curr::{LedgerEntryData, ReadXdr};

        let xdr_bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, xdr_base64)?;

        // Try parsing as LedgerEntry first, then fall back to LedgerEntryData
        let data = if let Ok(entry) = stellar_xdr::curr::LedgerEntry::from_xdr(&xdr_bytes, stellar_xdr::curr::Limits::none()) {
            entry.data
        } else {
            LedgerEntryData::from_xdr(&xdr_bytes, stellar_xdr::curr::Limits::none())
                .map_err(|e| format!("Failed to parse WASM entry XDR: {:?}", e))?
        };

        match data {
            LedgerEntryData::ContractCode(code) => {
                Ok(code.code.to_vec())
            }
            other => Err(format!("Expected ContractCode, got {:?}", other).into()),
        }
    }
}

// JSON-RPC types
#[derive(Serialize)]
struct JsonRpcRequest<P> {
    jsonrpc: String,
    id: u32,
    method: String,
    params: P,
}

#[derive(Deserialize)]
struct JsonRpcResponse<R> {
    #[allow(dead_code)]
    jsonrpc: String,
    #[allow(dead_code)]
    id: u32,
    result: Option<R>,
    error: Option<JsonRpcError>,
}

#[derive(Deserialize)]
struct JsonRpcError {
    code: i32,
    message: String,
}

#[derive(Serialize)]
struct GetLedgerEntriesParams {
    keys: Vec<String>,
}

#[derive(Deserialize)]
struct GetLedgerEntriesResult {
    entries: Vec<LedgerEntryResult>,
}

#[derive(Deserialize)]
struct LedgerEntryResult {
    xdr: String,
}
