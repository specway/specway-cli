import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parseSpec, buildValidationSummary } from '../src/lib/parser.js';

function loadFixture(name: string): unknown {
  const content = readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8');
  return parseYaml(content);
}

describe('validate', () => {
  it('should parse petstore spec successfully', async () => {
    const spec = loadFixture('petstore.yaml');
    const result = await parseSpec(spec);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.api.name).toBe('Petstore');
    expect(result.api.version).toBe('1.0.0');
    expect(result.api.baseUrl).toBe('https://petstore.swagger.io/v2');
    expect(result.api.auth.type).toBe('bearer');
  });

  it('should extract all endpoints', async () => {
    const spec = loadFixture('petstore.yaml');
    const result = await parseSpec(spec);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.api.actions.length).toBe(4);

    const methods = result.api.actions.map((a) => a.method);
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');
    expect(methods).toContain('DELETE');
  });

  it('should extract tags', async () => {
    const spec = loadFixture('petstore.yaml');
    const result = await parseSpec(spec);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const summary = buildValidationSummary(result.api);
    expect(summary.tags).toContain('Pets');
  });

  it('should build validation summary with correct counts', async () => {
    const spec = loadFixture('petstore.yaml');
    const result = await parseSpec(spec);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const summary = buildValidationSummary(result.api);
    expect(summary.endpointCount).toBe(4);
    expect(summary.endpointsByMethod['GET']).toBe(2);
    expect(summary.endpointsByMethod['POST']).toBe(1);
    expect(summary.endpointsByMethod['DELETE']).toBe(1);
    expect(summary.authType).toBe('bearer');
  });

  it('should fail on invalid spec', async () => {
    const result = await parseSpec({ invalid: 'not a spec' });
    expect(result.success).toBe(false);
  });

  it('should extract path and query parameters', async () => {
    const spec = loadFixture('petstore.yaml');
    const result = await parseSpec(spec);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const getPet = result.api.actions.find((a) => a.slug === 'getpet');
    expect(getPet).toBeDefined();
    expect(getPet!.pathParams.length).toBe(1);
    expect(getPet!.pathParams[0].key).toBe('petId');
    expect(getPet!.pathParams[0].required).toBe(true);

    const listPets = result.api.actions.find((a) => a.slug === 'listpets');
    expect(listPets).toBeDefined();
    expect(listPets!.queryParams.length).toBe(1);
    expect(listPets!.queryParams[0].key).toBe('limit');
    expect(listPets!.queryParams[0].required).toBe(false);
  });
});
