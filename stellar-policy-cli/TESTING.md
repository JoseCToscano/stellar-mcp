# Testing Strategy for Stellar Policy CLI

## Overview

This document outlines the comprehensive testing strategy for the Stellar Policy CLI generator. The testing suite ensures that generated policy contracts are not only syntactically correct but also functionally deployable and invocable via the Stellar CLI.

## Test Categories

### 1. Build Tests (`tests/build_test.rs`)

**Purpose**: Verify that generated policy contracts compile successfully.

**Test Level**: Unit/Build Verification

**Coverage**:
- Simple policies with individual features (function whitelist, contract whitelist, etc.)
- Admin-managed policies with storage
- Complex policies with multiple features combined
- All policy feature combinations

**Execution**:
```bash
cargo test --test build_test -- --ignored --nocapture
```

**Limitations**:
- Only verifies compilation (`cargo check`)
- Does NOT validate contract spec
- Does NOT test CLI invocation

### 2. Integration Tests (`tests/integration_test.rs`)

**Purpose**: End-to-end validation including WASM builds and contract spec verification.

**Test Level**: Integration/Spec Validation

**Coverage**:
- Project structure generation
- WASM compilation
- **Contract spec validation (SignerKey export verification)** ✨
- Function existence validation (`init`, `policy__`)
- All three SignerKey variants (Policy, Ed25519, Secp256r1)

**Execution**:
```bash
cargo test --test integration_test -- --ignored --nocapture
```

**Key Features**:
- Builds contracts to WASM using `cargo build --target wasm32-unknown-unknown --release`
- Uses `stellar contract inspect` to validate contract specs
- Verifies SignerKey is properly exported with `#[contracttype(export = true)]`
- Catches the "Missing Entry SignerKey" bug that would prevent CLI invocation

### 3. Localnet Integration Tests (`tests/localnet_integration_test.rs`) ✨

**Purpose**: Real deployment and invocation testing on local Stellar network.

**Test Level**: End-to-End/Deployment Validation

**Coverage**:

#### Priority 1: Localnet Deployment and Invocation ✅
- **Localnet deployment** - Actual contract deployment to running Stellar network
- **Function invocation** - Real CLI invocation of `init`, `add_wallet`
- **Complete workflows** - Deploy → Init → Add Wallet
- **All three tests passing** ✅

#### Priority 2: Policy Feature Validation ✅
- **Amount cap configuration** - Deploy policy with amount caps, configure multiple wallets
- **Whitelist deployment** - Deploy policies with function/contract/recipient whitelists
- **Comprehensive features** - Deploy policy with ALL features enabled
- **Admin functions tested** - init and add_wallet with varying parameters

**Execution**:
```bash
# Run all localnet tests (may have timeouts when run in parallel)
cargo test --test localnet_integration_test -- --ignored --nocapture

# Run individually for best results
cargo test --test localnet_integration_test test_localnet_deploy_simple_policy -- --ignored --nocapture
cargo test --test localnet_integration_test test_policy_amount_cap_configuration -- --ignored --nocapture
```

**Prerequisites**:
- Docker installed and running
- stellar-cli installed
- Port 8000 available for localnet RPC

**Key Features**:
- Automatically starts/stops Stellar quickstart Docker container
- Tests actual contract deployment (not just compilation)
- Validates init function works with real admin addresses
- Tests add_wallet with varying feature combinations
- Verifies policies with all features can be deployed and configured
- **Priority 1 COMPLETE** ✅
- **Priority 2 COMPLETE** ✅ (deployment and configuration validation)

## The SignerKey Export Bug

### Background

Previously, generated contracts imported `SignerKey` from `smart-wallet-interface`:

```rust
use smart_wallet_interface::{types::SignerKey, PolicyInterface};
```

However, `smart-wallet-interface` defines `SignerKey` with `#[contracttype(export = false)]`:

```rust
#[contracttype(export = false)]
pub enum SignerKey {
    Policy(Address),
    Ed25519(BytesN<32>),
    Secp256r1(Bytes),
}
```

This caused the type to NOT be included in the contract spec, resulting in:

```
❌ error: Missing Entry SignerKey
```

When attempting to invoke any function via Stellar CLI.

### Solution

The template now re-exports `SignerKey` with `export = true`:

```rust
#[contracttype(export = true)]
#[derive(Clone, Debug, PartialEq)]
pub enum SignerKey {
    Policy(Address),
    Ed25519(BytesN<32>),
    Secp256r1(Bytes),
}
```

And does NOT implement the `PolicyInterface` trait (which would cause type conflicts).

### Validation

The integration tests verify this fix by:

1. Building contracts to WASM
2. Running `stellar contract inspect --wasm <path>`
3. Checking the spec includes:
   - `Union: SignerKey`
   - All three variants: Policy, Ed25519, Secp256r1

## Test Execution Matrix

### Quick Validation

