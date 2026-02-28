import type { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import { printError, printSuccess } from '../lib/output.js';

const STARTER_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'My API',
    description: 'A starter OpenAPI specification. Edit this to describe your API.',
    version: '1.0.0',
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
  },
  servers: [
    {
      url: 'https://api.example.com/v1',
      description: 'Production server',
    },
  ],
  paths: {
    '/health': {
      get: {
        operationId: 'getHealth',
        summary: 'Health check',
        description: 'Returns the health status of the API.',
        tags: ['System'],
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      example: 'ok',
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                    },
                  },
                  required: ['status'],
                },
              },
            },
          },
        },
      },
    },
    '/items': {
      get: {
        operationId: 'listItems',
        summary: 'List items',
        description: 'Retrieve a paginated list of items.',
        tags: ['Items'],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of items to return',
            required: false,
            schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
          },
          {
            name: 'offset',
            in: 'query',
            description: 'Number of items to skip',
            required: false,
            schema: { type: 'integer', default: 0, minimum: 0 },
          },
        ],
        responses: {
          '200': {
            description: 'A list of items',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Item' },
                    },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
        security: [{ BearerAuth: [] }],
      },
      post: {
        operationId: 'createItem',
        summary: 'Create an item',
        description: 'Create a new item.',
        tags: ['Items'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Name of the item' },
                  description: { type: 'string', description: 'Optional description' },
                },
                required: ['name'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Item created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Item' },
              },
            },
          },
        },
        security: [{ BearerAuth: [] }],
      },
    },
  },
  components: {
    schemas: {
      Item: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'name', 'createdAt'],
      },
    },
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT Bearer token authentication',
      },
    },
  },
};

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Create a starter OpenAPI spec in the current directory')
    .option('-f, --filename <name>', 'Output filename', 'openapi.yaml')
    .option('--json', 'Output as JSON instead of YAML')
    .action((opts: { filename: string; json?: boolean }) => {
      try {
        let filename = opts.filename;
        if (opts.json && filename === 'openapi.yaml') {
          filename = 'openapi.json';
        }

        const outputPath = resolve(process.cwd(), filename);

        if (existsSync(outputPath)) {
          printError(`File already exists: ${filename}`, 'Use -f to specify a different filename');
          process.exit(1);
        }

        const content = opts.json
          ? JSON.stringify(STARTER_SPEC, null, 2) + '\n'
          : stringifyYaml(STARTER_SPEC, { lineWidth: 120 });

        writeFileSync(outputPath, content);
        printSuccess(`Created ${filename}`);
        console.log();
        console.log(`  Next steps:`);
        console.log(`    specway validate ${filename}`);
        console.log(`    specway preview ${filename}`);
        console.log();
      } catch (err) {
        printError(
          'Failed to create file',
          err instanceof Error ? err.message : 'Unknown error'
        );
        process.exit(1);
      }
    });
}
