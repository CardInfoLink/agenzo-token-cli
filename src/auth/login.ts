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
    .description('Sign in to Agent Payment API')
    .option('--email <email>', 'Email address')
    .action(async (options) => {
      const email = await PromptEngine.resolveInput(options.email, {
        message: 'Email:',
      });

      console.log(Formatter.status('loading', 'Sending magic link...'));

      const result = await deps.authService.login(email);

      if (result.isNewRegistration) {
        console.log(Formatter.status('success', 'Registered and signed in'));
      } else {
        console.log(Formatter.status('success', 'Signed in successfully'));
      }

      console.log(
        Formatter.keyValue([
          ['Org ID', result.credential.org_id],
          ['Org Name', result.credential.org_name],
          ['Email', result.credential.email],
        ]),
      );
    });
}
