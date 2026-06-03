import { Command } from 'commander';
import { ApiClient } from '../core/api-client.js';
import { emit, type OutputFormat } from '../core/output.js';
import { createSpinner } from '../core/formatter.js';
import { PromptEngine } from '../core/prompt-engine.js';
import { attachSchemaHelp } from '../utils/cli-help.js';
import type { ListOrdersResponse } from '../types/api.js';

/** Reserved for `--help --format json`. */
export const listOrdersSchema = {
  description: 'List ride orders with pagination and optional filters.',
  params: {
    page: 'number — page number (default 1)',
    'page-size': 'number — page size (default 20)',
    status: 'OrderStatus — optional status filter',
    'order-type': 'string — optional order type filter',
  },
  response: {
    orders: 'Order[]',
    total: 'number',
    page: 'number',
    page_size: 'number',
  },
};

export function buildListOrdersCommand(): Command {
  const cmd = new Command('list-orders')
    .description(listOrdersSchema.description)
    .option('--page <page>', 'Page number', '1')
    .option('--page-size <size>', 'Page size', '20')
    .option('--status <status>', 'Filter by order status')
    .option('--order-type <type>', 'Filter by order type')
    .action(async (_opts, command: Command) => {
      const o = command.optsWithGlobals();
      const format: OutputFormat = o.format === 'table' ? 'table' : 'json';
      const apiKey = await PromptEngine.resolveInput(o.apiKey, {
        message: 'API key:',
        type: 'password',
      });

      const client = new ApiClient({ apiKey });
      const spinner = createSpinner('Fetching orders...');
      try {
        const data = await client.get<ListOrdersResponse>('/ride/orders', {
          query: {
            page: Number(o.page),
            page_size: Number(o.pageSize),
            status: o.status,
            order_type: o.orderType,
          },
        });
        spinner.stop();
        emit(data, format);
      } catch (err) {
        spinner.fail('Failed to fetch orders');
        throw err;
      }
    });

  return attachSchemaHelp(cmd, listOrdersSchema);
}
