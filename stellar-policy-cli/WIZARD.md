# Enhanced Wizard Guide

The Stellar Policy CLI features a modern, user-friendly wizard to guide you through policy creation.

## Features

### Beautiful Visual Design
- **Colored output** - Important information highlighted in cyan, green, yellow
- **Progress indicator** - Shows current step (e.g., `Step 5/9: █████░░░░`)
- **Section headers** - Clear visual separation between sections
- **Emojis** - Visual cues with fallbacks for unsupported terminals

### Easy Navigation
- **Go Back** - Made a mistake? Go back to any previous step
- **Clear prompts** - Each question explains what it does and why
- **Contextual help** - Requirements and examples for each input
- **Validation** - Immediate feedback on invalid inputs

### User Experience
- **Welcome screen** - Explains the wizard before starting
- **Step-by-step flow** - One question at a time, clear focus
- **Completion summary** - Review all configured settings
- **Next steps guidance** - Clear instructions after generation

## Usage

```bash
stellar-policy generate
```

The wizard provides:
- Beautiful colors and visual styling
- Back navigation between steps
- Progress tracking showing current step
- Contextual help for each question
- Clear validation and error messages

## Wizard Flow

```
Welcome
   ↓
Policy Name ──────┐
   ↓              │
Description       │ Can go
   ↓              │ back at
Function Whitelist│ any step
   ↓              │
Contract Whitelist│
   ↓              │
Recipient Whitelist
   ↓              │
Amount Cap        │
   ↓              │
Rate Limiting ────┘
   ↓
Policy Analysis
   ↓
Admin Decision
   ↓
Complete!
```

## Visual Example

```
═══════════════════════════════════════════════════════════════════════════════
🚀 Stellar Policy Generator
ℹ️  Step 5/9: Recipient Whitelist
   █████░░░░
═══════════════════════════════════════════════════════════════════════════════

┌─ Recipient Whitelist ─
│  Restrict destination addresses for transfers
└─

ℹ️  What this does:
  • Only allow transfers to approved addresses
  • Prevent sending funds to unknown recipients
  • Useful for business/treasury wallets

? Enable recipient whitelisting? (y/N) ›

```

## Tips

### Fixing Mistakes
If you make a mistake:
1. Complete the current step
2. Select "Go back" from the menu
3. Re-enter the correct information
4. Continue forward

### Required vs Optional
- **Required fields** - Must be filled in
- **Optional features** - Can skip with 'No'
- **Admin features** - Amount caps and rate limiting require admin mode

### Address Format
- **Contract addresses** - Start with 'C', 56 characters
- **Account addresses** - Start with 'G', 56 characters
- **Example**: `GCURS4DFNCY5BHXG5L4H2BDJD6TEOKMZMDH6FKJHRUIRDLXCJNML3NJO`

### Function Names
- Lowercase letters, numbers, underscores
- Examples: `transfer`, `swap`, `mint_tokens`

## Keyboard Shortcuts

- **Enter** - Confirm current selection
- **↑/↓** - Navigate menu options (when applicable)
- **Ctrl+C** - Cancel wizard

## Troubleshooting

### No Colors Showing
If colors don't appear:
- Check terminal supports ANSI colors
- Try different terminal emulator (iTerm2, Windows Terminal, etc.)
- Most modern terminals support colors by default

### Emojis Not Displaying
Emojis automatically fallback to ASCII:
- 🚀 → >
- ✅ → [OK]
- ℹ️ → i
- ⚙️ → [*]

## Next Steps

After completing the wizard:
1. Navigate to generated project: `cd your-policy-name/contracts`
2. Build contracts: `make build`
3. Run tests: `make test`
4. Deploy: `make deploy-testnet`

See the generated `README.md` in your project for detailed instructions.
