import { Formatter } from './formatter.js';

export type OutputFormat = 'json' | 'table';

/** Schema descriptor a verb reserves for `--help --format json`. */
export interface VerbSchema {
  description: string;
  params: Record<string, string>;
  response: Record<string, string>;
}

/** Emit a result payload in the requested format (json default, table via Formatter). */
export function emit(data: unknown, format: OutputFormat = 'json'): void {
  if (format === 'table') {
    console.log(Formatter.auto(data));
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Emit one NDJSON record (a single-line JSON object terminated by a newline)
 * to stdout. Used by streaming/polling commands (`ride-elife get --watch`):
 * each poll result is written as its own line so an agent can consume the
 * stream incrementally with a line reader. Always compact (no pretty-print),
 * regardless of `--format`, because NDJSON requires one object per line.
 */
export function emitNdjsonLine(data: unknown): void {
  console.log(JSON.stringify(data));
}

/** Helper for `--help --format json`: print a verb's param/response schema. */
export function emitSchema(schema: VerbSchema, format: OutputFormat = 'json'): void {
  if (format === 'table') {
    console.log(Formatter.keyValue(Object.entries(schema.params)));
  } else {
    console.log(JSON.stringify(schema, null, 2));
  }
}
