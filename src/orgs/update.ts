import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { Organization } from '../types/api.js';

export function registerUpdateCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('update')
    .description('更新当前组织信息')
    .option('--name <name>', '新组织名称')
    .option('--email <email>', '新邮箱')
    .action(async (options) => {
      const token = await deps.authService.getValidAccessToken();

      const body: Record<string, unknown> = {};
      if (options.name) body.name = options.name;
      if (options.email) body.email = options.email;

      const result = await deps.apiClient.post<Organization>(
        '/organizations/me/update',
        { type: 'bearer', token },
        body,
      );

      if (result.success) {
        console.log(Formatter.status('success', '组织信息已更新'));
        console.log(
          Formatter.keyValue([
            ['组织 ID', result.data.id],
            ['名称', result.data.name],
            ['邮箱', result.data.email],
            ['状态', result.data.status],
          ]),
        );
        if (options.email) {
          console.log(
            Formatter.status('info', '邮箱变更需要到新邮箱完成验证'),
          );
        }
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
