import { randomBytes } from 'node:crypto';

// All environment access goes through this module so misconfiguration fails at startup,
// not on the first request that happens to need a value.

function required(name: string, hint: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set. ${hint}`);
  }
  return value;
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got "${value}".`);
  }
  return port;
}

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const sessionSecret = process.env.SESSION_SECRET?.trim();

export const env = {
  port: parsePort(process.env.PORT, 4000),
  databaseUrl: required(
    'DATABASE_URL',
    'Copy backend/.env.example to backend/.env and fill it in.',
  ),
  // Every OAuth client the app signs in with. Native Google Sign-In issues tokens for the web
  // client ID, but listing all of them keeps any client's token valid.
  googleClientIds: parseList(process.env.GOOGLE_CLIENT_IDS),
  // Without a configured secret, sessions only survive until the API restarts.
  sessionSecret: sessionSecret ? new TextEncoder().encode(sessionSecret) : randomBytes(32),
  isSessionSecretConfigured: Boolean(sessionSecret),
} as const;
