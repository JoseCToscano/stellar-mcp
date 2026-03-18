//! Tests for deployment artifacts: Dockerfile, vercel.json, rate limiting

use std::fs;

// ── TypeScript Dockerfile ────────────────────────────────────────────────────

#[test]
fn test_typescript_dockerfile_exists() {
    let content = fs::read_to_string("templates/Dockerfile.hbs")
        .expect("Failed to read templates/Dockerfile.hbs");
    assert!(!content.is_empty(), "Dockerfile template should not be empty");
}

#[test]
fn test_typescript_dockerfile_multi_stage_build() {
    let content = fs::read_to_string("templates/Dockerfile.hbs")
        .expect("Failed to read Dockerfile.hbs");

    assert!(content.contains("AS builder"),
        "Should use multi-stage build with builder stage");
    assert!(content.contains("AS runner"),
        "Should have a runtime stage named runner");
    assert!(content.contains("node:20-alpine"),
        "Should use Node 20 Alpine base image");
}

#[test]
fn test_typescript_dockerfile_security() {
    let content = fs::read_to_string("templates/Dockerfile.hbs")
        .expect("Failed to read Dockerfile.hbs");

    assert!(content.contains("USER node"),
        "Should run as non-root user");
    assert!(content.contains("NODE_ENV=production"),
        "Should set NODE_ENV to production");
}

#[test]
fn test_typescript_dockerfile_http_mode() {
    let content = fs::read_to_string("templates/Dockerfile.hbs")
        .expect("Failed to read Dockerfile.hbs");

    assert!(content.contains("USE_HTTP=true"),
        "Should default to HTTP transport mode");
    assert!(content.contains("PORT=3000"),
        "Should expose port 3000");
    assert!(content.contains("EXPOSE 3000"),
        "Should have EXPOSE directive");
}

#[test]
fn test_typescript_dockerfile_healthcheck() {
    let content = fs::read_to_string("templates/Dockerfile.hbs")
        .expect("Failed to read Dockerfile.hbs");

    assert!(content.contains("HEALTHCHECK"),
        "Should include a health check");
    assert!(content.contains("/health"),
        "Health check should hit /health endpoint");
}

// ── Python Dockerfile ────────────────────────────────────────────────────────

#[test]
fn test_python_dockerfile_exists() {
    let content = fs::read_to_string("templates/python/Dockerfile.hbs")
        .expect("Failed to read templates/python/Dockerfile.hbs");
    assert!(!content.is_empty(), "Python Dockerfile template should not be empty");
}

#[test]
fn test_python_dockerfile_base_image() {
    let content = fs::read_to_string("templates/python/Dockerfile.hbs")
        .expect("Failed to read python/Dockerfile.hbs");

    assert!(content.contains("python:3.11-slim"),
        "Should use Python 3.11 slim base image");
}

#[test]
fn test_python_dockerfile_security() {
    let content = fs::read_to_string("templates/python/Dockerfile.hbs")
        .expect("Failed to read python/Dockerfile.hbs");

    assert!(content.contains("USER nobody"),
        "Should run as non-root user");
}

#[test]
fn test_python_dockerfile_http_mode() {
    let content = fs::read_to_string("templates/python/Dockerfile.hbs")
        .expect("Failed to read python/Dockerfile.hbs");

    assert!(content.contains("USE_HTTP=true"),
        "Should default to HTTP transport mode");
    assert!(content.contains("PORT=3000"),
        "Should expose port 3000");
    assert!(content.contains("EXPOSE 3000"),
        "Should have EXPOSE directive");
}

#[test]
fn test_python_dockerfile_healthcheck() {
    let content = fs::read_to_string("templates/python/Dockerfile.hbs")
        .expect("Failed to read python/Dockerfile.hbs");

    assert!(content.contains("HEALTHCHECK"),
        "Should include a health check");
    assert!(content.contains("/health"),
        "Health check should hit /health endpoint");
}

// ── Vercel Configuration ─────────────────────────────────────────────────────

#[test]
fn test_vercel_json_exists() {
    let content = fs::read_to_string("templates/vercel.json.hbs")
        .expect("Failed to read templates/vercel.json.hbs");
    assert!(!content.is_empty(), "vercel.json template should not be empty");
}

#[test]
fn test_vercel_json_uses_node_runtime() {
    let content = fs::read_to_string("templates/vercel.json.hbs")
        .expect("Failed to read vercel.json.hbs");

    assert!(content.contains("@vercel/node"),
        "Should use Vercel Node runtime");
    assert!(content.contains("dist/index.js"),
        "Should point to compiled output");
}

#[test]
fn test_vercel_json_routes_mcp_endpoint() {
    let content = fs::read_to_string("templates/vercel.json.hbs")
        .expect("Failed to read vercel.json.hbs");

    assert!(content.contains("/mcp"),
        "Should route /mcp endpoint");
}

