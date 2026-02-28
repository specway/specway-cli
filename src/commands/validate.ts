import type { Command } from 'commander';
import { loadSpec } from '../lib/loader.js';
import { buildValidationSummary, parseSpec } from '../lib/parser.js';
import { printError, printValidationSummary } from '../lib/output.js';

export function registerValidateCommand(program: Command): void {
  program
    .command('validate <file-or-url>')
    .description('Validate an OpenAPI/Swagger spec and display a summary')
    .option('--json', 'Output as JSON (for CI)')
    .option('--strict', 'Treat warnings as errors')
    .action(async (fileOrUrl: string, opts: { json?: boolean; strict?: boolean }) => {
      try {
        const { parsed } = await loadSpec(fileOrUrl);
        const result = await parseSpec(parsed);

        if (!result.success) {
          if (opts.json) {
            console.log(JSON.stringify({ valid: false, error: result.error, details: result.details }, null, 2));
          } else {
            printError(result.error, result.details);
          }
          process.exit(1);
        }

        const summary = buildValidationSummary(result.api);

        if (opts.strict && summary.warnings.length > 0) {
          summary.errors.push(
            ...summary.warnings.map((w) => `[strict] ${w}`)
          );
        }

        if (opts.json) {
          console.log(JSON.stringify({
            valid: summary.errors.length === 0,
            ...summary,
          }, null, 2));
        } else {
          printValidationSummary(summary);
        }

        process.exit(summary.errors.length > 0 ? 1 : 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (opts.json) {
          console.log(JSON.stringify({ valid: false, error: message }, null, 2));
        } else {
          printError(message);
        }
        process.exit(1);
      }
    });
}
