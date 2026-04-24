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
    .description('Rotate API Key')
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

        console.log(Formatter.status('success', 'API Key rotated'));
        console.log(
          Formatter.status('warning', `New API Key: ${key.api_key}`),
        );
        console.log(
          Formatter.status('warning', 'Save it now — this key is shown only once'),
        );
        console.log(
          Formatter.keyValue([
            ['Key ID', key.id],
            ['Name', key.name],
            ['Prefix', key.key_prefix],
            ['Status', key.status],
          ]),
        );
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
