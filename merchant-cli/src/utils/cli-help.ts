/**
 * `--help --format <fmt>` support shared by the read-only verbs.
 *
 * Commander processes `--help` before later argv tokens, so the resolved
 * `--format` option is not yet available when help renders. We therefore read
 * the format directly from `process.argv`: when it is explicitly `json`/`table`
 * we print the verb schema (via emitSchema) instead of the usage text, and let
 * commander render the default help otherwise.
 */
import type { Command } from 'commander';
import { emitSchema, type OutputFormat, type VerbSchema } from '../core/output.js';

function explicitFormat(): OutputFormat | undefined {
  const argv = process.argv;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--format=json' || (a === '--format' && argv[i + 1] === 'json')) return 'json';
    if (a === '--format=table' || (a === '--format' && argv[i + 1] === 'table')) return 'table';
  }
  return undefined;
}

/** Print `schema` for `--help --format json|table`; otherwise default usage. */
export function attachSchemaHelp(cmd: Command, schema: VerbSchema): Command {
  const baseHelp = cmd.helpInformation.bind(cmd);
  cmd.helpInformation = (ctx) => {
    const format = explicitFormat();
    if (!format) return baseHelp(ctx);
    emitSchema(schema, format);
    return '';
  };
  return cmd;
}
