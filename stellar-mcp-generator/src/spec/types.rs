//! Types representing parsed contract specifications

use serde::{Deserialize, Serialize};

/// Parsed contract specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractSpec {
    /// Contract name (from metadata if available)
    pub name: Option<String>,
    /// Contract functions
    pub functions: Vec<FunctionSpec>,
    /// Custom types defined in the contract
    pub types: Vec<TypeSpec>,
    /// Contract errors
    pub errors: Vec<ErrorSpec>,
    /// Raw XDR spec entries (base64 encoded) for SDK ContractSpec
    pub raw_spec_entries: Vec<String>,
}

impl ContractSpec {
    pub fn new() -> Self {
        Self {
            name: None,
            functions: Vec::new(),
            types: Vec::new(),
            errors: Vec::new(),
            raw_spec_entries: Vec::new(),
        }
    }
}

impl Default for ContractSpec {
    fn default() -> Self {
        Self::new()
    }
}

/// Function specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionSpec {
    /// Function name
    pub name: String,
    /// Function documentation
    pub doc: Option<String>,
    /// Function parameters
    pub inputs: Vec<ParameterSpec>,
    /// Return type
    pub output: Option<TypeRef>,
}

/// Parameter specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterSpec {
    /// Parameter name
    pub name: String,
    /// Parameter documentation
    pub doc: Option<String>,
    /// Parameter type
    pub type_ref: TypeRef,
}

/// Type reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TypeRef {
    /// Primitive types
    Bool,
    Void,
    Status,
    U32,
    I32,
    U64,
    I64,
    Timepoint,
    Duration,
    U128,
    I128,
    U256,
    I256,
    Bytes,
    String,
    Symbol,
    Address,

    /// Option type
    Option(Box<TypeRef>),

    /// Result type
    Result {
        ok: Box<TypeRef>,
        err: Box<TypeRef>,
    },

    /// Vector type
    Vec(Box<TypeRef>),

    /// Map type
    Map {
        key: Box<TypeRef>,
        value: Box<TypeRef>,
    },

    /// Tuple type
    Tuple(Vec<TypeRef>),

    /// Fixed-size bytes
    BytesN(u32),

    /// Custom/user-defined type
    Custom(String),
}

impl TypeRef {
    /// Convert to TypeScript type string
    pub fn to_typescript(&self) -> String {
        match self {
            TypeRef::Bool => "boolean".to_string(),
            TypeRef::Void => "void".to_string(),
            TypeRef::Status => "number".to_string(),
            TypeRef::U32 | TypeRef::I32 => "number".to_string(),
            TypeRef::U64 | TypeRef::I64 => "bigint".to_string(),
            TypeRef::Timepoint | TypeRef::Duration => "bigint".to_string(),
            TypeRef::U128 | TypeRef::I128 | TypeRef::U256 | TypeRef::I256 => "bigint".to_string(),
            TypeRef::Bytes => "string".to_string(), // Hex or base64 encoded
            TypeRef::String | TypeRef::Symbol => "string".to_string(),
            TypeRef::Address => "string".to_string(),
            TypeRef::Option(inner) => format!("{} | null", inner.to_typescript()),
            TypeRef::Result { ok, .. } => ok.to_typescript(),
            TypeRef::Vec(inner) => format!("{}[]", inner.to_typescript()),
            TypeRef::Map { key, value } => {
                format!("Map<{}, {}>", key.to_typescript(), value.to_typescript())
            }
            TypeRef::Tuple(types) => {
                let ts: Vec<String> = types.iter().map(|t| t.to_typescript()).collect();
                format!("[{}]", ts.join(", "))
            }
            TypeRef::BytesN(_) => "string".to_string(), // Hex encoded
            TypeRef::Custom(name) => name.clone(),
        }
    }

    /// Convert to Zod schema string
    pub fn to_zod(&self) -> String {
        match self {
            TypeRef::Bool => "z.boolean()".to_string(),
            TypeRef::Void => "z.void()".to_string(),
            TypeRef::Status => "z.number()".to_string(),
            TypeRef::U32 | TypeRef::I32 => "z.number()".to_string(),
            TypeRef::U64 | TypeRef::I64 => "z.string()".to_string(), // BigInt as string
            TypeRef::Timepoint | TypeRef::Duration => "z.string()".to_string(),
            TypeRef::U128 | TypeRef::I128 | TypeRef::U256 | TypeRef::I256 => {
                "z.string()".to_string()
            }
            TypeRef::Bytes => "z.string()".to_string(), // Base64 encoded
            TypeRef::String | TypeRef::Symbol => "z.string()".to_string(),
            TypeRef::Address => "z.string().length(56)".to_string(),
            TypeRef::Option(inner) => format!("{}.nullable()", inner.to_zod()),
            TypeRef::Result { ok, .. } => ok.to_zod(),
            TypeRef::Vec(inner) => format!("z.array({})", inner.to_zod()),
            TypeRef::Map { key, value } => {
                format!("z.map({}, {})", key.to_zod(), value.to_zod())
            }
            TypeRef::Tuple(types) => {
                let zods: Vec<String> = types.iter().map(|t| t.to_zod()).collect();
                format!("z.tuple([{}])", zods.join(", "))
            }
            TypeRef::BytesN(n) => format!("z.string().length({})", n * 2), // Hex encoded
            TypeRef::Custom(name) => format!("{}Schema", name),
        }
    }

