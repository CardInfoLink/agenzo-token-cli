import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { Organization } from '../types/api.js';

export function registerMeCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('me')
    .description('查看当前组织信息')
    .action(async () => {
      const token = await deps.authService.getValidAccessToken();
      const result = await deps.apiClient.get<Organization>(
        '/organizations/me',
        { type: 'bearer', token },
      );

      if (result.success) {
        console.log(
          Formatter.keyValue([
            ['组织 ID', result.data.id],
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
