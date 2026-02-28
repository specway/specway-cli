import { Command } from 'commander';
import { registerValidateCommand } from './commands/validate.js';
import { registerInitCommand } from './commands/init.js';
import { registerPreviewCommand } from './commands/preview.js';
import { registerDiffCommand } from './commands/diff.js';
import { registerPublishCommand } from './commands/publish.js';

const program = new Command();

program
  .name('specway')
  .description('OpenAPI toolkit — validate, preview, diff, and publish API specs')
  .version('0.1.0');

registerValidateCommand(program);
registerInitCommand(program);
registerPreviewCommand(program);
registerDiffCommand(program);
registerPublishCommand(program);

program.parse();
