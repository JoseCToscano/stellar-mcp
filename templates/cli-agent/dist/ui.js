// src/ui.ts
//
// Shared UI utilities: color palette, spinners, table builder, result printer.
// All output routes through here so color/formatting is consistent.
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { config } from './config.js';
import { EXPLORER_BASE_URL, MAINNET_PASSPHRASE_FRAGMENT, EXIT_ERROR, } from './constants.js';
// ─── Network helpers ──────────────────────────────────────────────────────────
/** Returns true when NETWORK_PASSPHRASE matches the Stellar mainnet. */
export function isMainnet() {
    return config.networkPassphrase.includes(MAINNET_PASSPHRASE_FRAGMENT);
}
/** Builds a stellar.expert transaction link for the current network. */
export function explorerUrl(hash) {
    const network = isMainnet() ? 'public' : 'testnet';
    return `${EXPLORER_BASE_URL}/${network}/tx/${hash}`;
}
// ─── Spinner ──────────────────────────────────────────────────────────────────
/** Create and start an ora spinner with consistent settings. */
export function mkSpinner(msg) {
    return ora({ text: msg, color: 'cyan' }).start();
}
// ─── Banner ───────────────────────────────────────────────────────────────────
export function printBanner() {
    console.log(chalk.bold.white('◆ Stellar MCP CLI'));
}
// ─── Tools table ─────────────────────────────────────────────────────────────
export function printToolsTable(readTools, writeTools) {
    const table = new Table({
        head: [chalk.bold.white('Tool'), chalk.bold.white('Description')],
        colWidths: [35, 55],
        style: { border: ['dim'] },
    });
    if (readTools.length > 0) {
        table.push([
            { colSpan: 2, content: chalk.blue.bold(`  READ  (${readTools.length} tools)`) },
        ]);
        for (const t of readTools) {
            table.push([chalk.blue(t.name), chalk.dim(t.description || '—')]);
        }
    }
    if (writeTools.length > 0) {
        table.push([
            { colSpan: 2, content: chalk.yellow.bold(`  WRITE  (${writeTools.length} tools)`) },
        ]);
        for (const t of writeTools) {
            table.push([chalk.yellow(t.name), chalk.dim(t.description || '—')]);
        }
    }
    console.log(table.toString());
    const total = readTools.length + writeTools.length;
    console.log(chalk.dim(`\n  ${total} tool${total !== 1 ? 's' : ''} available\n`));
}
// ─── Result printer ───────────────────────────────────────────────────────────
/** Print a colored JSON result. Keys are cyan, string values are green. */
export function printResult(toolName, data) {
    console.log(chalk.bold.white(`\n◆ ${toolName}`));
    const json = JSON.stringify(data, null, 2);
    const colored = colorizeJson(json);
    console.log(colored);
    console.log();
}
function colorizeJson(json) {
    // Replace key-value pairs: "key": "string value"
    let result = json.replace(/"([^"]+)":\s*"([^"]*)"/g, (_, k, v) => `${chalk.cyan(`"${k}"`)}: ${chalk.green(`"${v}"`)}`);
    // Replace remaining keys (non-string values)
    result = result.replace(/"([^"]+)":/g, (_, k) => chalk.cyan('"' + k + '"') + ':');
    // Gray numbers and booleans
    result = result.replace(/: (true|false)/g, (_, v) => `: ${chalk.yellow(v)}`);
    result = result.replace(/: (-?\d+(?:\.\d+)?)/g, (_, v) => `: ${chalk.magenta(v)}`);
    return result;
}
// ─── Success / write previews ─────────────────────────────────────────────────
/** Print green success message with transaction hash and explorer link. */
export function printSuccess(hash) {
    console.log();
    console.log(`${chalk.green('✔')} ${chalk.bold('Transaction submitted')}`);
    console.log(`  ${chalk.dim('hash:')} ${chalk.gray(hash)}`);
    console.log(`  ${chalk.dim('view:')} ${chalk.cyan(explorerUrl(hash))}`);
    console.log();
}
/** Print XDR preview when SIGNER_SECRET is not set. */
export function printWritePreview(xdr) {
    console.log();
    console.log(chalk.yellow('◆ Transaction ready (unsigned XDR)'));
    console.log(chalk.dim('─'.repeat(60)));
    console.log(chalk.gray(xdr));
    console.log(chalk.dim('─'.repeat(60)));
    console.log(chalk.yellow('\n  Set SIGNER_SECRET in .env to sign and submit automatically.\n'));
}
// ─── Error ────────────────────────────────────────────────────────────────────
/** Print a red error message and exit with code 1. */
export function printError(msg) {
    console.error(`${chalk.red('✗')} ${msg}`);
    process.exit(EXIT_ERROR);
}
