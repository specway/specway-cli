/** API Key authentication configuration */
export interface ApiKeyAuthConfig {
  name: string;
  in: 'header' | 'query';
}

/** Bearer token authentication configuration */
export interface BearerAuthConfig {
  scheme: string;
}

/** OAuth 2.0 authentication configuration */
export interface OAuth2AuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  scopes: Record<string, string>;
}

/** Parsed authentication configuration */
export interface ParsedAuth {
  type: 'apiKey' | 'bearer' | 'oauth2' | 'none';
  config: ApiKeyAuthConfig | BearerAuthConfig | OAuth2AuthConfig | null;
}

/** Field definition extracted from JSON Schema */
export interface ParsedField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  enum?: string[];
  description?: string;
  format?: string;
  default?: unknown;
  properties?: ParsedField[];
  items?: ParsedField;
  example?: unknown;
}

/** Action (endpoint) extracted from OpenAPI paths */
export interface ParsedAction {
  slug: string;
  label: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  pathParams: ParsedField[];
  queryParams: ParsedField[];
  bodySchema: ParsedField[];
  responseSchema: ParsedField[];
  tags?: string[];
  deprecated?: boolean;
}

/** Complete parsed API definition */
export interface ParsedAPI {
  name: string;
  description: string;
  baseUrl: string;
  auth: ParsedAuth;
  actions: ParsedAction[];
  warnings: string[];
  version?: string;
  provider?: string;
  termsOfService?: string;
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
}

export interface ParseSuccess {
  success: true;
  api: ParsedAPI;
}

export interface ParseFailure {
  success: false;
  error: string;
  details?: string;
}

export type ParseResult = ParseSuccess | ParseFailure;

/** Validation result for CLI display */
export interface ValidationSummary {
  title: string;
  version: string;
  baseUrl: string;
  authType: string;
  endpointCount: number;
  endpointsByMethod: Record<string, number>;
  tags: string[];
  errors: string[];
  warnings: string[];
  deprecated: number;
}
