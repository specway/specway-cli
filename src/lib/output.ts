import chalk from 'chalk';
import type { ValidationSummary } from './types.js';

const METHOD_COLORS: Record<string, (s: string) => string> = {
  GET: chalk.blue,
  POST: chalk.green,
  PUT: chalk.yellow,
  PATCH: chalk.cyan,
  DELETE: chalk.red,
};

export function printValidationSummary(summary: ValidationSummary): void {
  console.log();
  console.log(chalk.bold(`  ${summary.title}`), chalk.dim(`v${summary.version}`));
  console.log(chalk.dim(`  ${summary.baseUrl}`));
  console.log();

  // Auth
  console.log(`  ${chalk.dim('Auth:')}  ${formatAuthType(summary.authType)}`);

  // Endpoints by method
  console.log(`  ${chalk.dim('Endpoints:')}  ${summary.endpointCount} total`);
  const methods = Object.entries(summary.endpointsByMethod)
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [method, count] of methods) {
    const colorFn = METHOD_COLORS[method] || chalk.white;
    console.log(`    ${colorFn(method.padEnd(7))} ${count}`);
  }

  // Tags
  if (summary.tags.length > 0) {
    console.log(`  ${chalk.dim('Tags:')}  ${summary.tags.join(', ')}`);
  }

  // Deprecated
  if (summary.deprecated > 0) {
    console.log(`  ${chalk.dim('Deprecated:')}  ${chalk.yellow(String(summary.deprecated))}`);
  }

  // Warnings
  if (summary.warnings.length > 0) {
    console.log();
    console.log(chalk.yellow(`  ${summary.warnings.length} warning(s):`));
    for (const w of summary.warnings) {
      console.log(chalk.yellow(`    ⚠ ${w}`));
    }
  }

  // Errors
  if (summary.errors.length > 0) {
    console.log();
    console.log(chalk.red(`  ${summary.errors.length} error(s):`));
    for (const e of summary.errors) {
      console.log(chalk.red(`    ✗ ${e}`));
    }
  }

  // Status line
  console.log();
  if (summary.errors.length > 0) {
    console.log(chalk.red.bold('  ✗ Validation failed'));
  } else if (summary.warnings.length > 0) {
    console.log(chalk.yellow.bold('  ⚠ Valid with warnings'));
  } else {
    console.log(chalk.green.bold('  ✓ Valid'));
  }
  console.log();
}

function formatAuthType(type: string): string {
  switch (type) {
    case 'apiKey': return 'API Key';
    case 'bearer': return 'Bearer Token';
    case 'oauth2': return 'OAuth 2.0';
    case 'none': return chalk.dim('None');
    default: return type;
  }
}

export function printError(message: string, details?: string): void {
  console.error();
  console.error(chalk.red(`  ✗ ${message}`));
  if (details) {
    console.error(chalk.dim(`    ${details}`));
  }
  console.error();
}

export function printSuccess(message: string): void {
  console.log(chalk.green(`  ✓ ${message}`));
}

export function printInfo(message: string): void {
  console.log(chalk.dim(`  ${message}`));
}