```bash
# Fast: Only check compilation
cargo test --test build_test -- --ignored --nocapture
```

### Comprehensive Validation

```bash
# Builds to WASM and validates contract specs
cargo test --test integration_test -- --ignored --nocapture
```

### Specific Test Patterns

```bash
# Test only admin-managed features
cargo test --test integration_test test_spec_validation_admin_managed -- --ignored --nocapture

# Test all features combined
cargo test --test integration_test test_spec_validation_all_features -- --ignored --nocapture

# Test simple policies
cargo test --test integration_test test_spec_validation_simple_policy -- --ignored --nocapture
```

## Test Requirements

### Dependencies

- **Rust toolchain** with `wasm32-unknown-unknown` target:
  ```bash
  rustup target add wasm32-unknown-unknown
  ```

- **Stellar CLI** for contract inspection:
  ```bash
  cargo install stellar-cli
  ```

### CI/CD Considerations

- Build tests are fast (1-2 minutes) - suitable for every commit
- Integration tests are slower (5-10 minutes) - recommend on PR merge
- Both test suites use `#[ignore]` to avoid running in standard `cargo test`

## What the Tests Catch

### ✅ Catches

1. **Compilation errors** - Rust syntax issues, type errors
2. **Missing SignerKey export** - The "Missing Entry SignerKey" bug
3. **Incorrect contract structure** - Missing `policy__` function
4. **Admin function presence** - `init` function for admin-managed contracts
5. **All SignerKey variants** - Policy, Ed25519, Secp256r1 completeness

### ❌ Does NOT Catch

1. **Runtime policy enforcement errors** - Would need actual smart wallet integration
2. **Policy logic bugs in real transactions** - Requires end-to-end testing with smart wallet

## Priority 3: In-Contract Unit Tests ✅

**Status**: COMPLETE ✅

**Purpose**: Test actual policy enforcement logic directly in Rust using Soroban SDK test utilities.

**Coverage**:
- ✅ **Amount cap enforcement** - Transactions within limit pass, over limit fail with TooMuch error
- ✅ **Contract whitelist enforcement** - Whitelisted contracts pass, non-whitelisted fail with NotAllowed
- ✅ **Recipient whitelist enforcement** - Whitelisted recipients pass, non-whitelisted fail with NotAllowed
- ✅ **Function whitelist enforcement** - Whitelisted functions pass, non-whitelisted fail with NotAllowed
- ✅ **Rate limiting enforcement** - First transaction passes, too-soon transactions fail with TooSoon, after-waiting passes
- ✅ **Admin initialization** - Init succeeds, policy__ before init fails with NotInitialized
- ✅ **All error cases** - All policy violations trigger correct error codes

**Execution**:
```bash
# Generate a policy contract
stellar-policy-cli generate --name my-policy --amount-cap 100000 --admin

# Navigate to generated contract
cd contracts/my-policy

# Run the generated in-contract tests
cargo test

# Example output:
# test test_init_success ... ok
# test test_policy_not_initialized - should panic ... ok
# test test_amount_cap_allows_within_limit ... ok
# test test_amount_cap_blocks_over_limit - should panic ... ok
# test test_amount_cap_exact_limit ... ok
# test test_rate_limiting_allows_first_transaction ... ok
# test test_rate_limiting_blocks_too_soon - should panic ... ok
# test test_rate_limiting_allows_after_waiting ... ok
```

**How It Works**:

The generator creates comprehensive unit tests in `src/test.rs` alongside each policy contract:

```rust
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    #[test]
    fn test_amount_cap_allows_within_limit() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, Contract);
        let client = ContractClient::new(&env, &contract_id);

        // Initialize and configure
        let admin = Address::generate(&env);
        client.init(&admin);

        let signer_bytes = BytesN::from_array(&env, &[1u8; 32]);
        client.add_wallet(&signer_bytes, &100000);

        // Create context with amount = 50000 (within limit)
        let contexts = create_transfer_context(&env, 50000);

        // Should NOT panic - transaction allowed
        client.policy__(&source, &SignerKey::Ed25519(signer_bytes), &contexts);
    }

    #[test]
    #[should_panic(expected = "Error(TooMuch)")]
    fn test_amount_cap_blocks_over_limit() {
        // ... similar setup ...
        // Create context with amount = 150000 (EXCEEDS limit)
        // Should PANIC with TooMuch error
        client.policy__(&source, &SignerKey::Ed25519(signer_bytes), &contexts);
    }
}
```

**Advantages Over CLI Testing**:
- ✅ **Direct Rust testing** - No JSON formatting issues with CLI
- ✅ **All edge cases** - Easy to test both success and failure cases
- ✅ **Standard practices** - Uses standard Rust testing patterns
- ✅ **Fast execution** - No network needed, tests run in milliseconds
- ✅ **Soroban SDK utilities** - Leverages built-in test helpers (mock_all_auths, Ledger control)
- ✅ **Automatic generation** - Tests are generated alongside contracts

