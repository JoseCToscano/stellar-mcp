//! Unit tests for spec module

use stellar_mcp_generator::spec::types::*;

#[test]
fn test_type_ref_to_typescript() {
    assert_eq!(TypeRef::Bool.to_typescript(), "boolean");
    assert_eq!(TypeRef::U32.to_typescript(), "number");
    assert_eq!(TypeRef::I64.to_typescript(), "bigint");
    assert_eq!(TypeRef::String.to_typescript(), "string");
    assert_eq!(TypeRef::Address.to_typescript(), "string");
    assert_eq!(TypeRef::Bytes.to_typescript(), "string"); // Hex or base64 encoded
}

#[test]
fn test_type_ref_to_zod() {
    assert_eq!(TypeRef::Bool.to_zod(), "z.boolean()");
    assert_eq!(TypeRef::U32.to_zod(), "z.number()");
    assert_eq!(TypeRef::String.to_zod(), "z.string()");
    assert_eq!(TypeRef::Address.to_zod(), "z.string().length(56)");
}

#[test]
fn test_option_type() {
    let opt_bool = TypeRef::Option(Box::new(TypeRef::Bool));
    assert_eq!(opt_bool.to_typescript(), "boolean | null");
    assert_eq!(opt_bool.to_zod(), "z.boolean().nullable()");
}

#[test]
fn test_vec_type() {
    let vec_string = TypeRef::Vec(Box::new(TypeRef::String));
    assert_eq!(vec_string.to_typescript(), "string[]");
    assert_eq!(vec_string.to_zod(), "z.array(z.string())");
}

#[test]
fn test_map_type() {
    let map_type = TypeRef::Map {
        key: Box::new(TypeRef::String),
        value: Box::new(TypeRef::U64),
    };
    assert_eq!(map_type.to_typescript(), "Map<string, bigint>");
    assert_eq!(map_type.to_zod(), "z.map(z.string(), z.string())");
}

#[test]
fn test_contract_spec_default() {
    let spec = ContractSpec::default();
    assert!(spec.functions.is_empty());
    assert!(spec.types.is_empty());
    assert!(spec.errors.is_empty());
}
