/**
 * OpenAPI/Swagger Parser
 *
 * Standalone port of the workflow-builder parser for CLI use.
 * Validates specs and extracts structured metadata.
 */

import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPIV2, OpenAPIV3 } from 'openapi-types';
import type {
  ApiKeyAuthConfig,
  BearerAuthConfig,
  OAuth2AuthConfig,
  ParsedAction,
  ParsedAPI,
  ParsedAuth,
  ParsedField,
  ParseResult,
  ValidationSummary,
} from './types.js';

/**
 * Parse and validate an OpenAPI/Swagger spec object.
 */
export async function parseSpec(spec: unknown): Promise<ParseResult> {
  try {
    let validatedSpec: OpenAPIV2.Document | OpenAPIV3.Document;
    const parseWarnings: string[] = [];

    try {
      validatedSpec = (await SwaggerParser.validate(
        structuredClone(spec) as never
      )) as OpenAPIV2.Document | OpenAPIV3.Document;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown validation error';

      const isMissingRef =
        msg.includes('Missing $ref pointer') || msg.includes('does not exist');

      if (isMissingRef) {
        parseWarnings.push(`Unresolved references: ${msg}`);
        try {
          validatedSpec = (await SwaggerParser.parse(
            structuredClone(spec) as never
          )) as OpenAPIV2.Document | OpenAPIV3.Document;
        } catch {
          return {
            success: false,
            error: 'Invalid OpenAPI/Swagger specification',
            details: msg,
          };
        }
      } else {
        return {
          success: false,
          error: 'Invalid OpenAPI/Swagger specification',
          details: msg,
        };
      }
    }

    if (isOpenAPI3(validatedSpec)) {
      return parseOpenAPI3(validatedSpec, parseWarnings);
    }
    if (isSwagger2(validatedSpec)) {
      return parseSwagger2(validatedSpec, parseWarnings);
    }

    return {
      success: false,
      error: 'Unsupported specification version',
      details: 'Only OpenAPI 3.x and Swagger 2.0 are supported',
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to parse specification',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build a validation summary for CLI display.
 */
export function buildValidationSummary(
  api: ParsedAPI,
  errors: string[] = []
): ValidationSummary {
  const endpointsByMethod: Record<string, number> = {};
  const allTags = new Set<string>();
  let deprecated = 0;

  for (const action of api.actions) {
    endpointsByMethod[action.method] = (endpointsByMethod[action.method] || 0) + 1;
    if (action.tags) action.tags.forEach((t) => allTags.add(t));
    if (action.deprecated) deprecated++;
  }

  return {
    title: api.name,
    version: api.version || 'unknown',
    baseUrl: api.baseUrl,
    authType: api.auth.type,
    endpointCount: api.actions.length,
    endpointsByMethod,
    tags: [...allTags].sort(),
    errors,
    warnings: api.warnings,
    deprecated,
  };
}

// Version detection

function isOpenAPI3(spec: unknown): spec is OpenAPIV3.Document {
  return (
    typeof spec === 'object' &&
    spec !== null &&
    'openapi' in spec &&
    typeof (spec as Record<string, unknown>).openapi === 'string' &&
    (spec as Record<string, string>).openapi.startsWith('3.')
  );
}

function isSwagger2(spec: unknown): spec is OpenAPIV2.Document {
  return (
    typeof spec === 'object' &&
    spec !== null &&
    'swagger' in spec &&
    (spec as Record<string, unknown>).swagger === '2.0'
  );
}

// OpenAPI 3.x Parser

function parseOpenAPI3(
  spec: OpenAPIV3.Document,
  initialWarnings: string[] = []
): ParseResult {
  const warnings = [...initialWarnings];

  try {
    const baseUrl =
      spec.servers && spec.servers.length > 0
        ? spec.servers[0].url
        : 'https://api.example.com';

    const auth = extractAuthOpenAPI3(spec.components?.securitySchemes);
    const actions = extractActionsOpenAPI3(spec.paths || {}, warnings);

    const api: ParsedAPI = {
      name: spec.info.title || 'Untitled API',
      description: spec.info.description || '',
      version: spec.info.version,
      baseUrl,
      auth,
      actions,
      warnings,
      provider: spec.info.contact?.name,
      termsOfService: spec.info.termsOfService,
      contact: spec.info.contact
        ? {
            name: spec.info.contact.name,
            email: spec.info.contact.email,
            url: spec.info.contact.url,
          }
        : undefined,
    };

    return { success: true, api };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to parse OpenAPI 3 specification',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function isSecurityScheme(
  scheme: OpenAPIV3.SecuritySchemeObject | OpenAPIV3.ReferenceObject
): scheme is OpenAPIV3.SecuritySchemeObject {
  return !('$ref' in scheme);
}

function extractAuthOpenAPI3(
  schemes?: Record<string, OpenAPIV3.SecuritySchemeObject | OpenAPIV3.ReferenceObject>
): ParsedAuth {
  if (!schemes || Object.keys(schemes).length === 0) {
    return { type: 'none', config: null };
  }

  const entries = Object.entries(schemes).filter(([, s]) =>
    isSecurityScheme(s)
  ) as [string, OpenAPIV3.SecuritySchemeObject][];

  const apiKeyScheme = entries.find(([, s]) => s.type === 'apiKey');
  const bearerScheme = entries.find(
    ([, s]) =>
      s.type === 'http' &&
      (s as OpenAPIV3.HttpSecurityScheme).scheme === 'bearer'
  );
  const oauth2Scheme = entries.find(([, s]) => s.type === 'oauth2');

  if (apiKeyScheme) {
    const [, scheme] = apiKeyScheme;
    if (scheme.type === 'apiKey') {
      const typed = scheme as OpenAPIV3.ApiKeySecurityScheme;
      const inValue = typed.in;
      if (typed.name && (inValue === 'header' || inValue === 'query')) {
        const config: ApiKeyAuthConfig = { name: typed.name, in: inValue };
        return { type: 'apiKey', config };
      }
    }
  }

  if (bearerScheme) {
    const [, scheme] = bearerScheme;
    if (scheme.type === 'http') {
      const config: BearerAuthConfig = {
        scheme: (scheme as OpenAPIV3.HttpSecurityScheme).scheme || 'bearer',
      };
      return { type: 'bearer', config };
    }
  }

  if (oauth2Scheme) {
    const [, scheme] = oauth2Scheme;
    if (scheme.type === 'oauth2') {
      const flows = (scheme as OpenAPIV3.OAuth2SecurityScheme).flows;
      const authCode = flows.authorizationCode;
      const implicit = flows.implicit;
      const password = flows.password;
      const clientCred = flows.clientCredentials;

      const config: OAuth2AuthConfig = {
        authorizationUrl:
          authCode?.authorizationUrl || implicit?.authorizationUrl || '',
        tokenUrl:
          authCode?.tokenUrl || password?.tokenUrl || clientCred?.tokenUrl || '',
        scopes:
          authCode?.scopes ||
          implicit?.scopes ||
          password?.scopes ||
          clientCred?.scopes ||
          {},
      };
      return { type: 'oauth2', config };
    }
  }

  return { type: 'none', config: null };
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function extractActionsOpenAPI3(
  paths: OpenAPIV3.PathsObject,
  warnings: string[]
): ParsedAction[] {
  const actions: ParsedAction[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as OpenAPIV3.OperationObject | undefined;
      if (operation) {
        const action = createActionOpenAPI3(path, method, operation, warnings);
        if (action) actions.push(action);
      }
    }
  }

  return actions;
}

function createActionOpenAPI3(
  path: string,
  method: string,
  op: OpenAPIV3.OperationObject,
  warnings: string[]
): ParsedAction | null {
  try {
    const slug = generateSlug(op.operationId || `${method}-${path}`);
    const label = op.summary || toTitleCase(slug);
    const description = op.description || op.summary || '';

    const pathParams: ParsedField[] = [];
    const queryParams: ParsedField[] = [];

    if (op.parameters) {
      for (const param of op.parameters) {
        const p = param as OpenAPIV3.ParameterObject;
        const field = paramToFieldV3(p);
        if (field) {
          if (p.in === 'path') pathParams.push(field);
          else if (p.in === 'query') queryParams.push(field);
        }
      }
    }

    const bodySchema = extractBodyV3(op.requestBody, warnings);
    const responseSchema = extractResponseV3(op.responses, warnings);

    return {
      slug,
      label,
      description,
      method: method.toUpperCase() as ParsedAction['method'],
      path,
      pathParams,
      queryParams,
      bodySchema,
      responseSchema,
      tags: op.tags,
      deprecated: op.deprecated,
    };
  } catch (error) {
    warnings.push(
      `Failed to parse ${method.toUpperCase()} ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return null;
  }
}

function paramToFieldV3(param: OpenAPIV3.ParameterObject): ParsedField | null {
  const schema = param.schema as OpenAPIV3.SchemaObject | undefined;
  if (!schema) return null;

  return {
    key: param.name,
    label: toTitleCase(param.name),
    type: schemaTypeToFieldType(schema.type),
    required: param.required ?? false,
    description: param.description,
    enum: schema.enum as string[] | undefined,
    format: schema.format,
    default: schema.default,
    example: param.example || schema.example,
  };
}

function extractBodyV3(
  requestBody: OpenAPIV3.RequestBodyObject | OpenAPIV3.ReferenceObject | undefined,
  warnings: string[]
): ParsedField[] {
  if (!requestBody || '$ref' in requestBody) return [];

  try {
    const content = requestBody.content;
    const jsonContent =
      content?.['application/json'] || content?.['application/x-www-form-urlencoded'];
    if (!jsonContent?.schema) return [];

    return schemaToFields(jsonContent.schema as OpenAPIV3.SchemaObject, warnings, 0);
  } catch (error) {
    warnings.push(
      `Failed to extract request body: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return [];
  }
}

function extractResponseV3(
  responses: OpenAPIV3.ResponsesObject,
  warnings: string[]
): ParsedField[] {
  try {
    const success = responses['200'] || responses['201'] || responses['2XX'];
    if (!success || '$ref' in success) return [];

    const jsonContent = success.content?.['application/json'];
    if (!jsonContent?.schema) return [];

    return schemaToFields(jsonContent.schema as OpenAPIV3.SchemaObject, warnings, 0);
  } catch (error) {
    warnings.push(
      `Failed to extract response schema: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return [];
  }
}

// Swagger 2.0 Parser

function parseSwagger2(
  spec: OpenAPIV2.Document,
  initialWarnings: string[] = []
): ParseResult {
  const warnings = [...initialWarnings];

  try {
    const scheme = spec.schemes?.[0] || 'https';
    const host = spec.host || 'api.example.com';
    const basePath = spec.basePath || '';
    const baseUrl = `${scheme}://${host}${basePath}`;

    const auth = extractAuthSwagger2(spec.securityDefinitions);
    const actions = extractActionsSwagger2(spec.paths, warnings);

    const api: ParsedAPI = {
      name: spec.info.title || 'Untitled API',
      description: spec.info.description || '',
      version: spec.info.version,
      baseUrl,
      auth,
      actions,
      warnings,
      provider: spec.info.contact?.name,
      termsOfService: spec.info.termsOfService,
      contact: spec.info.contact
        ? {
            name: spec.info.contact.name,
            email: spec.info.contact.email,
            url: spec.info.contact.url,
          }
        : undefined,
    };

    return { success: true, api };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to parse Swagger 2.0 specification',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function extractAuthSwagger2(
  definitions?: OpenAPIV2.SecurityDefinitionsObject
): ParsedAuth {
  if (!definitions || Object.keys(definitions).length === 0) {
    return { type: 'none', config: null };
  }

  const entries = Object.entries(definitions);
  const apiKeyScheme = entries.find(([, s]) => s.type === 'apiKey');
  const basicScheme = entries.find(([, s]) => s.type === 'basic');
  const oauth2Scheme = entries.find(([, s]) => s.type === 'oauth2');

  if (apiKeyScheme) {
    const [, scheme] = apiKeyScheme;
    if (scheme.type === 'apiKey') {
      const typed = scheme as OpenAPIV2.SecuritySchemeApiKey;
      const inValue = typed.in;
      if (typed.name && (inValue === 'header' || inValue === 'query')) {
        const config: ApiKeyAuthConfig = { name: typed.name, in: inValue };
        return { type: 'apiKey', config };
      }
    }
  }

  if (basicScheme) {
    return { type: 'bearer', config: { scheme: 'basic' } as BearerAuthConfig };
  }

  if (oauth2Scheme) {
    const [, scheme] = oauth2Scheme;
    if (scheme.type === 'oauth2') {
      const oauth2 = scheme as OpenAPIV2.SecuritySchemeOauth2;
      const flow = oauth2 as {
        authorizationUrl?: string;
        tokenUrl?: string;
        scopes?: Record<string, string>;
      };
      const config: OAuth2AuthConfig = {
        authorizationUrl: flow.authorizationUrl || '',
        tokenUrl: flow.tokenUrl || '',
        scopes: flow.scopes || {},
      };
      return { type: 'oauth2', config };
    }
  }

  return { type: 'none', config: null };
}

function extractActionsSwagger2(
  paths: OpenAPIV2.PathsObject,
  warnings: string[]
): ParsedAction[] {
  const actions: ParsedAction[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as OpenAPIV2.OperationObject | undefined;
      if (operation) {
        const action = createActionSwagger2(path, method, operation, warnings);
        if (action) actions.push(action);
      }
    }
  }

  return actions;
}

function createActionSwagger2(
  path: string,
  method: string,
  op: OpenAPIV2.OperationObject,
  warnings: string[]
): ParsedAction | null {
  try {
    const slug = generateSlug(op.operationId || `${method}-${path}`);
    const label = op.summary || toTitleCase(slug);
    const description = op.description || op.summary || '';

    const pathParams: ParsedField[] = [];
    const queryParams: ParsedField[] = [];
    let bodySchema: ParsedField[] = [];

    if (op.parameters) {
      for (const param of op.parameters) {
        const p = param as OpenAPIV2.Parameter;
        if ('in' in p) {
          if (p.in === 'body') {
            const bodyParam = p as OpenAPIV2.InBodyParameterObject;
            if (bodyParam.schema) {
              bodySchema = schemaToFields(bodyParam.schema, warnings, 0);
            }
          } else {
            const field = paramToFieldV2(p);
            if (field) {
              if (p.in === 'path') pathParams.push(field);
              else if (p.in === 'query') queryParams.push(field);
            }
          }
        }
      }
    }

    const responseSchema = extractResponseSwagger2(op.responses, warnings);

    return {
      slug,
      label,
      description,
      method: method.toUpperCase() as ParsedAction['method'],
      path,
      pathParams,
      queryParams,
      bodySchema,
      responseSchema,
      tags: op.tags,
      deprecated: op.deprecated,
    };
  } catch (error) {
    warnings.push(
      `Failed to parse ${method.toUpperCase()} ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return null;
  }
}

function paramToFieldV2(param: OpenAPIV2.Parameter): ParsedField | null {
  if ('schema' in param) return null;

  const p = param as OpenAPIV2.GeneralParameterObject;
  return {
    key: p.name,
    label: toTitleCase(p.name),
    type: schemaTypeToFieldType(p.type),
    required: p.required ?? false,
    description: p.description,
    enum: p.enum as string[] | undefined,
    format: p.format,
    default: p.default,
  };
}

function extractResponseSwagger2(
  responses: OpenAPIV2.ResponsesObject,
  warnings: string[]
): ParsedField[] {
  try {
    const success = responses['200'] || responses['201'] || responses['2XX'];
    if (!success || '$ref' in success) return [];

    const resp = success as OpenAPIV2.ResponseObject;
    if (!resp.schema) return [];

    return schemaToFields(resp.schema, warnings, 0);
  } catch (error) {
    warnings.push(
      `Failed to extract response schema: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return [];
  }
}

// Schema conversion (shared)

function schemaToFields(
  schema: OpenAPIV3.SchemaObject | OpenAPIV2.SchemaObject,
  warnings: string[],
  depth: number
): ParsedField[] {
  if (depth > 2) return [];

  try {
    if (schema.type === 'object' && schema.properties) {
      const fields: ParsedField[] = [];
      const required = (schema.required as string[]) || [];

      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if ('$ref' in propSchema) continue;

        const prop = propSchema as OpenAPIV3.SchemaObject;
        const field: ParsedField = {
          key,
          label: toTitleCase(key),
          type: schemaTypeToFieldType(prop.type),
          required: required.includes(key),
          description: prop.description,
          enum: prop.enum as string[] | undefined,
          format: prop.format,
          default: prop.default,
          example: prop.example,
        };

        if (prop.type === 'object' && prop.properties) {
          field.properties = schemaToFields(prop, warnings, depth + 1);
        }

        if (prop.type === 'array' && prop.items && !('$ref' in prop.items)) {
          const items = prop.items as OpenAPIV3.SchemaObject;
          field.items = {
            key: 'item',
            label: 'Item',
            type: schemaTypeToFieldType(items.type),
            required: false,
            description: items.description,
            enum: items.enum as string[] | undefined,
            format: items.format,
          };

          if (items.type === 'object' && items.properties) {
            field.items.properties = schemaToFields(items, warnings, depth + 1);
          }
        }

        fields.push(field);
      }

      return fields;
    }

    if (schema.type === 'array' && schema.items && !('$ref' in schema.items)) {
      return schemaToFields(
        schema.items as OpenAPIV3.SchemaObject,
        warnings,
        depth
      );
    }

    return [];
  } catch (error) {
    warnings.push(
      `Failed to convert schema: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return [];
  }
}

function schemaTypeToFieldType(type: string | undefined): ParsedField['type'] {
  switch (type) {
    case 'string': return 'string';
    case 'number':
    case 'integer': return 'number';
    case 'boolean': return 'boolean';
    case 'array': return 'array';
    case 'object': return 'object';
    default: return 'string';
  }
}

// Utilities

function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toTitleCase(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
