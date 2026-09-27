// Values middleware stores on `response.locals`, typed for every handler.
declare global {
  namespace Express {
    interface Locals {
      /** Set by `requireAuth`; present on every route mounted behind it. */
      userId: string;
      /** Set by `requireAuth`: the `sessions` row of the current token. */
      sessionId: string;
    }
  }
}

export {};
