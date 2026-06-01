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

/** Helper for `--help --format json`: print a verb's param/response schema. */
export function emitSchema(schema: VerbSchema, format: OutputFormat = 'json'): void {
  if (format === 'table') {
    console.log(Formatter.keyValue(Object.entries(schema.params)));
  } else {
    console.log(JSON.stringify(schema, null, 2));
  }
}
