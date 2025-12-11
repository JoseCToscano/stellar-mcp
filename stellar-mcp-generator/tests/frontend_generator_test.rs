//! Tests for frontend generator with AI integration

use stellar_mcp_generator::generator::FrontendGenerator;
use stellar_mcp_generator::NetworkConfig;
use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;

/// Helper to create a test network config
fn create_test_network() -> NetworkConfig {
    NetworkConfig::from_name("testnet").unwrap()
}

/// Helper to read file content
fn read_file(path: &PathBuf) -> String {
    fs::read_to_string(path).expect("Failed to read file")
}

#[test]
fn test_frontend_directory_structure() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let frontend_dir = temp_dir.path().join("frontend");

    // Check main directories
    assert!(frontend_dir.join("src/client").exists(), "src/client directory missing");
    assert!(frontend_dir.join("src/server").exists(), "src/server directory missing");
    assert!(frontend_dir.join("src/client/components").exists(), "components directory missing");
    assert!(frontend_dir.join("src/client/lib").exists(), "lib directory missing");
    assert!(frontend_dir.join("src/server/routes").exists(), "routes directory missing");
}

#[test]
fn test_package_json_contains_ai_dependencies() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let package_json_path = temp_dir.path().join("frontend/package.json");
    let content = read_file(&package_json_path);

    // Check AI SDK dependencies
    assert!(content.contains("\"ai\""), "Missing ai package");
    assert!(content.contains("\"@ai-sdk/openai\""), "Missing @ai-sdk/openai package");
    assert!(content.contains("\"@ai-sdk/anthropic\""), "Missing @ai-sdk/anthropic package");

    // Check Express dependencies
    assert!(content.contains("\"express\""), "Missing express package");
    assert!(content.contains("\"cors\""), "Missing cors package");
    assert!(content.contains("\"dotenv\""), "Missing dotenv package");

    // Check dev dependencies
    assert!(content.contains("\"tsx\""), "Missing tsx package");
    assert!(content.contains("\"concurrently\""), "Missing concurrently package");
    assert!(content.contains("\"@types/express\""), "Missing @types/express package");

    // Check Tailwind CSS PostCSS plugin (production dependency)
    assert!(content.contains("\"@tailwindcss/postcss\""), "Missing @tailwindcss/postcss package");
}

#[test]
fn test_package_json_scripts() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let package_json_path = temp_dir.path().join("frontend/package.json");
    let content = read_file(&package_json_path);

    // Check scripts
    assert!(content.contains("\"dev:client\""), "Missing dev:client script");
    assert!(content.contains("\"dev:server\""), "Missing dev:server script");
    assert!(content.contains("\"build:server\""), "Missing build:server script");
    assert!(content.contains("concurrently"), "Missing concurrently in dev script");
}

#[test]
fn test_server_files_generated() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let frontend_dir = temp_dir.path().join("frontend");

    // Check server files exist
    assert!(frontend_dir.join("src/server/index.ts").exists(), "server/index.ts missing");
    assert!(frontend_dir.join("src/server/routes/chat.ts").exists(), "server/routes/chat.ts missing");
}

#[test]
fn test_server_index_content() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let server_index_path = temp_dir.path().join("frontend/src/server/index.ts");
    let content = read_file(&server_index_path);

    // Check server setup
    assert!(content.contains("import express from 'express'"), "Missing express import");
    assert!(content.contains("import cors from 'cors'"), "Missing cors import");
    assert!(content.contains("import dotenv from 'dotenv'"), "Missing dotenv import");
    assert!(content.contains("from './routes/chat'"), "Missing chat router import");

    // Check middleware
    assert!(content.contains("app.use(cors())"), "Missing CORS middleware");
    assert!(content.contains("app.use(express.json())"), "Missing JSON middleware");

    // Check routes
    assert!(content.contains("app.use('/api', chatRouter)"), "Missing API routes");
    assert!(content.contains("/health"), "Missing health check endpoint");

    // Check server listen
    assert!(content.contains("app.listen"), "Missing server listen");
}

