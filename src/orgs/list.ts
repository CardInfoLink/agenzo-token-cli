import { Command } from 'commander';
import { CredentialStore } from '../config/credential-store.js';
import { ConfigManager } from '../config/config-manager.js';
import { Formatter } from '../utils/formatter.js';

export function registerListCommand(
  parent: Command,
  deps: { credentialStore: CredentialStore; configManager: ConfigManager },
): void {
  parent
    .command('list')
    .description('列出所有已登录的组织')
    .action(async () => {
      const credentials = await deps.credentialStore.listAll();
      const activeOrg = await deps.configManager.getActiveOrg();

      if (credentials.length === 0) {
        console.log(Formatter.status('info', '暂无已登录的组织'));
        return;
      }

      const headers = ['', '组织 ID', '组织名称', '邮箱'];
      const rows = credentials.map((cred) => [
        cred.org_id === activeOrg ? '*' : '',
        cred.org_id,
        cred.org_name,
        cred.email,
      ]);

      console.log(Formatter.table(headers, rows));
    });
}
