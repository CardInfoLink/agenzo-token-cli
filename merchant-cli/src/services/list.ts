import { Command } from 'commander';
import { CliError, ErrorCodes } from '../core/errors.js';

/** Reserved for `--help --format json`. */
export const servicesListSchema = {
  description: 'List available merchant services from the registry.',
  params: {},
  response: {
    services: 'Service[]',
  },
};

export function buildServicesListCommand(): Command {
  return new Command('list')
    .description(servicesListSchema.description)
    .action(() => {
      throw new CliError(ErrorCodes.NOT_IMPLEMENTED, 'services list is not implemented yet.');
    });
}
