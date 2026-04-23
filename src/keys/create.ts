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
    .description('创建 API Key')
    .option('--developer <developer_id>', '开发者 ID')
    .option('--name <name>', 'Key 名称')
    .action(async (options) => {
      const token = await deps.authService.getValidAccessToken();

      const developerId = await PromptEngine.resolveInput(options.developer, {
        message: '开发者 ID:',
      });
      const name = await PromptEngine.resolveInput(options.name, {
        message: 'Key 名称:',
      });

      const result = await deps.apiClient.post<ApiKey>(
        '/keys/create',
        { type: 'bearer', token },
        { developer_id: developerId, name },
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

        console.log(Formatter.status('success', 'API Key 创建成功'));
        console.log(
          Formatter.status('warning', `API Key: ${key.api_key}`),
        );
        console.log(
          Formatter.status('warning', '请妥善保存，此 Key 仅显示一次'),
        );
        console.log(
          Formatter.keyValue([
            ['Key ID', key.id],
            ['开发者 ID', key.developer_id],
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
