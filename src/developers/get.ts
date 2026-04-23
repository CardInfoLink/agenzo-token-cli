import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { Developer } from '../types/api.js';

export function registerGetCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('get <developer_id>')
    .description('查看开发者详情')
    .action(async (developerId: string) => {
      const token = await deps.authService.getValidAccessToken();

      const result = await deps.apiClient.get<Developer>(
        `/developers/${developerId}`,
        { type: 'bearer', token },
      );

      if (result.success) {
        console.log(
          Formatter.keyValue([
            ['ID', result.data.id],
            ['名称', result.data.name],
            ['邮箱', result.data.email],
            ['状态', result.data.status],
            ['创建时间', result.data.created_at],
            ['更新时间', result.data.updated_at],
          ]),
        );
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
