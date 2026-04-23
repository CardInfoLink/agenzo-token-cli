import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { Developer } from '../types/api.js';

export function registerCreateCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('create')
    .description('创建开发者')
    .option('--name <name>', '开发者名称')
    .option('--email <email>', '开发者邮箱')
    .action(async (options) => {
      const token = await deps.authService.getValidAccessToken();

      const name = await PromptEngine.resolveInput(options.name, {
        message: '开发者名称:',
      });
      const email = await PromptEngine.resolveInput(options.email, {
        message: '开发者邮箱:',
      });

      const result = await deps.apiClient.post<Developer>(
        '/developers/create',
        { type: 'bearer', token },
        { name, email },
      );

      if (result.success) {
        console.log(Formatter.status('success', '开发者创建成功'));
        const data = result.data as Record<string, unknown>;
        console.log(
          Formatter.keyValue([
            ['ID', String(data.id ?? data.developer_id ?? '-')],
            ['组织 ID', String(data.organization_id ?? '-')],
            ['名称', String(data.name ?? '-')],
            ['邮箱', String(data.email ?? '-')],
            ['状态', String(data.status ?? '-')],
          ]),
        );
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
