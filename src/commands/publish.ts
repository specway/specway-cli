import type { Command } from 'commander';
import chalk from 'chalk';
import { loadSpec } from '../lib/loader.js';
import { parseSpec } from '../lib/parser.js';
import { resolveApiKey } from '../lib/config.js';
import { publishSpec } from '../lib/api-client.js';
import { printError, printSuccess } from '../lib/output.js';

export function registerPublishCommand(program: Command): void {
  program
    .command('publish <file-or-url>')
    .description('Publish API docs to Specway')
    .option('--key <key>', 'Specway API key')
    .action(async (fileOrUrl: string, opts: { key?: string }) => {
      try {
        const apiKey = resolveApiKey(opts.key);
        if (!apiKey) {
          printError(
            'No API key provided',
            'Use --key, set SPECWAY_API_KEY env var, or run specway login'
          );
          process.exit(1);
        }

        // Load and validate first
        console.log();
        console.log(chalk.dim('  Validating spec...'));
        const { content, parsed } = await loadSpec(fileOrUrl);
        const result = await parseSpec(parsed);

        if (!result.success) {
          printError('Validation failed', result.details);
          process.exit(1);
        }

        console.log(chalk.dim(`  Publishing ${result.api.name} v${result.api.version}...`));

        const publishResult = await publishSpec(content, apiKey);

        if (!publishResult.success) {
          printError('Publish failed', publishResult.error);
          process.exit(1);
        }

        console.log();
        printSuccess('Published successfully!');
        console.log();
        console.log(`  ${chalk.bold('Live docs:')} ${chalk.cyan(publishResult.url)}`);
        console.log();
      } catch (err) {
        printError(
          'Publish failed',
          err instanceof Error ? err.message : 'Unknown error'
        );
        process.exit(1);
      }
    });
}
