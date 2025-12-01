//! Contract specification parser
//!
//! Uses soroban-spec-tools for reliable WASM spec parsing.

use super::types::*;
use std::error::Error;

/// Parser for contract specifications using soroban-spec-tools
pub struct SpecParser;

impl SpecParser {
    /// Parse contract specification from WASM bytes using soroban-spec-tools
    pub fn parse_wasm(wasm_bytes: &[u8]) -> Result<ContractSpec, Box<dyn Error>> {
        use stellar_xdr::curr::WriteXdr;
        use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

        // Use the official soroban-spec-tools library (same as scaffold-stellar)
        let soroban_spec = soroban_spec_tools::contract::Spec::new(wasm_bytes)
            .map_err(|e| format!("Failed to parse WASM spec: {}", e))?;

        let mut spec = ContractSpec::new();

        // Extract contract name from metadata if available
        spec.name = Self::extract_contract_name(&soroban_spec.meta);

        // Extract raw XDR spec entries (base64 encoded) for SDK ContractSpec
        for entry in &soroban_spec.spec {
            // Serialize each ScSpecEntry to XDR bytes using to_xdr
            let xdr_bytes = entry.to_xdr(stellar_xdr::curr::Limits::none())
                .map_err(|e| format!("Failed to serialize spec entry: {}", e))?;

            // Base64 encode the XDR bytes
            let base64_xdr = BASE64.encode(&xdr_bytes);
            spec.raw_spec_entries.push(base64_xdr);

            // Also process the entry for our internal representation
            Self::process_spec_entry(entry, &mut spec)?;
        }

        Ok(spec)
    }

    /// Extract contract name from metadata entries
    /// Looks for a "name" key in the contract metadata
    fn extract_contract_name(meta: &[stellar_xdr::curr::ScMetaEntry]) -> Option<String> {
        use stellar_xdr::curr::ScMetaEntry;

        for entry in meta {
            if let ScMetaEntry::ScMetaV0(meta_v0) = entry {
                let key = meta_v0.key.to_utf8_string_lossy();
                if key == "name" {
                    let name = meta_v0.val.to_utf8_string_lossy();
                    if !name.is_empty() {
                        return Some(name);
                    }
                }
            }
        }
        None
    }

    /// Process a single spec entry
    fn process_spec_entry(
        entry: &stellar_xdr::curr::ScSpecEntry,
        spec: &mut ContractSpec,
    ) -> Result<(), Box<dyn Error>> {
        use stellar_xdr::curr::ScSpecEntry;

        match entry {
            ScSpecEntry::FunctionV0(func) => {
                // Skip internal functions (start with __)
                let name = func.name.to_utf8_string_lossy();
                if name.starts_with("__") {
                    return Ok(());
                }

                let function_spec = FunctionSpec {
                    name: name.clone(),
                    doc: if func.doc.len() > 0 {
                        Some(func.doc.to_utf8_string_lossy())
                    } else {
                        None
                    },
                    inputs: func
                        .inputs
                        .iter()
                        .map(|input| ParameterSpec {
                            name: input.name.to_utf8_string_lossy(),
                            doc: if input.doc.len() > 0 {
                                Some(input.doc.to_utf8_string_lossy())
                            } else {
                                None
                            },
                            type_ref: Self::convert_type(&input.type_),
                        })
                        .collect(),
                    output: func
                        .outputs
                        .first()
                        .map(|out| Self::convert_type(out)),
                };
                spec.functions.push(function_spec);
            }
            ScSpecEntry::UdtStructV0(struct_def) => {
                let type_spec = TypeSpec {
                    name: struct_def.name.to_utf8_string_lossy(),
                    doc: if struct_def.doc.len() > 0 {
                        Some(struct_def.doc.to_utf8_string_lossy())
                    } else {
                        None
                    },
                    definition: TypeDef::Struct {
                        fields: struct_def
                            .fields
                            .iter()
                            .map(|field| FieldSpec {
                                name: field.name.to_utf8_string_lossy(),
                                doc: if field.doc.len() > 0 {
                                    Some(field.doc.to_utf8_string_lossy())
                                } else {
                                    None
                                },
                                type_ref: Self::convert_type(&field.type_),
                            })
                            .collect(),
                    },
                };
                spec.types.push(type_spec);
            }
            ScSpecEntry::UdtUnionV0(union_def) => {
                let type_spec = TypeSpec {
                    name: union_def.name.to_utf8_string_lossy(),
                    doc: if union_def.doc.len() > 0 {
                        Some(union_def.doc.to_utf8_string_lossy())
                    } else {
                        None
                    },
                    definition: TypeDef::Union {
                        cases: union_def
                            .cases
                            .iter()
                            .map(|case| {
                                use stellar_xdr::curr::ScSpecUdtUnionCaseV0;
                                match case {
                                    ScSpecUdtUnionCaseV0::VoidV0(v) => UnionCase {
                                        name: v.name.to_utf8_string_lossy(),
                                        doc: if v.doc.len() > 0 {
                                            Some(v.doc.to_utf8_string_lossy())
                                        } else {
                                            None
                                        },
                                        type_ref: None,
                                    },
                                    ScSpecUdtUnionCaseV0::TupleV0(t) => UnionCase {
                                        name: t.name.to_utf8_string_lossy(),
                                        doc: if t.doc.len() > 0 {
                                            Some(t.doc.to_utf8_string_lossy())
                                        } else {
                                            None
                                        },
                                        type_ref: Some(TypeRef::Tuple(
                                            t.type_.iter().map(|ty| Self::convert_type(ty)).collect(),
                                        )),
                                    },
                                }
                            })
                            .collect(),
                    },
                };
                spec.types.push(type_spec);
            }
            ScSpecEntry::UdtEnumV0(enum_def) => {
                let type_spec = TypeSpec {
                    name: enum_def.name.to_utf8_string_lossy(),
                    doc: if enum_def.doc.len() > 0 {
                        Some(enum_def.doc.to_utf8_string_lossy())
                    } else {
                        None
                    },
                    definition: TypeDef::Enum {
                        variants: enum_def
                            .cases
                            .iter()
                            .map(|case| EnumVariant {
                                name: case.name.to_utf8_string_lossy(),
                                doc: if case.doc.len() > 0 {
                                    Some(case.doc.to_utf8_string_lossy())
                                } else {
                                    None
                                },
                                value: case.value,
                            })
                            .collect(),
                    },
                };
                spec.types.push(type_spec);
            }
            ScSpecEntry::UdtErrorEnumV0(error_enum) => {
                for case in error_enum.cases.iter() {
                    spec.errors.push(ErrorSpec {
                        name: case.name.to_utf8_string_lossy(),
                        doc: if case.doc.len() > 0 {
                            Some(case.doc.to_utf8_string_lossy())
                        } else {
                            None
                        },
                        code: case.value,
                    });
                }
            }
            ScSpecEntry::EventV0(_) => {
                // Events are informational, skip for now
            }
        }

        Ok(())
    }

