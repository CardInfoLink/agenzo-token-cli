import { Command } from 'commander';
import { emit, emitSchema, type OutputFormat, type VerbSchema } from '../core/output.js';
import { SERVICE_REGISTRY } from './registry.js';

/** Reserved for `--help --format json`. */
export const servicesListSchema: VerbSchema = {
  description: 'List available merchant services from the registry.',
  params: {},
  response: {
    services:
      'Service[] — each with service_id, name, provider, cli_noun, version, verbs, billing_mode',
  },
};

function resolveFormat(cmd: Command): OutputFormat {
  return cmd.optsWithGlobals().format === 'table' ? 'table' : 'json';
}

export function buildServicesListCommand(): Command {
  return new Command('list')
    .description(servicesListSchema.description)
    .helpOption(false)
    .option('-h, --help', 'Show help; with --format json prints the schema')
    .action((opts: { help?: boolean }, cmd: Command) => {
      const format = resolveFormat(cmd);
      if (opts.help) {
        emitSchema(servicesListSchema, format);
        return;
      }
      const services = SERVICE_REGISTRY.map((s) => ({
        service_id: s.service_id,
        name: s.name,
        provider: s.provider,
        cli_noun: s.cli_noun,
        version: s.version,
        verbs: s.verbs.join(', '),
        billing_mode: s.billing.mode,
      }));
      emit(services, format);
    });
}
