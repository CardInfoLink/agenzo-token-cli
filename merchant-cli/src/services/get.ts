import { Command } from 'commander';
import { CliError, ErrorCodes } from '../core/errors.js';
import { emit, emitSchema, type OutputFormat, type VerbSchema } from '../core/output.js';
import { findService } from './registry.js';

/** Reserved for `--help --format json`. */
export const serviceGetSchema: VerbSchema = {
  description: 'Retrieve a single merchant service by id, with verb and workflow detail.',
  params: {
    'service-id': 'string — service id to retrieve',
  },
  response: {
    service_id: 'string',
    name: 'string',
    description: 'string',
    version: 'string',
    provider: 'string',
    cli_noun: 'string',
    verbs: 'string[]',
    verb_descriptions: 'Record<verb, description>',
    workflow: 'string[] — ordered steps quote→book→get(poll)→[cancel]',
    since: 'string — ISO date',
    discovery: '{ help_command: string }',
  },
};

function resolveFormat(cmd: Command): OutputFormat {
  return cmd.optsWithGlobals().format === 'table' ? 'table' : 'json';
}

export function buildServiceGetCommand(): Command {
  return new Command('get')
    .description(serviceGetSchema.description)
    .argument('[service-id]', 'Service id to retrieve')
    .helpOption(false)
    .option('-h, --help', 'Show help; with --format json prints the schema')
    .action((serviceId: string | undefined, opts: { help?: boolean }, cmd: Command) => {
      const format = resolveFormat(cmd);
      if (opts.help) {
        emitSchema(serviceGetSchema, format);
        return;
      }
      const service = serviceId ? findService(serviceId) : undefined;
      if (!service) {
        throw new CliError(
          ErrorCodes.SERVICE_NOT_FOUND,
          `Service '${serviceId ?? ''}' not found in the registry (SERVICE_NOT_FOUND).`,
          'Run "services list" to see available services.',
        );
      }
      emit(service, format);
    });
}
