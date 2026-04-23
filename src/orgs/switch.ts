import { Command } from 'commander';
import { CredentialStore } from '../config/credential-store.js';
import { ConfigManager } from '../config/config-manager.js';
import { Formatter } from '../utils/formatter.js';

export function registerSwitchCommand(
  parent: Command,
  deps: { credentialStore: CredentialStore; configManager: ConfigManager },
): void {
  parent
    .command('switch <org_id>')
    .description('切换活跃组织')
    .action(async (orgId: string) => {
      const exists = await deps.credentialStore.exists(orgId);
      if (!exists) {
        console.error(
          Formatter.status('error', `组织 ${orgId} 未在本地登录`),
        );
        console.error(
          Formatter.status('info', '请先执行 agent-token-admin login 登录该组织'),
        );
        return;
      }

      await deps.configManager.setActiveOrg(orgId);
      console.log(Formatter.status('success', `已切换到组织 ${orgId}`));
    });
}
