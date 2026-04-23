import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { StoredApiKey, KeyStoreData } from '../types/config.js';

export class KeyStore {
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(homedir(), '.agent-token-admin', 'keys.json');
  }

  private async loadData(): Promise<KeyStoreData> {
    try {
      const content = await readFile(this.filePath, 'utf-8');
      return JSON.parse(content) as KeyStoreData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  private async saveData(data: KeyStoreData): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async add(orgId: string, key: StoredApiKey): Promise<void> {
    const data = await this.loadData();
    if (!data[orgId]) {
      data[orgId] = [];
    }
    data[orgId].push(key);
    await this.saveData(data);
  }

  async update(orgId: string, keyId: string, newKeyValue: string): Promise<void> {
    const data = await this.loadData();
    const keys = data[orgId];
    if (!keys) return;
    const key = keys.find((k) => k.key_id === keyId);
    if (key) {
      key.key_value = newKeyValue;
      await this.saveData(data);
    }
  }

  async list(orgId: string): Promise<StoredApiKey[]> {
    const data = await this.loadData();
    return data[orgId] ?? [];
  }

  async get(orgId: string, keyId: string): Promise<StoredApiKey | null> {
    const data = await this.loadData();
    const keys = data[orgId];
    if (!keys) return null;
    return keys.find((k) => k.key_id === keyId) ?? null;
  }
}
