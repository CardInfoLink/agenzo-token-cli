import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { AppConfig } from '../types/config.js';
import { ConfigError } from '../utils/errors.js';

const DEFAULT_CONFIG: AppConfig = {
  active_org: null,
  api_host: 'https://agent.everonet.com',
  api_path: '/api/v3/agent-pay',
};

export class ConfigManager {
  private readonly basePath: string;
  private readonly configPath: string;

  constructor(basePath?: string) {
    this.basePath = basePath ?? join(homedir(), '.agenzo-token-cli');
    this.configPath = join(this.basePath, 'config.json');
  }

  async ensureDirectories(): Promise<void> {
    await mkdir(this.basePath, { recursive: true });
    await mkdir(join(this.basePath, 'credentials'), { recursive: true });
  }

  async load(): Promise<AppConfig> {
    try {
      const content = await readFile(this.configPath, 'utf-8');
      try {
        const raw = JSON.parse(content) as Record<string, unknown>;
        // Migrate old api_base_url format
        if (raw.api_base_url && !raw.api_host) {
          const url = String(raw.api_base_url);
          const pathIndex = url.indexOf('/api/');
          raw.api_host = pathIndex > 0 ? url.slice(0, pathIndex) : url;
          raw.api_path = pathIndex > 0 ? url.slice(pathIndex) : DEFAULT_CONFIG.api_path;
          delete raw.api_base_url;
        }
        return {
          active_org: (raw.active_org as string) ?? null,
          api_host: (raw.api_host as string) ?? DEFAULT_CONFIG.api_host,
          api_path: (raw.api_path as string) ?? DEFAULT_CONFIG.api_path,
        };
      } catch {
        throw new ConfigError(
          `Invalid config file: ${this.configPath}`,
          this.configPath,
        );
      }
    } catch (error) {
      if (error instanceof ConfigError) throw error;
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { ...DEFAULT_CONFIG };
      }
      throw error;
    }
  }

  async save(config: AppConfig): Promise<void> {
    await this.ensureDirectories();
    await writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  async getActiveOrg(): Promise<string | null> {
    const config = await this.load();
    return config.active_org;
  }

  async setActiveOrg(orgId: string): Promise<void> {
    const config = await this.load();
    config.active_org = orgId;
    await this.save(config);
  }

  async getApiBaseUrl(): Promise<string> {
    const config = await this.load();
    const host = config.api_host.replace(/\/+$/, '');
    const path = config.api_path.startsWith('/') ? config.api_path : `/${config.api_path}`;
    return `${host}${path}`;
  }

  async setApiHost(host: string): Promise<void> {
    const config = await this.load();
    config.api_host = host;
    await this.save(config);
  }

  async getApiHost(): Promise<string> {
    const config = await this.load();
    return config.api_host;
  }
}
