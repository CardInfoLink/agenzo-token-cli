/** Base class for all CLI errors */
export abstract class CliError extends Error {
  abstract readonly code: string;
}

/** API business error (backend error code) */
export class ApiBusinessError extends CliError {
  readonly code = 'API_BUSINESS_ERROR';
  constructor(
    public readonly errorCode: number,
    public readonly errorMessage: string,
    public readonly statusCode: number,
  ) {
    super(`[${errorCode}] ${errorMessage}`);
  }
}

/** Network error (timeout, connection failure) */
export class NetworkError extends CliError {
  readonly code = 'NETWORK_ERROR';
  constructor(
    public readonly url: string,
    public readonly timeout?: number,
    public readonly cause?: Error,
  ) {
    const detail = cause?.message;
    let msg: string;
    if (timeout) {
      msg = `Request timed out (${timeout}ms): ${url}`;
    } else if (detail) {
      msg = `Connection failed: ${url} (${detail})`;
    } else {
      msg = `Connection failed: ${url}`;
    }
    super(msg);
  }
}

/** Authentication error (not logged in, token expired) */
export class AuthError extends CliError {
  readonly code = 'AUTH_ERROR';
  constructor(
    message: string,
    public readonly suggestion: string,
  ) {
    super(message);
  }
}

/** Configuration error (corrupted file, unwritable directory) */
export class ConfigError extends CliError {
  readonly code = 'CONFIG_ERROR';
  constructor(
    message: string,
    public readonly filePath: string,
  ) {
    super(message);
  }
}

/** Input validation error */
export class ValidationError extends CliError {
  readonly code = 'VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
  }
}
