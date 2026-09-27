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

function optional(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNonNegativeInt(name: string, fallback: number): number {
  const value = optional(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer, got "${value}".`);
  }
  return parsed;
}

const OTP_PROVIDERS = ['console', 'twilio'] as const;
export type OtpProviderName = (typeof OTP_PROVIDERS)[number];

function parseOtpProvider(isProduction: boolean): OtpProviderName {
  const value = optional('OTP_PROVIDER') ?? 'console';
  if (!(OTP_PROVIDERS as readonly string[]).includes(value)) {
    throw new Error(`OTP_PROVIDER must be one of ${OTP_PROVIDERS.join(', ')}, got "${value}".`);
  }
  // The console provider logs codes instead of texting them: anyone could sign in as anyone.
  if (value === 'console' && isProduction) {
    throw new Error('OTP_PROVIDER=console is for development only. Configure twilio in production.');
  }
  return value as OtpProviderName;
}

function parseTwilioConfig(provider: OtpProviderName) {
  if (provider !== 'twilio') return null;
  const hint = 'It is required when OTP_PROVIDER=twilio.';
  return {
    accountSid: required('TWILIO_ACCOUNT_SID', hint),
    authToken: required('TWILIO_AUTH_TOKEN', hint),
    verifyServiceSid: required('TWILIO_VERIFY_SERVICE_SID', hint),
  };
}

const isProduction = process.env.NODE_ENV === 'production';
const otpProvider = parseOtpProvider(isProduction);
const sessionSecret = process.env.SESSION_SECRET?.trim();
const googleWebClientId = optional('GOOGLE_WEB_CLIENT_ID');

export const env = {
  isProduction,
  port: parsePort(process.env.PORT, 4000),
  // Number of reverse proxies in front of the API (1 behind ngrok or a load balancer), so
  // `request.ip` is the real client IP. Leave 0 when clients connect directly: trusting
  // X-Forwarded-For without a proxy lets clients spoof their IP and dodge rate limits.
  trustProxy: parseNonNegativeInt('TRUST_PROXY', 0),
  databaseUrl: required(
    'DATABASE_URL',
    'Copy backend/.env.example to backend/.env and fill it in.',
  ),
  // Every OAuth client the app signs in with. Native Google Sign-In issues tokens for the web
  // client ID, but listing all of them keeps any client's token valid.
  googleClientIds: [
    ...new Set([...parseList(process.env.GOOGLE_CLIENT_IDS), googleWebClientId].filter(
      (id): id is string => Boolean(id),
    )),
  ],
  // Server-side (authorization code) Google sign-in, used where native sign-in is unavailable,
  // such as Expo Go. Every field must be set for it to be enabled.
  googleOAuth: {
    clientId: googleWebClientId,
    clientSecret: optional('GOOGLE_WEB_CLIENT_SECRET'),
    // Public HTTPS origin of this API (e.g. an ngrok URL); Google redirects back to it.
    publicApiUrl: optional('PUBLIC_API_URL')?.replace(/\/+$/, ''),
    // Where the API may send the browser back with a session token once sign-in completes.
    // Anything matching can receive a token, so keep this to your own app's URL schemes.
    returnUrlPrefixes: parseList(process.env.OAUTH_RETURN_URL_PREFIXES ?? 'tripivo://'),
  },
  // Without a configured secret, sessions only survive until the API restarts.
  sessionSecret: sessionSecret ? new TextEncoder().encode(sessionSecret) : randomBytes(32),
  isSessionSecretConfigured: Boolean(sessionSecret),
  phoneAuth: {
    provider: otpProvider,
    twilio: parseTwilioConfig(otpProvider),
  },
} as const;
