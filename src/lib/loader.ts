import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

export interface LoadResult {
  content: string;
  parsed: unknown;
  source: string;
}

/**
 * Load an OpenAPI spec from a file path or URL.
 * Auto-detects JSON vs YAML.
 */
export async function loadSpec(pathOrUrl: string): Promise<LoadResult> {
  const content = await loadContent(pathOrUrl);
  const parsed = parseContent(content);
  return { content, parsed, source: pathOrUrl };
}

async function loadContent(pathOrUrl: string): Promise<string> {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    const response = await fetch(pathOrUrl, {
      headers: {
        Accept: 'application/json, application/yaml, text/yaml, */*',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${pathOrUrl}: HTTP ${response.status}`);
    }
    return response.text();
  }

  try {
    return readFileSync(pathOrUrl, 'utf-8');
  } catch (err) {
    throw new Error(
      `Failed to read file: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
}

function parseContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    try {
      return parseYaml(content);
    } catch (err) {
      throw new Error(
        `Failed to parse content as JSON or YAML: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }
}
