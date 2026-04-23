import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { AppConfig } from '../types/config.js';
import { ConfigError } from '../utils/errors.js';

const DEFAULT_CONFIG: AppConfig = {
  active_org: null,
  api_base_url: 'http://localhost:8000/api/v3/agent-pay',
};

export class ConfigManager {
  private readonly basePath: string;
  private readonly configPath: string;

  constructor(basePath?: string) {
    this.basePath = basePath ?? join(homedir(), '.agent-token-admin');
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
        return JSON.parse(content) as AppConfig;
      } catch {
        throw new ConfigError(
          `配置文件格式错误: ${this.configPath}`,
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
    return config.api_base_url;
  }
}
