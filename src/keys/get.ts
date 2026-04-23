import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { ApiKey } from '../types/api.js';

export function registerGetCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('get <key_id>')
    .description('查看 API Key 详情')
    .action(async (keyId: string) => {
      const token = await deps.authService.getValidAccessToken();

      const result = await deps.apiClient.get<ApiKey>(
        `/keys/${keyId}`,
        { type: 'bearer', token },
      );

      if (result.success) {
        const k = result.data;
        console.log(
          Formatter.keyValue([
            ['Key ID', k.id],
            ['开发者 ID', k.developer_id],
            ['名称', k.name],
            ['前缀', k.key_prefix],
            ['状态', k.status],
            ['最后使用', k.last_used_at ?? '从未使用'],
            ['创建时间', k.created_at],
          ]),
        );
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