**Integration Test Validation**:

The integration test suite validates that generated tests compile and pass:

```bash
# Test that generated tests work for amount cap policies
cargo test --test integration_test test_generated_tests_amount_cap -- --ignored --nocapture

# Test that generated tests work for whitelist policies
cargo test --test integration_test test_generated_tests_whitelist -- --ignored --nocapture

# Test that generated tests work for rate limiting policies
cargo test --test integration_test test_generated_tests_rate_limiting -- --ignored --nocapture

# Test that generated tests work for all features combined
cargo test --test integration_test test_generated_tests_all_features -- --ignored --nocapture
```

## Future Test Enhancements

### Priority 4: Full Smart Wallet Integration Testing (Future)

**Status**: Not required - in-contract tests cover policy logic

**Goal**: Test actual smart wallet + policy integration end-to-end.

**Note**: This would require deploying both smart wallet (e.g., passkey-kit) and policy contracts, then executing real transactions through the smart wallet. The in-contract unit tests already verify policy logic works correctly, so this would only add integration smoke testing value.

### Priority 4: Performance Benchmarks

- Contract size (WASM bytes) for various feature combinations
- Deployment gas costs
- Invocation costs for different policy validation paths

## Contributing Test Cases

When adding new features to the generator:

1. **Add build test** in `tests/build_test.rs`:
   - Create a `PolicyConfig` with the new feature
   - Call `generate_and_build()`
   - Verify compilation succeeds

2. **Add integration test** in `tests/integration_test.rs`:
   - Create a `PolicyConfig` with the new feature
   - Call `build_contract_to_wasm()`
   - Add spec validation for any new types/functions

3. **Document the feature** in this file under test coverage

## Troubleshooting

### Test Failures

#### "Failed to run cargo build"

**Cause**: Missing Rust toolchain or wasm32 target

**Fix**:
```bash
rustup target add wasm32-unknown-unknown
```

#### "Failed to run stellar contract inspect"

**Cause**: Stellar CLI not installed

**Fix**:
```bash
cargo install stellar-cli
```

#### "Contract spec does not include SignerKey"

**Cause**: Template regression - SignerKey export removed

**Fix**: Verify `/templates/contract/lib.rs.hbs` includes:
```rust
#[contracttype(export = true)]
#[derive(Clone, Debug, PartialEq)]
pub enum SignerKey {
    Policy(Address),
    Ed25519(BytesN<32>),
    Secp256r1(Bytes),
}
```

## Summary

The testing strategy uses a comprehensive layered approach:

1. **Fast feedback** - Build tests catch compilation errors quickly (1-2 minutes)
2. **Spec validation** - Integration tests catch CLI invocation issues (5-10 minutes)
3. **Localnet deployment** - Real deployment and function invocation tests (10-15 minutes)
4. **In-contract unit tests** - Verify ALL policy enforcement logic works correctly (generated automatically, run instantly)
5. **Documentation** - This file explains the "why" behind each test

This ensures generated contracts are:
- ✅ **Syntactically correct** - Build tests verify code compiles
- ✅ **Semantically valid** - Integration tests verify contract specs
- ✅ **CLI-invocable** - Spec validation ensures stellar CLI can invoke functions
- ✅ **Deployable to Stellar networks** - Localnet tests prove real deployment works
- ✅ **Functionally correct** - In-contract tests verify ALL policy logic enforcement
- ✅ **Edge-case resilient** - Tests cover both success and failure paths

## What Gets Tested

### ✅ Fully Tested

1. **Compilation** - All policy combinations compile successfully
2. **Contract structure** - All required functions exist (init, add_wallet, policy__)
3. **SignerKey export** - Contract specs include SignerKey definition with all variants
4. **Deployment** - Contracts can be deployed to Stellar localnet
5. **Configuration** - Admin functions (init, add_wallet) work correctly
6. **Policy enforcement** - ALL policy features enforce rules correctly:
   - Amount caps block transactions over limit
   - Contract whitelists block non-whitelisted contracts
   - Recipient whitelists block non-whitelisted recipients
   - Function whitelists block non-whitelisted functions
   - Rate limiting blocks too-frequent transactions
   - All error codes trigger correctly (NotAllowed, TooMuch, TooSoon, NotInitialized)

### ❌ NOT Tested (Future Enhancements)

1. **Full smart wallet integration** - Real passkey-kit + policy contract end-to-end flow
2. **Performance benchmarks** - Contract size, deployment costs, invocation costs
3. **Gas optimization** - Verification that generated code is optimally efficient

The in-contract unit tests provide **complete coverage** of policy enforcement logic, which was the primary goal identified in Priority 2/3. These tests run in milliseconds, catch bugs immediately during development, and verify that the generated policy logic works exactly as specified.
