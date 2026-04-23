import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { Developer } from '../types/api.js';

export function registerUpdateCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('update <developer_id>')
    .description('更新开发者信息')
    .option('--name <name>', '新名称')
    .option('--email <email>', '新邮箱')
    .action(async (developerId: string, options) => {
      const token = await deps.authService.getValidAccessToken();

      const body: Record<string, unknown> = {};
      if (options.name) body.name = options.name;
      if (options.email) body.email = options.email;

      const result = await deps.apiClient.post<Developer>(
        `/developers/${developerId}/update`,
        { type: 'bearer', token },
        body,
      );

      if (result.success) {
        console.log(Formatter.status('success', '开发者信息已更新'));
        console.log(
          Formatter.keyValue([
            ['ID', result.data.id],
            ['名称', result.data.name],
            ['邮箱', result.data.email],
            ['状态', result.data.status],
          ]),
        );
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
