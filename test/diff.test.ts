import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parseSpec } from '../src/lib/parser.js';
import { diffSpecs } from '../src/lib/diff-engine.js';

function loadFixture(name: string): unknown {
  const content = readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8');
  return parseYaml(content);
}

describe('diff', () => {
  it('should detect no changes when comparing same spec', async () => {
    const spec = loadFixture('petstore.yaml');
    const result = await parseSpec(spec);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const diff = diffSpecs(result.api.actions, result.api.actions);
    expect(diff.changes.length).toBe(0);
    expect(diff.breakingCount).toBe(0);
    expect(diff.nonBreakingCount).toBe(0);
  });

  it('should detect breaking changes between v1 and v2', async () => {
    const v1 = loadFixture('petstore.yaml');
    const v2 = loadFixture('petstore-v2.yaml');

    const r1 = await parseSpec(v1);
    const r2 = await parseSpec(v2);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    if (!r1.success || !r2.success) return;

    const diff = diffSpecs(r1.api.actions, r2.api.actions);

    expect(diff.breakingCount).toBeGreaterThan(0);

    // DELETE /pets/{petId} removed = breaking
    const removedEndpoint = diff.changes.find(
      (c) => c.category === 'endpoint-removed' && c.path === '/pets/{petId}'
    );
    expect(removedEndpoint).toBeDefined();
    expect(removedEndpoint!.type).toBe('breaking');
  });

  it('should detect non-breaking changes (new endpoints)', async () => {
    const v1 = loadFixture('petstore.yaml');
    const v2 = loadFixture('petstore-v2.yaml');

    const r1 = await parseSpec(v1);
    const r2 = await parseSpec(v2);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    if (!r1.success || !r2.success) return;

    const diff = diffSpecs(r1.api.actions, r2.api.actions);

    // POST /pets/{petId}/adopt added = non-breaking
    const addedEndpoint = diff.changes.find(
      (c) => c.category === 'endpoint-added' && c.path === '/pets/{petId}/adopt'
    );
    expect(addedEndpoint).toBeDefined();
    expect(addedEndpoint!.type).toBe('non-breaking');
  });

  it('should detect required param additions as breaking', async () => {
    const v1 = loadFixture('petstore.yaml');
    const v2 = loadFixture('petstore-v2.yaml');

    const r1 = await parseSpec(v1);
    const r2 = await parseSpec(v2);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    if (!r1.success || !r2.success) return;

    const diff = diffSpecs(r1.api.actions, r2.api.actions);

    // GET /pets now has required "status" query param
    const requiredParamAdded = diff.changes.find(
      (c) =>
        c.category === 'required-param-added' &&
        c.message.includes('status')
    );
    expect(requiredParamAdded).toBeDefined();
    expect(requiredParamAdded!.type).toBe('breaking');
  });

  it('should detect optional param additions as non-breaking', async () => {
    const v1 = loadFixture('petstore.yaml');
    const v2 = loadFixture('petstore-v2.yaml');

    const r1 = await parseSpec(v1);
    const r2 = await parseSpec(v2);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    if (!r1.success || !r2.success) return;

    const diff = diffSpecs(r1.api.actions, r2.api.actions);

    // GET /pets now has optional "species" query param
    const optionalParamAdded = diff.changes.find(
      (c) =>
        c.category === 'optional-param-added' &&
        c.message.includes('species')
    );
    expect(optionalParamAdded).toBeDefined();
    expect(optionalParamAdded!.type).toBe('non-breaking');
  });
});
