//! Unit tests for template helpers

use stellar_mcp_generator::generator::{to_kebab_case, to_camel_case, to_pascal_case};

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
