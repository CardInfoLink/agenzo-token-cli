import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { KeyStore } from '../config/key-store.js';
import { ConfigManager } from '../config/config-manager.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { ApiKey } from '../types/api.js';

export function registerCreateCommand(
  parent: Command,
  deps: {
    apiClient: ApiClient;
    authService: AuthService;
    keyStore: KeyStore;
    configManager: ConfigManager;
  },
): void {
  parent
    .command('create')
    .description('Create an API Key')
    .option('--developer-id <developer_id>', 'Developer ID (e.g. dev_01KPX...)')
    .option('--key-name <key_name>', 'Key name (e.g. Production Key)')
    .action(async (options) => {
      const developerId = await PromptEngine.resolveInput(options.developerId, {
        message: 'Developer ID (e.g. dev_01KPX...):',
      });
      const name = await PromptEngine.resolveInput(options.keyName, {
        message: 'Key name (e.g. Production Key):',
      });

      const result = await deps.authService.executeWithAuth((token) =>
        deps.apiClient.post<ApiKey>(
          '/keys/create',
          { type: 'bearer', token },
          { developer_id: developerId, name },
        ),
      );

      if (result.success) {
        const key = result.data;

        // Persist to KeyStore
        const orgId = await deps.configManager.getActiveOrg();
        if (orgId && key.api_key) {
          await deps.keyStore.add(orgId, {
            key_id: key.id,
            developer_id: key.developer_id,
            name: key.name,
            key_value: key.api_key,
            created_at: key.created_at,
          });
        }

        console.log(Formatter.status('success', 'API Key created'));
        console.log(
          Formatter.status('warning', `API Key: ${key.api_key}`),
        );
        console.log(
          Formatter.status('warning', 'Save it now — this key is shown only once'),
        );
        console.log(
          Formatter.keyValue([
            ['Name', key.name],
            ['Status', key.status],
          ]),
        );
      } else {
        console.error(
          Formatter.status('error', result.errorMessage),
        );
      }
    });
}
