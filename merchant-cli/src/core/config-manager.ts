/**
 * Local config persisted at ~/.agenzo-merchant-cli/config.json.
 * Only the API host is stored; everything else is runtime/flag driven.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CliError, ErrorCodes } from './errors.js';

export const DEFAULT_HOST = 'https://agent.everonet.com';

const CONFIG_DIR = join(homedir(), '.agenzo-merchant-cli');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

interface Config {
  host: string;
}

function read(): Config {
  let raw: string;
  try {
    raw = readFileSync(CONFIG_PATH, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { host: DEFAULT_HOST };
    }
    throw error;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<Config>;
    return { host: parsed.host ?? DEFAULT_HOST };
  } catch {
    throw new CliError(
      ErrorCodes.CONFIG_ERROR,
      `Invalid config file: ${CONFIG_PATH}`,
      'Delete the file to reset to defaults.',
    );
  }
}

function write(config: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function getHost(): string {
  return read().host;
}

export function setHost(host: string): void {
  write({ host: host.replace(/\/+$/, '') });
}

export function resetHost(): void {
  write({ host: DEFAULT_HOST });
}