    /// Convert to Python/Pydantic type hint
    pub fn to_pydantic(&self) -> String {
        match self {
            TypeRef::Bool => "bool".to_string(),
            TypeRef::Void => "None".to_string(),
            TypeRef::Status => "int".to_string(),
            TypeRef::U32 | TypeRef::I32 => "int".to_string(),
            TypeRef::U64 | TypeRef::I64 => "int".to_string(),
            TypeRef::Timepoint | TypeRef::Duration => "int".to_string(),
            TypeRef::U128 | TypeRef::I128 | TypeRef::U256 | TypeRef::I256 => "str".to_string(), // BigInt as string
            TypeRef::Bytes => "bytes".to_string(),
            TypeRef::String | TypeRef::Symbol => "str".to_string(),
            TypeRef::Address => "str".to_string(),
            TypeRef::Option(inner) => format!("Optional[{}]", inner.to_pydantic()),
            TypeRef::Result { ok, .. } => ok.to_pydantic(), // Result mapped to ok type (errors handled separately)
            TypeRef::Vec(inner) => format!("List[{}]", inner.to_pydantic()),
            TypeRef::Map { key, value } => {
                format!("Dict[{}, {}]", key.to_pydantic(), value.to_pydantic())
            }
            TypeRef::Tuple(types) => {
                let type_strs: Vec<String> = types.iter().map(|t| t.to_pydantic()).collect();
                format!("Tuple[{}]", type_strs.join(", "))
            }
            TypeRef::BytesN(_) => "str".to_string(), // Hex string
            TypeRef::Custom(name) => format!("{}Schema", name), // Pydantic model name
        }
    }

    /// Convert to Pydantic Field definition
    pub fn to_pydantic_field(&self, field_name: &str, description: &str, required: bool) -> String {
        let field_type = self.to_pydantic();
        let desc_safe = description.replace('"', "\\\"").replace('\n', " ");

        match self {
            TypeRef::Address => {
                // Validate Stellar address (56 chars, starts with G or C)
                if required {
                    format!(
                        "{}: str = Field(..., min_length=56, max_length=56, description=\"{}\")",
                        field_name, desc_safe
                    )
                } else {
                    format!(
                        "{}: Optional[str] = Field(None, min_length=56, max_length=56, description=\"{}\")",
                        field_name, desc_safe
                    )
                }
            }
            TypeRef::BytesN(n) => {
                // Validate hex string length (2 hex chars per byte)
                let hex_len = n * 2;
                if required {
                    format!(
                        "{}: str = Field(..., min_length={}, max_length={}, description=\"{}\")",
                        field_name, hex_len, hex_len, desc_safe
                    )
                } else {
                    format!(
                        "{}: Optional[str] = Field(None, min_length={}, max_length={}, description=\"{}\")",
                        field_name, hex_len, hex_len, desc_safe
                    )
                }
            }
            TypeRef::Option(_) => {
                // Optional field with default None
                format!(
                    "{}: {} = Field(None, description=\"{}\")",
                    field_name, field_type, desc_safe
                )
            }
            _ => {
                // Standard field
                if required {
                    format!(
                        "{}: {} = Field(..., description=\"{}\")",
                        field_name, field_type, desc_safe
                    )
                } else {
                    format!(
                        "{}: {} = Field(None, description=\"{}\")",
                        field_name, field_type, desc_safe
                    )
                }
            }
        }
    }
}

/// Custom type specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeSpec {
    /// Type name
    pub name: String,
    /// Type documentation
    pub doc: Option<String>,
    /// Type definition
    pub definition: TypeDef,
}

/// Type definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TypeDef {
    /// Struct type
    Struct { fields: Vec<FieldSpec> },
    /// Enum type
    Enum { variants: Vec<EnumVariant> },
    /// Union type
    Union { cases: Vec<UnionCase> },
}

/// Struct field specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldSpec {
    /// Field name
    pub name: String,
    /// Field documentation
    pub doc: Option<String>,
    /// Field type
    pub type_ref: TypeRef,
}

/// Enum variant
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnumVariant {
    /// Variant name
    pub name: String,
    /// Variant documentation
    pub doc: Option<String>,
    /// Variant value
    pub value: u32,
}

/// Union case
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnionCase {
    /// Case name
    pub name: String,
    /// Case documentation
    pub doc: Option<String>,
    /// Case type (None for unit variant)
    pub type_ref: Option<TypeRef>,
}

/// Error specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorSpec {
    /// Error name
    pub name: String,
    /// Error documentation
    pub doc: Option<String>,
    /// Error code
    pub code: u32,
}
