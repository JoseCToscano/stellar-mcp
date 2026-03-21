//! Unit tests for template helpers

use stellar_mcp_generator::generator::{to_kebab_case, to_camel_case, to_pascal_case,
    output_zod_for_type, output_schema_raw_shape};
use stellar_mcp_generator::spec::TypeRef;

#[test]
fn test_to_kebab_case() {
    assert_eq!(to_kebab_case("helloWorld"), "hello-world");
    assert_eq!(to_kebab_case("hello_world"), "hello-world");
    assert_eq!(to_kebab_case("HelloWorld"), "hello-world");
    assert_eq!(to_kebab_case("hello"), "hello");
    assert_eq!(to_kebab_case("HELLO"), "h-e-l-l-o");
}

#[test]
fn test_to_camel_case() {
    assert_eq!(to_camel_case("hello_world"), "helloWorld");
    assert_eq!(to_camel_case("hello-world"), "helloWorld");
    assert_eq!(to_camel_case("HelloWorld"), "helloWorld");
    assert_eq!(to_camel_case("hello"), "hello");
}

#[test]
fn test_to_pascal_case() {
    assert_eq!(to_pascal_case("hello_world"), "HelloWorld");
    assert_eq!(to_pascal_case("hello-world"), "HelloWorld");
    assert_eq!(to_pascal_case("helloWorld"), "HelloWorld");
    assert_eq!(to_pascal_case("hello"), "Hello");
}

// ── outputSchema helpers ──────────────────────────────────────────────────────

#[test]
fn test_output_zod_for_type_address() {
    // Address → z.string() (no schemas. prefix needed for primitives)
    let result = output_zod_for_type(&TypeRef::Address);
    assert_eq!(result, "z.string()");
}

#[test]
fn test_output_zod_for_type_custom() {
    // Custom types must get the `schemas.` namespace prefix so the generated
    // index.ts can reference the imported schema object.
    let result = output_zod_for_type(&TypeRef::Custom("TokenConfig".to_string()));
    assert_eq!(result, "schemas.TokenConfigSchema");
}

#[test]
fn test_output_zod_for_type_vec_custom() {
    // Vec<CustomType> → z.array(schemas.CustomTypeSchema)
    let inner = TypeRef::Custom("TokenInfo".to_string());
    let result = output_zod_for_type(&TypeRef::Vec(Box::new(inner)));
    assert_eq!(result, "z.array(schemas.TokenInfoSchema)");
}

#[test]
fn test_output_schema_raw_shape_void() {
    // A void (or absent) return value only needs xdr in the output schema
    assert_eq!(output_schema_raw_shape(&None), "{ xdr: z.string() }");
    assert_eq!(
        output_schema_raw_shape(&Some(TypeRef::Void)),
        "{ xdr: z.string() }"
    );
}

#[test]
fn test_output_schema_raw_shape_address() {
    // Address return → both xdr and simulationResult (z.unknown() to handle SDK type wrapping)
    let shape = output_schema_raw_shape(&Some(TypeRef::Address));
    assert!(shape.contains("xdr: z.string()"), "missing xdr field: {}", shape);
    assert!(shape.contains("simulationResult:"), "missing simulationResult: {}", shape);
    assert!(shape.contains("z.unknown()"), "simulationResult should use z.unknown(): {}", shape);
    assert!(shape.contains(".optional()"), "simulationResult should be optional: {}", shape);
}