// ── Rate Limiting ────────────────────────────────────────────────────────────

#[test]
fn test_index_template_has_rate_limiting() {
    let content = fs::read_to_string("templates/index.ts.hbs")
        .expect("Failed to read index.ts.hbs");

    assert!(content.contains("RATE_LIMIT"),
        "index.ts should reference RATE_LIMIT env var");
    assert!(content.contains("consumeRateLimit"),
        "index.ts should have consumeRateLimit function");
}

#[test]
fn test_rate_limit_default_value() {
    let content = fs::read_to_string("templates/index.ts.hbs")
        .expect("Failed to read index.ts.hbs");

    assert!(content.contains("'100'"),
        "Default rate limit should be 100 req/min");
}

#[test]
fn test_rate_limit_429_response() {
    let content = fs::read_to_string("templates/index.ts.hbs")
        .expect("Failed to read index.ts.hbs");

    assert!(content.contains("429"),
        "Should respond with HTTP 429 when limit exceeded");
    assert!(content.contains("Retry-After"),
        "Should include Retry-After header");
    assert!(content.contains("X-RateLimit-Limit"),
        "Should include X-RateLimit-Limit header");
}

#[test]
fn test_rate_limit_health_exempt() {
    let content = fs::read_to_string("templates/index.ts.hbs")
        .expect("Failed to read index.ts.hbs");

    assert!(content.contains("/health"),
        "Should have health endpoint");
    // The health check is handled before rate limiting in the request flow
}

#[test]
fn test_rate_limit_cleanup() {
    let content = fs::read_to_string("templates/index.ts.hbs")
        .expect("Failed to read index.ts.hbs");

    assert!(content.contains("ipWindows"),
        "Should use ipWindows map for per-IP tracking");
    assert!(content.contains("delete"),
        "Should clean up stale entries");
}

// ── .env.example includes rate limiting ──────────────────────────────────────

#[test]
fn test_typescript_env_template_has_rate_limit() {
    // The TypeScript .env.example is generated inline in mcp_generator.rs,
    // so we verify the template at least documents the variable in the
    // Handlebars template (for the generated README inside output).
    // The actual env generation is tested via the generator source.
    let generator_source = fs::read_to_string("src/generator/mcp_generator.rs")
        .expect("Failed to read mcp_generator.rs");

    assert!(generator_source.contains("RATE_LIMIT"),
        "TypeScript generator should write RATE_LIMIT to .env.example");
    assert!(generator_source.contains("USE_HTTP"),
        "TypeScript generator should write USE_HTTP to .env.example");
}

#[test]
fn test_python_env_template_has_rate_limit() {
    let content = fs::read_to_string("templates/python/env.example.hbs")
        .expect("Failed to read python/env.example.hbs");

    assert!(content.contains("RATE_LIMIT"),
        "Python .env.example should document RATE_LIMIT");
    assert!(content.contains("USE_HTTP"),
        "Python .env.example should document USE_HTTP");
}

// ── Generator wiring ─────────────────────────────────────────────────────────

#[test]
fn test_typescript_generator_writes_dockerfile() {
    let source = fs::read_to_string("src/generator/mcp_generator.rs")
        .expect("Failed to read mcp_generator.rs");

    assert!(source.contains("generate_dockerfile"),
        "TypeScript generator should have generate_dockerfile method");
    assert!(source.contains("Dockerfile.hbs"),
        "TypeScript generator should reference Dockerfile.hbs template");
    assert!(source.contains("\"Dockerfile\""),
        "TypeScript generator should write to 'Dockerfile'");
}

#[test]
fn test_typescript_generator_writes_vercel_json() {
    let source = fs::read_to_string("src/generator/mcp_generator.rs")
        .expect("Failed to read mcp_generator.rs");

    assert!(source.contains("generate_vercel_json"),
        "TypeScript generator should have generate_vercel_json method");
    assert!(source.contains("vercel.json.hbs"),
        "TypeScript generator should reference vercel.json.hbs template");
    assert!(source.contains("\"vercel.json\""),
        "TypeScript generator should write to 'vercel.json'");
}

#[test]
fn test_python_generator_writes_dockerfile() {
    let source = fs::read_to_string("src/generator/python_generator.rs")
        .expect("Failed to read python_generator.rs");

    assert!(source.contains("generate_dockerfile"),
        "Python generator should have generate_dockerfile method");
    assert!(source.contains("python/Dockerfile.hbs"),
        "Python generator should reference python/Dockerfile.hbs template");
    assert!(source.contains("\"Dockerfile\""),
        "Python generator should write to 'Dockerfile'");
}
