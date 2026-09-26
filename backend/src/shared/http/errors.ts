import type { ErrorRequestHandler, RequestHandler } from 'express';

/**
 * An error whose message is safe to show the client. Throw it from services or handlers;
 * Express 5 forwards rejected promises to `errorHandler`, which turns it into a response.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message: string) {
    return new HttpError(400, message);
  }

  static unauthorized(message: string) {
    return new HttpError(401, message);
  }

  static forbidden(message: string) {
    return new HttpError(403, message);
  }

  static notFound(message: string) {
    return new HttpError(404, message);
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
  if (error instanceof HttpError || isExposedError(error)) {
    response.status(error.status).json({ error: error.message });
    return;
  }

  console.error(error);
  response.status(500).json({ error: 'Something went wrong' });
};
