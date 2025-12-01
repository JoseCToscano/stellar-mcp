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
