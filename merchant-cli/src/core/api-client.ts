/**
 * HTTPS client for the ride/services API.
 *
 * - base = configured host; ride endpoints live under the `/api/v3/agent-pay` prefix
 * - auth via `X-Api-Key` header
 * - write operations may carry an `Idempotency-Key` header (never in the body)
 * - unwraps the v3 envelope `{ code, message, data }`: returns `data` on
 *   success (code "0000"), throws CliError (server code/message) on failure
 * - negotiates the CLI version floor via the `X-CLI-Min-Version` header
 * - maps connection/timeout failures to NETWORK_ERROR / TIMEOUT
 */
import { CliError, ErrorCodes } from './errors.js';
import { getHost } from './config-manager.js';
import { enforceMinVersion, getCurrentVersion } from './version.js';

const RIDE_PREFIX = '/api/v3/agent-pay';

export interface ApiClientOptions {
  apiKey: string;
  host?: string;
  timeout?: number;
}

export interface RequestOptions {
  body?: Record<string, unknown>;
  idempotencyKey?: string;
  query?: Record<string, string | number | boolean | undefined>;
}

interface Envelope<T> {
  code?: string;
  message?: string;
  data?: T;
}

export class ApiClient {
  private readonly host: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(options: ApiClientOptions) {
    this.apiKey = options.apiKey;
    this.host = (options.host ?? getHost()).replace(/\/+$/, '');
    this.timeout = options.timeout ?? 30000;
  }

  get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, options);
  }

  private async request<T>(
    method: string,
    path: string,
    options: RequestOptions,
  ): Promise<T> {
    let url = `${this.host}${RIDE_PREFIX}${path}`;
    if (options.query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) params.set(key, String(value));
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {
      'X-Api-Key': this.apiKey,
      'User-Agent': `agenzo-merchant-cli/${getCurrentVersion()}`,
    };
    if (options.body) headers['Content-Type'] = 'application/json';
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new CliError(
          ErrorCodes.TIMEOUT,
          `Request timed out after ${this.timeout}ms: ${url}`,
          'Retry, or check your network connection.',
        );
      }
      throw new CliError(
        ErrorCodes.NETWORK_ERROR,
        `Network request failed: ${url}`,
        'Check your network connection and the configured API host.',
      );
    } finally {
      clearTimeout(timer);
    }

    // Enforce the server-advertised version floor before reading the body.
    enforceMinVersion(response.headers.get('x-cli-min-version'));

    const text = await response.text();
    let envelope: Envelope<T>;
    try {
      envelope = JSON.parse(text) as Envelope<T>;
    } catch {
      throw new CliError(
        ErrorCodes.NETWORK_ERROR,
        `Unexpected non-JSON response (HTTP ${response.status}) from ${url}`,
      );
    }

    if (envelope.code !== undefined && envelope.code !== '0000') {
      const code = envelope.code;
      const message = envelope.message ?? `Request failed (HTTP ${response.status})`;
      throw new CliError(code, message);
    }

    return envelope.data as T;
  }
}