    /// Convert stellar XDR type to our TypeRef
    fn convert_type(typ: &stellar_xdr::curr::ScSpecTypeDef) -> TypeRef {
        use stellar_xdr::curr::ScSpecTypeDef;

        match typ {
            ScSpecTypeDef::Bool => TypeRef::Bool,
            ScSpecTypeDef::Void => TypeRef::Void,
            ScSpecTypeDef::Error => TypeRef::Status,
            ScSpecTypeDef::U32 => TypeRef::U32,
            ScSpecTypeDef::I32 => TypeRef::I32,
            ScSpecTypeDef::U64 => TypeRef::U64,
            ScSpecTypeDef::I64 => TypeRef::I64,
            ScSpecTypeDef::Timepoint => TypeRef::Timepoint,
            ScSpecTypeDef::Duration => TypeRef::Duration,
            ScSpecTypeDef::U128 => TypeRef::U128,
            ScSpecTypeDef::I128 => TypeRef::I128,
            ScSpecTypeDef::U256 => TypeRef::U256,
            ScSpecTypeDef::I256 => TypeRef::I256,
            ScSpecTypeDef::Bytes => TypeRef::Bytes,
            ScSpecTypeDef::String => TypeRef::String,
            ScSpecTypeDef::Symbol => TypeRef::Symbol,
            ScSpecTypeDef::Address => TypeRef::Address,
            ScSpecTypeDef::Option(opt) => {
                TypeRef::Option(Box::new(Self::convert_type(&opt.value_type)))
            }
            ScSpecTypeDef::Result(res) => TypeRef::Result {
                ok: Box::new(Self::convert_type(&res.ok_type)),
                err: Box::new(Self::convert_type(&res.error_type)),
            },
            ScSpecTypeDef::Vec(vec) => {
                TypeRef::Vec(Box::new(Self::convert_type(&vec.element_type)))
            }
            ScSpecTypeDef::Map(map) => TypeRef::Map {
                key: Box::new(Self::convert_type(&map.key_type)),
                value: Box::new(Self::convert_type(&map.value_type)),
            },
            ScSpecTypeDef::Tuple(tuple) => {
                TypeRef::Tuple(tuple.value_types.iter().map(|t| Self::convert_type(t)).collect())
            }
            ScSpecTypeDef::BytesN(bytes_n) => TypeRef::BytesN(bytes_n.n),
            ScSpecTypeDef::Udt(udt) => TypeRef::Custom(udt.name.to_utf8_string_lossy()),
            ScSpecTypeDef::Val => TypeRef::Void,
            ScSpecTypeDef::MuxedAddress => TypeRef::Address,
        }
    }
}
