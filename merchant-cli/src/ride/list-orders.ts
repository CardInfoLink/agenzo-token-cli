import { Command } from 'commander';
import { CliError, ErrorCodes } from '../core/errors.js';

/** Reserved for `--help --format json`. */
export const listOrdersSchema = {
  description: 'List ride orders with pagination and optional status filter.',
  params: {
    status: 'OrderStatus — optional status filter',
    page: 'number — page number (default 1)',
    'page-size': 'number — page size (default 20)',
  },
  response: {
    orders: 'Order[]',
    total: 'number',
    page: 'number',
    page_size: 'number',
  },
};

export function buildListOrdersCommand(): Command {
  return new Command('list-orders')
    .description(listOrdersSchema.description)
    .option('--status <status>', 'Filter by order status')
    .option('--page <page>', 'Page number')
    .option('--page-size <size>', 'Page size')
    .action(() => {
      throw new CliError(ErrorCodes.NOT_IMPLEMENTED, 'ride list-orders is not implemented yet.');
    });
}
