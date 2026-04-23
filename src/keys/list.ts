import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { ApiKey } from '../types/api.js';

export function registerListCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('list')
    .description('列出 API Key')
    .option('--developer <developer_id>', '开发者 ID')
    .action(async (options) => {
      const token = await deps.authService.getValidAccessToken();

      const developerId = await PromptEngine.resolveInput(options.developer, {
        message: '开发者 ID:',
      });

      const result = await deps.apiClient.get<ApiKey[]>(
        '/keys',
        { type: 'bearer', token },
        { developer_id: developerId },
      );

      if (result.success) {
        if (result.data.length === 0) {
          console.log(Formatter.status('info', '暂无 API Key'));
          return;
        }
        const headers = ['ID', '开发者', '名称', '前缀', '状态', '最后使用'];
        const rows = result.data.map((k) => [
          k.id,
          k.developer_id,
          k.name,
          k.key_prefix,
          k.status,
          k.last_used_at ?? '从未使用',
        ]);
        console.log(Formatter.table(headers, rows));
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
