// Values middleware stores on `response.locals`, typed for every handler.
declare global {
  namespace Express {
    interface Locals {
      /** Set by `requireAuth`; present on every route mounted behind it. */
      userId: string;
    }
  }
}

export {};
