import { readFile, writeFile, readdir, unlink, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { OrgCredential } from '../types/config.js';

export class CredentialStore {
  private readonly basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath ?? join(homedir(), '.agent-token-admin', 'credentials');
  }

  private filePath(orgId: string): string {
    return join(this.basePath, `${orgId}.json`);
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.basePath, { recursive: true });
  }

  async get(orgId: string): Promise<OrgCredential | null> {
    try {
      const content = await readFile(this.filePath(orgId), 'utf-8');
      return JSON.parse(content) as OrgCredential;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async save(credential: OrgCredential): Promise<void> {
    await this.ensureDir();
    await writeFile(
      this.filePath(credential.org_id),
      JSON.stringify(credential, null, 2),
      'utf-8',
    );
  }

  async delete(orgId: string): Promise<void> {
    try {
      await unlink(this.filePath(orgId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }

  async listAll(): Promise<OrgCredential[]> {
    try {
      const files = await readdir(this.basePath);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      const credentials: OrgCredential[] = [];
      for (const file of jsonFiles) {
        try {
          const content = await readFile(join(this.basePath, file), 'utf-8');
          credentials.push(JSON.parse(content) as OrgCredential);
        } catch {
          // Skip corrupted files
        }
      }
      return credentials;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async exists(orgId: string): Promise<boolean> {
    try {
      await access(this.filePath(orgId));
      return true;
    } catch {
      return false;
    }
  }
}
