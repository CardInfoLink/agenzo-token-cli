import { Command } from 'commander';
import { AuthService } from './auth-service.js';
import { Formatter } from '../utils/formatter.js';

export function registerLogoutCommand(
  program: Command,
  deps: { authService: AuthService },
): void {
  program
    .command('logout')
    .description('Sign out of current organization')
    .action(async () => {
      await deps.authService.logout();
      console.log(Formatter.status('success', 'Signed out'));
    });
}
