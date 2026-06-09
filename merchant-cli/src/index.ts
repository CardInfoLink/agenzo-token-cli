import { Command } from 'commander';
import { CliError } from './core/errors.js';
import { getHost, resetHost, setHost } from './core/config-manager.js';
import { Formatter } from './core/formatter.js';
import { emit, type OutputFormat } from './core/output.js';
import { getCurrentVersion } from './core/version.js';

// Ride command builders
import { buildQuoteCommand } from './ride/quote.js';
import { buildBookCommand } from './ride/book.js';
import { buildRideGetCommand } from './ride/get.js';
import { buildCancelCommand } from './ride/cancel.js';
import { buildListOrdersCommand } from './ride/list-orders.js';

// Services command builders
import { buildServicesListCommand } from './services/list.js';
import { buildServiceGetCommand } from './services/get.js';

function resolveFormat(cmd: Command): OutputFormat {
  return cmd.optsWithGlobals().format === 'table' ? 'table' : 'json';
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('agenzo-merchant-cli')
    .description('CLI for ordering rides and querying merchant services')
    .version(getCurrentVersion())
    .option('--format <format>', 'Output format: json|table', 'json')
    .option('--yes', 'Skip confirmation prompts (for automation/AI Agents)', false)
    .option('--api-key <key>', 'API key for runtime requests');

  // config group — fully implemented locally (no network)
  const config = program.command('config').description('Local API host configuration');
  config
    .command('set-host <url>')
    .description('Set the API host')
    .action((url: string) => {
      setHost(url);
      console.log(Formatter.status('success', `API host set to ${getHost()}`));
    });
  config
    .command('reset-host')
    .description('Reset the API host to the default')
    .action(() => {
      resetHost();
      console.log(Formatter.status('success', `API host reset to ${getHost()}`));
    });
  config
    .command('show')
    .description('Show the current configuration')
    .action((_options, cmd: Command) => {
      emit({ host: getHost() }, resolveFormat(cmd));
    });

  // ride-elife group
  const rideElife = program
    .command('ride-elife')
    .description('Ride ordering (eLife): quote, book, get, cancel, list-orders');
  rideElife.addCommand(buildQuoteCommand());
  rideElife.addCommand(buildBookCommand());
  rideElife.addCommand(buildRideGetCommand());
  rideElife.addCommand(buildCancelCommand());
  rideElife.addCommand(buildListOrdersCommand());

  // services group
  const services = program.command('services').description('Service registry: list, get');
  services.addCommand(buildServicesListCommand());
  services.addCommand(buildServiceGetCommand());

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  if (error instanceof CliError) {
    console.error(Formatter.status('error', error.message));
    if (error.recovery) console.error(Formatter.status('info', error.recovery));
    process.exit(error.exitCode);
  }
  console.error(
    Formatter.status('error', error instanceof Error ? error.message : 'An unexpected error occurred'),
  );
  process.exit(1);
});
