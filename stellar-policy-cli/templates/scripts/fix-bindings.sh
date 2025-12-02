#!/bin/bash
# Post-bindings script to add missing TypeScript type definitions
# These types come from smart-wallet-interface but aren't exported in the contract spec

SDK_DIR="$1"

if [ -z "$SDK_DIR" ]; then
  echo "Usage: $0 <sdk-directory>"
  exit 1
fi

INDEX_FILE="$SDK_DIR/src/index.ts"

if [ ! -f "$INDEX_FILE" ]; then
  echo "Error: $INDEX_FILE not found"
  exit 1
fi

echo "🔧 Fixing TypeScript bindings in $SDK_DIR..."

# Create the type definitions to insert
TYPE_DEFS="
// Type definitions from smart-wallet-interface
// These are not exported in the contract spec but are required for the policy__ function
export type SignerKey =
  | { tag: \"Policy\", values: readonly [string] }
  | { tag: \"Ed25519\", values: readonly [Buffer] }
  | { tag: \"Secp256r1\", values: readonly [Buffer] };

export type Context = any; // Full Context type would need to be imported from smart-wallet bindings
"

# Check if types are already added
if grep -q "export type SignerKey" "$INDEX_FILE"; then
  echo "✅ Types already present, skipping..."
  exit 0
fi

# Find the line number after the last import and before the first export
INSERT_LINE=$(grep -n "^export \* as rpc" "$INDEX_FILE" | cut -d: -f1)

if [ -z "$INSERT_LINE" ]; then
  # Fallback: insert after buffer setup
  INSERT_LINE=$(grep -n "window.Buffer || Buffer" "$INDEX_FILE" | cut -d: -f1)
fi

if [ -z "$INSERT_LINE" ]; then
  echo "❌ Could not find insertion point"
  exit 1
fi

# Insert the types after the found line
INSERT_LINE=$((INSERT_LINE + 1))

# Create a temp file with the types inserted
{
  head -n "$INSERT_LINE" "$INDEX_FILE"
  echo "$TYPE_DEFS"
  tail -n +"$((INSERT_LINE + 1))" "$INDEX_FILE"
} > "$INDEX_FILE.tmp"

# Replace the original file
mv "$INDEX_FILE.tmp" "$INDEX_FILE"

echo "✅ Added SignerKey and Context type definitions"
echo "📝 Note: For full type safety, consider installing smart-wallet bindings separately"