#[test]
fn test_chat_route_content() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let chat_route_path = temp_dir.path().join("frontend/src/server/routes/chat.ts");
    let content = read_file(&chat_route_path);

    // Check imports
    assert!(content.contains("import { Router } from 'express'"), "Missing Router import");
    assert!(content.contains("import { openai } from '@ai-sdk/openai'"), "Missing openai import");
    assert!(content.contains("import { anthropic } from '@ai-sdk/anthropic'"), "Missing anthropic import");
    assert!(content.contains("import { streamText } from 'ai'"), "Missing streamText import");

    // Check router creation
    assert!(content.contains("export const chatRouter = Router()"), "Missing router export");

    // Check endpoint
    assert!(content.contains("chatRouter.post('/chat'"), "Missing /chat endpoint");

    // Check AI provider logic
    assert!(content.contains("AI_PROVIDER"), "Missing AI_PROVIDER env check");
    assert!(content.contains("OPENAI_API_KEY"), "Missing OpenAI API key check");
    assert!(content.contains("ANTHROPIC_API_KEY"), "Missing Anthropic API key check");

    // Check streaming
    assert!(content.contains("streamText"), "Missing streamText call");
    assert!(content.contains("maxSteps"), "Missing maxSteps configuration");
}

#[test]
fn test_client_chat_components_generated() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let components_dir = temp_dir.path().join("frontend/src/client/components");

    // Check chat components exist
    assert!(components_dir.join("ChatInterface.tsx").exists(), "ChatInterface.tsx missing");
    assert!(components_dir.join("MessageList.tsx").exists(), "MessageList.tsx missing");
    assert!(components_dir.join("ChatInput.tsx").exists(), "ChatInput.tsx missing");

    // Check auth components still exist
    assert!(components_dir.join("AuthModeSelector.tsx").exists(), "AuthModeSelector.tsx missing");
    assert!(components_dir.join("SecretKeyInput.tsx").exists(), "SecretKeyInput.tsx missing");
    assert!(components_dir.join("WalletConnector.tsx").exists(), "WalletConnector.tsx missing");
}

#[test]
fn test_chat_interface_component() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let chat_interface_path = temp_dir.path().join("frontend/src/client/components/ChatInterface.tsx");
    let content = read_file(&chat_interface_path);

    // Check imports
    assert!(content.contains("import { useChat } from 'ai/react'"), "Missing useChat import");
    assert!(content.contains("from '../lib/mcp-client'"), "Missing MCP client import");
    assert!(content.contains("MessageList"), "Missing MessageList import");
    assert!(content.contains("ChatInput"), "Missing ChatInput import");

    // Check props
    assert!(content.contains("authMode"), "Missing authMode prop");
    assert!(content.contains("secretKey"), "Missing secretKey prop");
    assert!(content.contains("walletAddress"), "Missing walletAddress prop");

    // Check useChat hook usage
    assert!(content.contains("useChat({"), "Missing useChat hook call");
    assert!(content.contains("api:"), "Missing API endpoint config");
    assert!(content.contains("body:"), "Missing request body config");

    // Check UI elements
    assert!(content.contains("MessageList"), "Missing MessageList component");
    assert!(content.contains("ChatInput"), "Missing ChatInput component");
    assert!(content.contains("Start a conversation"), "Missing empty state message");
}

#[test]
fn test_message_list_component() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let message_list_path = temp_dir.path().join("frontend/src/client/components/MessageList.tsx");
    let content = read_file(&message_list_path);

    // Check imports
    assert!(content.contains("import { Message } from 'ai'"), "Missing Message import");

    // Check message rendering
    assert!(content.contains("messages.map"), "Missing message mapping");
    assert!(content.contains("message.role"), "Missing role check");
    assert!(content.contains("message.content"), "Missing content display");

    // Check tool invocations display
    assert!(content.contains("toolInvocations"), "Missing tool invocations");
    assert!(content.contains("tool.toolName"), "Missing tool name display");
    assert!(content.contains("tool.result"), "Missing tool result display");
}

