import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { KeyStore } from '../config/key-store.js';
import { ConfigManager } from '../config/config-manager.js';
import { Formatter } from '../utils/formatter.js';
import { ApiKey } from '../types/api.js';

export function registerRotateCommand(
  parent: Command,
  deps: {
    apiClient: ApiClient;
    authService: AuthService;
    keyStore: KeyStore;
    configManager: ConfigManager;
  },
): void {
  parent
    .command('rotate <key_id>')
    .description('轮换 API Key')
    .action(async (keyId: string) => {
      const token = await deps.authService.getValidAccessToken();

      const result = await deps.apiClient.post<ApiKey>(
        `/keys/${keyId}/rotate`,
        { type: 'bearer', token },
      );

      if (result.success) {
        const key = result.data;

        // Update KeyStore
        const orgId = await deps.configManager.getActiveOrg();
        if (orgId && key.api_key) {
          await deps.keyStore.update(orgId, keyId, key.api_key);
        }

        console.log(Formatter.status('success', 'API Key 已轮换'));
        console.log(
          Formatter.status('warning', `新 API Key: ${key.api_key}`),
        );
        console.log(
          Formatter.status('warning', '请妥善保存，此 Key 仅显示一次'),
        );
        console.log(
          Formatter.keyValue([
            ['Key ID', key.id],
            ['名称', key.name],
            ['前缀', key.key_prefix],
            ['状态', key.status],
          ]),
        );
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
