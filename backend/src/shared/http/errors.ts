import type { ErrorRequestHandler, RequestHandler } from 'express';

/**
 * An error whose message is safe to show the client. Throw it from services or handlers;
 * Express 5 forwards rejected promises to `errorHandler`, which turns it into a response.
 */
export type HttpErrorDetails = {
  /** Machine-readable reason the client can branch on, e.g. 'email_not_verified'. */
  code?: string;
  /** The request field the error is about, so forms can show it next to that input. */
  field?: string;
  /** Extra JSON properties to include in the response body. */
  extra?: Record<string, unknown>;
};

export class HttpError extends Error {
  readonly code?: string;
  readonly field?: string;
  readonly extra?: Record<string, unknown>;

  constructor(
    readonly status: number,
    message: string,
    details: HttpErrorDetails = {},
  ) {
    super(message);
    this.name = 'HttpError';
    this.code = details.code;
    this.field = details.field;
    this.extra = details.extra;
  }

  static badRequest(message: string, details?: HttpErrorDetails) {
    return new HttpError(400, message, details);
  }

  static unauthorized(message: string, details?: HttpErrorDetails) {
    return new HttpError(401, message, details);
  }

  static forbidden(message: string, details?: HttpErrorDetails) {
    return new HttpError(403, message, details);
  }

  static notFound(message: string, details?: HttpErrorDetails) {
    return new HttpError(404, message, details);
  }

  static conflict(message: string, details?: HttpErrorDetails) {
    return new HttpError(409, message, details);
  }

  static tooManyRequests(message: string, details?: HttpErrorDetails) {
    return new HttpError(429, message, details);
  }
}

/** Errors from Express middleware (e.g. malformed JSON) that carry a client-safe status. */
type ExposedError = { status: number; expose: true; message: string };

function isExposedError(error: unknown): error is ExposedError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'expose' in error &&
    error.expose === true &&
    'status' in error &&
    typeof error.status === 'number'
  );
}

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({ error: 'Not found' });
};

// Express recognizes error handlers by their four parameters, so `_next` must stay.
export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({ ...error.extra, error: error.message, code: error.code, field: error.field });
    return;
  }
  if (isExposedError(error)) {
    response.status(error.status).json({ error: error.message });
    return;
  }

  console.error(error);
  response.status(500).json({ error: 'Something went wrong' });
};
