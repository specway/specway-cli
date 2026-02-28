import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

interface SpecwayConfig {
  apiKey?: string;
  defaultOrg?: string;
}

const CONFIG_DIR = join(homedir(), '.specway');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function getConfig(): SpecwayConfig {
  try {
    if (!existsSync(CONFIG_FILE)) return {};
    const content = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export function setConfig(updates: Partial<SpecwayConfig>): void {
  const config = { ...getConfig(), ...updates };
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
}

/**
 * Resolve API key from: flag > env > config file
 */
export function resolveApiKey(flagValue?: string): string | undefined {
  return flagValue || process.env.SPECWAY_API_KEY || getConfig().apiKey;
}