#[test]
fn test_chat_input_component() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let chat_input_path = temp_dir.path().join("frontend/src/client/components/ChatInput.tsx");
    let content = read_file(&chat_input_path);

    // Check props
    assert!(content.contains("input: string"), "Missing input prop");
    assert!(content.contains("handleInputChange"), "Missing handleInputChange prop");
    assert!(content.contains("handleSubmit"), "Missing handleSubmit prop");
    assert!(content.contains("isLoading: boolean"), "Missing isLoading prop");

    // Check form elements
    assert!(content.contains("<form"), "Missing form element");
    assert!(content.contains("type=\"text\""), "Missing text input");
    assert!(content.contains("placeholder="), "Missing placeholder");
    assert!(content.contains("disabled={isLoading"), "Missing loading state");
}

#[test]
fn test_app_tsx_updated() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let app_path = temp_dir.path().join("frontend/src/client/App.tsx");
    let content = read_file(&app_path);

    // Check ChatInterface import
    assert!(content.contains("import { ChatInterface }"), "Missing ChatInterface import");

    // Check ChatInterface usage
    assert!(content.contains("<ChatInterface"), "Missing ChatInterface component");
    assert!(content.contains("authMode="), "Missing authMode prop");
    assert!(content.contains("secretKey="), "Missing secretKey prop");
    assert!(content.contains("walletAddress="), "Missing walletAddress prop");

    // Check auth components still present
    assert!(content.contains("AuthModeSelector"), "Missing AuthModeSelector");
    assert!(content.contains("SecretKeyInput"), "Missing SecretKeyInput");
    assert!(content.contains("WalletConnector"), "Missing WalletConnector");
}

#[test]
fn test_env_example_updated() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let env_path = temp_dir.path().join("frontend/.env.example");
    let content = read_file(&env_path);

    // Check AI provider config
    assert!(content.contains("AI_PROVIDER"), "Missing AI_PROVIDER");
    assert!(content.contains("OPENAI_API_KEY"), "Missing OPENAI_API_KEY");
    assert!(content.contains("ANTHROPIC_API_KEY"), "Missing ANTHROPIC_API_KEY");

    // Check backend config
    assert!(content.contains("API_PORT"), "Missing API_PORT");

    // Check MCP server config
    assert!(content.contains("VITE_MCP_SERVER_URL"), "Missing VITE_MCP_SERVER_URL");

    // Check frontend config
    assert!(content.contains("VITE_API_URL"), "Missing VITE_API_URL");

    // Check comments/instructions
    assert!(content.contains("https://platform.openai.com"), "Missing OpenAI link");
    assert!(content.contains("https://console.anthropic.com"), "Missing Anthropic link");
}

#[test]
fn test_readme_contains_ai_instructions() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let readme_path = temp_dir.path().join("frontend/README.md");
    let content = read_file(&readme_path);

    // Check AI mentions
    assert!(content.contains("AI"), "Missing AI references");
    assert!(content.contains("Chat"), "Missing chat references");
    assert!(content.contains("OpenAI"), "Missing OpenAI");
    assert!(content.contains("Anthropic"), "Missing Anthropic");

    // Check setup instructions
    assert!(content.contains("API key"), "Missing API key instructions");
    assert!(content.contains("OPENAI_API_KEY") || content.contains("API_KEY"), "Missing API key env var");

    // Check architecture section
    assert!(content.contains("Architecture") || content.contains("How It Works"), "Missing architecture section");

    // Check running instructions
    assert!(content.contains("dev:server") || content.contains("pnpm dev"), "Missing server start instructions");

    // Check troubleshooting
    assert!(content.contains("Troubleshooting") || content.contains("Common Issues"), "Missing troubleshooting section");
}

