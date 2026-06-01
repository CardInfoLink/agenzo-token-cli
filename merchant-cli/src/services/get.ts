import { Command } from 'commander';
import { CliError, ErrorCodes } from '../core/errors.js';

/** Reserved for `--help --format json`. */
export const serviceGetSchema = {
  description: 'Retrieve a single merchant service by id.',
  params: {
    'service-id': 'string — service id to retrieve',
  },
  response: {
    service_id: 'string',
    name: 'string',
    enabled: 'boolean',
  },
};

export function buildServiceGetCommand(): Command {
  return new Command('get')
    .description(serviceGetSchema.description)
    .argument('<service-id>', 'Service id to retrieve')
    .action(() => {
      throw new CliError(ErrorCodes.SERVICE_NOT_FOUND, 'services get is not implemented yet.');
    });
}
