import { Command } from 'commander';
import { AuthService } from './auth-service.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';

export function registerLoginCommand(
  program: Command,
  deps: { authService: AuthService },
): void {
  program
    .command('login')
    .description('登录到 Agent Payment API')
    .option('--email <email>', '登录邮箱')
    .action(async (options) => {
      const email = await PromptEngine.resolveInput(options.email, {
        message: '邮箱:',
      });

      console.log(Formatter.status('loading', '正在发送 magic link...'));

      const result = await deps.authService.login(email);

      if (result.isNewRegistration) {
        console.log(Formatter.status('success', '注册成功并已登录'));
      } else {
        console.log(Formatter.status('success', '登录成功'));
      }

      console.log(
        Formatter.keyValue([
          ['组织 ID', result.credential.org_id],
          ['组织名称', result.credential.org_name],
          ['邮箱', result.credential.email],
        ]),
      );
    });
}