#[test]
fn test_mcp_client_unchanged() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let mcp_client_path = temp_dir.path().join("frontend/src/client/lib/mcp-client.ts");
    let content = read_file(&mcp_client_path);

    // Check it still uses use-mcp
    assert!(content.contains("import { useMcp } from 'use-mcp/react'"), "Missing use-mcp import");
    assert!(content.contains("export function useMcpClient()"), "Missing useMcpClient export");
    assert!(content.contains("connectionState"), "Missing connectionState");
    assert!(content.contains("availableTools"), "Missing availableTools");
    assert!(content.contains("executeTool"), "Missing executeTool");
}

#[test]
fn test_index_html_updated_path() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let index_html_path = temp_dir.path().join("frontend/index.html");
    let content = read_file(&index_html_path);

    // Check script path updated to client directory
    assert!(content.contains("/src/client/main.tsx"), "Script path not updated to client directory");
}

#[test]
fn test_files_in_correct_directories() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let frontend_dir = temp_dir.path().join("frontend");

    // Check client files are in src/client
    assert!(frontend_dir.join("src/client/App.tsx").exists(), "App.tsx not in client directory");
    assert!(frontend_dir.join("src/client/main.tsx").exists(), "main.tsx not in client directory");
    assert!(frontend_dir.join("src/client/index.css").exists(), "index.css not in client directory");

    // Check components are in src/client/components
    assert!(frontend_dir.join("src/client/components/ChatInterface.tsx").exists());
    assert!(frontend_dir.join("src/client/components/MessageList.tsx").exists());
    assert!(frontend_dir.join("src/client/components/ChatInput.tsx").exists());

    // Check lib is in src/client/lib
    assert!(frontend_dir.join("src/client/lib/mcp-client.ts").exists());

    // Check server files are in src/server
    assert!(frontend_dir.join("src/server/index.ts").exists());
    assert!(frontend_dir.join("src/server/routes/chat.ts").exists());
}

#[test]
fn test_no_old_src_directory() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let frontend_dir = temp_dir.path().join("frontend");

    // Ensure old paths don't exist
    assert!(!frontend_dir.join("src/App.tsx").exists(), "Old App.tsx path should not exist");
    assert!(!frontend_dir.join("src/main.tsx").exists(), "Old main.tsx path should not exist");
    assert!(!frontend_dir.join("src/components/ChatInterface.tsx").exists(), "Old components path should not exist");
}

#[test]
fn test_postcss_config_uses_tailwindcss_postcss() {
    let temp_dir = TempDir::new().unwrap();
    let network = create_test_network();
    let generator = FrontendGenerator::new(temp_dir.path(), "test-contract", &network);

    generator.generate().expect("Generation failed");

    let postcss_path = temp_dir.path().join("frontend/postcss.config.js");
    let content = read_file(&postcss_path);

    // Check it uses @tailwindcss/postcss instead of tailwindcss
    assert!(content.contains("'@tailwindcss/postcss'"), "Missing @tailwindcss/postcss plugin");
    assert!(content.contains("autoprefixer"), "Missing autoprefixer plugin");
    assert!(!content.contains("tailwindcss: {}"), "Should not use old tailwindcss plugin syntax");
}

#[test]
fn test_architecture_documentation_exists() {
    // Check ARCHITECTURE.md exists in project root
    let arch_path = PathBuf::from("ARCHITECTURE.md");
    assert!(arch_path.exists(), "ARCHITECTURE.md missing from project root");

    let content = read_file(&arch_path);

    // Check key sections
    assert!(content.contains("Architecture"), "Missing architecture section");
    assert!(content.contains("Express"), "Missing Express documentation");
    assert!(content.contains("AI"), "Missing AI integration documentation");
    assert!(content.contains("MCP"), "Missing MCP documentation");
    assert!(content.contains("OpenAI") || content.contains("Anthropic"), "Missing AI provider docs");
}
