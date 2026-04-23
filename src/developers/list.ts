import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { Developer } from '../types/api.js';

export function registerListCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('list')
    .description('列出所有开发者')
    .action(async () => {
      const token = await deps.authService.getValidAccessToken();

      const result = await deps.apiClient.get<Developer[]>(
        '/developers',
        { type: 'bearer', token },
      );

      if (result.success) {
        if (result.data.length === 0) {
          console.log(Formatter.status('info', '暂无开发者'));
          return;
        }
        const headers = ['ID', '名称', '邮箱', '状态'];
        const rows = result.data.map((d) => [
          d.id,
          d.name,
          d.email,
          d.status,
        ]);
        console.log(Formatter.table(headers, rows));
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
