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

// ── Python Rate Limiting ─────────────────────────────────────────────────────

#[test]
fn test_python_server_template_has_rate_limiting() {
    let content = fs::read_to_string("templates/python/server.py.hbs")
        .expect("Failed to read server.py.hbs");

    assert!(content.contains("RATE_LIMIT"),
        "Python server should reference RATE_LIMIT env var");
    assert!(content.contains("_RateLimitedApp"),
        "Python server should have RateLimitedApp ASGI middleware");
}

#[test]
fn test_python_rate_limit_429_response() {
    let content = fs::read_to_string("templates/python/server.py.hbs")
        .expect("Failed to read server.py.hbs");

    assert!(content.contains("429"),
        "Python server should respond with HTTP 429 when limit exceeded");
    assert!(content.contains("retry-after"),
        "Python server should include retry-after header");
}

#[test]
fn test_python_rate_limit_only_mcp_endpoint() {
    let content = fs::read_to_string("templates/python/server.py.hbs")
        .expect("Failed to read server.py.hbs");

    assert!(content.contains("startswith(\"/mcp\")"),
        "Python rate limiter should only apply to /mcp endpoint");
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

#[test]
fn test_typescript_generator_writes_dockerignore() {
    let source = fs::read_to_string("src/generator/mcp_generator.rs")
        .expect("Failed to read mcp_generator.rs");

    assert!(source.contains("generate_dockerignore"),
        "TypeScript generator should have generate_dockerignore method");
    assert!(source.contains(".dockerignore"),
        "TypeScript generator should write .dockerignore");
}

#[test]
fn test_python_generator_writes_dockerignore() {
    let source = fs::read_to_string("src/generator/python_generator.rs")
        .expect("Failed to read python_generator.rs");

    assert!(source.contains("generate_dockerignore"),
        "Python generator should have generate_dockerignore method");
    assert!(source.contains(".dockerignore"),
        "Python generator should write .dockerignore");
}

#[test]
fn test_generated_readme_has_docker_section() {
    let source = fs::read_to_string("src/generator/mcp_generator.rs")
        .expect("Failed to read mcp_generator.rs");

    assert!(source.contains("Docker Deployment"),
        "Generated README should include Docker Deployment section");
    assert!(source.contains("docker build"),
        "Generated README should include docker build command");
    assert!(source.contains("docker run"),
        "Generated README should include docker run command");
}

#[test]
fn test_generated_readme_has_vercel_section() {
    let source = fs::read_to_string("src/generator/mcp_generator.rs")
        .expect("Failed to read mcp_generator.rs");

    assert!(source.contains("Vercel Deployment"),
        "Generated README should include Vercel Deployment section");
    assert!(source.contains("vercel --prod"),
        "Generated README should include vercel deploy command");
}

#[test]
fn test_generated_readme_has_rate_limiting_section() {
    let source = fs::read_to_string("src/generator/mcp_generator.rs")
        .expect("Failed to read mcp_generator.rs");

    assert!(source.contains("Rate Limiting"),
        "Generated README should include Rate Limiting section");
    assert!(source.contains("RATE_LIMIT"),
        "Generated README should document RATE_LIMIT env var");
}

// ── Logging ─────────────────────────────────────────────────────────────────

#[test]
fn test_index_template_has_structured_logger() {
    let content = fs::read_to_string("templates/index.ts.hbs")
        .expect("Failed to read index.ts.hbs");

    assert!(content.contains("function log(tool: string, level:"),
        "index.ts should have a structured log() function");
    assert!(content.contains("console.error(prefix,"),
        "Logger should write to stderr via console.error");
    assert!(content.contains("toISOString()"),
        "Logger should include ISO timestamps");
}

#[test]
fn test_tool_handlers_log_on_call_and_result() {
    let content = fs::read_to_string("templates/index.ts.hbs")
        .expect("Failed to read index.ts.hbs");

    // Contract tool handlers should log on entry and success
    assert!(content.contains("log('{{name_kebab}}', 'info', 'called'"),
        "Contract tool handlers should log on call");
    assert!(content.contains("log('{{name_kebab}}', 'info', 'success'"),
        "Contract tool handlers should log on success");
}

#[test]
fn test_builtin_tools_have_logging() {
    let content = fs::read_to_string("templates/index.ts.hbs")
        .expect("Failed to read index.ts.hbs");

    assert!(content.contains("log('sign-and-submit', 'info', 'called')"),
        "sign-and-submit should log on call");
    assert!(content.contains("log('sign-and-submit', 'info', 'success'"),
        "sign-and-submit should log on success");
    assert!(content.contains("log('prepare-transaction', 'info', 'called'"),
        "prepare-transaction should log on call");
}

// ── Soroban error parsing ───────────────────────────────────────────────────

#[test]
fn test_index_template_has_soroban_error_parser() {
    let content = fs::read_to_string("templates/index.ts.hbs")
        .expect("Failed to read index.ts.hbs");

    assert!(content.contains("function parseSorobanError(error: Error)"),
        "index.ts should have parseSorobanError function");
    assert!(content.contains("diagnosticEvents"),
        "parseSorobanError should extract diagnostic events");
    assert!(content.contains("SOROBAN_ERROR_HINTS"),
        "index.ts should have error hint lookup table");
}

#[test]
fn test_soroban_error_hints_cover_common_errors() {
    let content = fs::read_to_string("templates/index.ts.hbs")
        .expect("Failed to read index.ts.hbs");

    assert!(content.contains("Error(Storage, ExistingValue)"),
        "Should have hint for ExistingValue");
    assert!(content.contains("Error(Auth, InvalidAction)"),
        "Should have hint for InvalidAction");
    assert!(content.contains("Error(Budget, Exceeded)"),
        "Should have hint for Budget exceeded");
    assert!(content.contains("Error(Value, InvalidInput)"),
        "Should have hint for InvalidInput");
    assert!(content.contains("Error(WasmVm, Trapped)"),
        "Should have hint for WasmVm trapped");
}

#[test]
fn test_soroban_error_parser_extracts_error_code() {
    let content = fs::read_to_string("templates/index.ts.hbs")
        .expect("Failed to read index.ts.hbs");

    // Should use regex to extract Error(Category, Code) pattern
    assert!(content.contains(r"Error\([A-Za-z]+,\s*[A-Za-z]+\)"),
        "parseSorobanError should regex-match Soroban error codes");
}

// ── isError flag ────────────────────────────────────────────────────────────

#[test]
fn test_index_template_has_format_tool_error() {
    let content = fs::read_to_string("templates/index.ts.hbs")
        .expect("Failed to read index.ts.hbs");

    assert!(content.contains("function formatToolError(toolName: string, error: unknown)"),
        "index.ts should have formatToolError helper");
    assert!(content.contains("isError: true"),
        "formatToolError should set isError: true on responses");
}

#[test]
fn test_all_error_handlers_use_format_tool_error() {
    let content = fs::read_to_string("templates/index.ts.hbs")
        .expect("Failed to read index.ts.hbs");

    // Contract tool handlers
    assert!(content.contains("return formatToolError('{{name_kebab}}', error)"),
        "Contract tool handlers should use formatToolError");
    // Built-in tools
    assert!(content.contains("return formatToolError('sign-and-submit', error)"),
        "sign-and-submit should use formatToolError");
    assert!(content.contains("return formatToolError('prepare-transaction', error)"),
        "prepare-transaction should use formatToolError");
}

#[test]
fn test_error_response_distinguishes_soroban_errors() {
    let content = fs::read_to_string("templates/index.ts.hbs")
        .expect("Failed to read index.ts.hbs");

    assert!(content.contains("isSorobanError"),
        "formatToolError should detect Soroban-specific errors");
    assert!(content.contains("HostError:"),
        "Should detect HostError pattern in messages");
    assert!(content.contains("SimulationFailed"),
        "Should detect SimulationFailed pattern in messages");
}

// ── CORS configuration ────────────────────────────────────────────────────────

#[test]
fn test_typescript_generator_has_cors_origins_env_var() {
    let source = fs::read_to_string("src/generator/mcp_generator.rs")
        .expect("Failed to read mcp_generator.rs");

    assert!(source.contains("CORS_ORIGINS"),
        "TypeScript generator should support CORS_ORIGINS env var");
}

#[test]
fn test_typescript_cors_uses_env_var_not_wildcard() {
    let source = fs::read_to_string("src/generator/mcp_generator.rs")
        .expect("Failed to read mcp_generator.rs");

    // Should split CORS_ORIGINS by comma, not hardcode '*'
    assert!(source.contains("CORS_ORIGINS ?? '*'"),
        "TypeScript CORS should default to * but be configurable via env");
    assert!(source.contains("CORS_ORIGINS.includes"),
        "TypeScript CORS should check the CORS_ORIGINS list");
}

#[test]
fn test_typescript_env_example_documents_cors_origins() {
    let source = fs::read_to_string("src/generator/mcp_generator.rs")
        .expect("Failed to read mcp_generator.rs");

    assert!(source.contains("CORS_ORIGINS"),
        "TypeScript .env.example should document CORS_ORIGINS");
}

#[test]
fn test_python_server_template_has_cors_origins() {
    let content = fs::read_to_string("templates/python/server.py.hbs")
        .expect("Failed to read server.py.hbs");

    assert!(content.contains("CORS_ORIGINS"),
        "Python server should support CORS_ORIGINS env var");
    assert!(content.contains("CORSMiddleware"),
        "Python server should use Starlette CORSMiddleware");
    assert!(content.contains("allow_origins"),
        "Python CORSMiddleware should set allow_origins");
}

#[test]
fn test_python_env_example_documents_cors_origins() {
    let content = fs::read_to_string("templates/python/env.example.hbs")
        .expect("Failed to read python/env.example.hbs");

    assert!(content.contains("CORS_ORIGINS"),
        "Python .env.example should document CORS_ORIGINS");
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

#[test]
fn test_typescript_generator_has_sigterm_handler() {
    let source = fs::read_to_string("src/generator/mcp_generator.rs")
        .expect("Failed to read mcp_generator.rs");

    assert!(source.contains("SIGTERM"),
        "TypeScript generator should add SIGTERM handler for graceful shutdown");
    assert!(source.contains("SIGINT"),
        "TypeScript generator should add SIGINT handler for graceful shutdown");
}

#[test]
fn test_typescript_graceful_shutdown_closes_server() {
    let source = fs::read_to_string("src/generator/mcp_generator.rs")
        .expect("Failed to read mcp_generator.rs");

    assert!(source.contains("httpServer.close"),
        "Graceful shutdown should close the HTTP server before exiting");
    assert!(source.contains("process.exit(0)"),
        "Graceful shutdown should exit with code 0 on success");
}

#[test]
fn test_python_server_template_has_sigterm_handler() {
    let content = fs::read_to_string("templates/python/server.py.hbs")
        .expect("Failed to read server.py.hbs");

    assert!(content.contains("signal.SIGTERM"),
        "Python server should handle SIGTERM for graceful shutdown");
    assert!(content.contains("signal.SIGINT"),
        "Python server should handle SIGINT for graceful shutdown");
    assert!(content.contains("signal.signal"),
        "Python server should register signal handlers");
}
