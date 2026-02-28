import type { Command } from 'commander';
import chalk from 'chalk';
import { loadSpec } from '../lib/loader.js';
import { parseSpec } from '../lib/parser.js';
import { diffSpecs, type DiffChange } from '../lib/diff-engine.js';
import { printError } from '../lib/output.js';

export function registerDiffCommand(program: Command): void {
  program
    .command('diff <old> <new>')
    .description('Compare two specs and detect breaking changes')
    .option('--json', 'Output as JSON')
    .option('--breaking-only', 'Only show breaking changes')
    .action(async (oldPath: string, newPath: string, opts: { json?: boolean; breakingOnly?: boolean }) => {
      try {
        const [oldLoad, newLoad] = await Promise.all([
          loadSpec(oldPath),
          loadSpec(newPath),
        ]);

        const [oldResult, newResult] = await Promise.all([
          parseSpec(oldLoad.parsed),
          parseSpec(newLoad.parsed),
        ]);

        if (!oldResult.success) {
          printError(`Failed to parse ${oldPath}`, oldResult.details);
          process.exit(1);
        }
        if (!newResult.success) {
          printError(`Failed to parse ${newPath}`, newResult.details);
          process.exit(1);
        }

        const result = diffSpecs(oldResult.api.actions, newResult.api.actions);

        let changes = result.changes;
        if (opts.breakingOnly) {
          changes = changes.filter((c) => c.type === 'breaking');
        }

        if (opts.json) {
          console.log(JSON.stringify({
            breakingCount: result.breakingCount,
            nonBreakingCount: result.nonBreakingCount,
            changes,
          }, null, 2));
        } else {
          printDiffOutput(changes, result.breakingCount, result.nonBreakingCount);
        }

        process.exit(result.breakingCount > 0 ? 1 : 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (opts.json) {
          console.log(JSON.stringify({ error: message }, null, 2));
        } else {
          printError(message);
        }
        process.exit(1);
      }
    });
}

function printDiffOutput(
  changes: DiffChange[],
  breakingCount: number,
  nonBreakingCount: number
): void {
  console.log();

  if (changes.length === 0) {
    console.log(chalk.green('  No changes detected'));
    console.log();
    return;
  }

  // Group by type
  const breaking = changes.filter((c) => c.type === 'breaking');
  const nonBreaking = changes.filter((c) => c.type === 'non-breaking');

  if (breaking.length > 0) {
    console.log(chalk.red.bold(`  Breaking Changes (${breaking.length})`));
    console.log();
    for (const change of breaking) {
      console.log(chalk.red(`    ✗ ${change.message}`));
    }
    console.log();
  }

  if (nonBreaking.length > 0) {
    console.log(chalk.yellow.bold(`  Non-Breaking Changes (${nonBreaking.length})`));
    console.log();
    for (const change of nonBreaking) {
      console.log(chalk.yellow(`    ~ ${change.message}`));
    }
    console.log();
  }

  // Summary
  if (breakingCount > 0) {
    console.log(chalk.red.bold(`  ✗ ${breakingCount} breaking change(s) detected`));
  } else {
    console.log(chalk.green.bold('  ✓ No breaking changes'));
  }
  if (nonBreakingCount > 0) {
    console.log(chalk.dim(`    ${nonBreakingCount} non-breaking change(s)`));
  }
  console.log();
}
