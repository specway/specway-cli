import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { startPreviewServer } from '../lib/preview-server.js';
import { printError } from '../lib/output.js';

export function registerPreviewCommand(program: Command): void {
  program
    .command('preview <file>')
    .description('Launch a local docs server with hot-reload')
    .option('-p, --port <port>', 'Port number', '8080')
    .option('--no-open', 'Do not auto-open browser')
    .action(async (file: string, opts: { port: string; open: boolean }) => {
      const specPath = resolve(process.cwd(), file);

      if (!existsSync(specPath)) {
        printError(`File not found: ${file}`);
        process.exit(1);
      }

      const port = parseInt(opts.port, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        printError('Invalid port number');
        process.exit(1);
      }

      await startPreviewServer({
        port,
        open: opts.open,
        specPath,
      });
    });
}
