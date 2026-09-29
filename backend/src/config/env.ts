import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

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

const EMAIL_PROVIDERS = ['console', 'smtp', 'resend'] as const;
export type EmailProviderName = (typeof EMAIL_PROVIDERS)[number];

function parseEmailConfig(isProduction: boolean) {
  const provider = optional('EMAIL_PROVIDER') ?? 'console';
  if (!(EMAIL_PROVIDERS as readonly string[]).includes(provider)) {
    throw new Error(`EMAIL_PROVIDER must be one of ${EMAIL_PROVIDERS.join(', ')}, got "${provider}".`);
  }
  // The console provider logs verification and reset codes: anyone could take over accounts.
  if (provider === 'console' && isProduction) {
    throw new Error('EMAIL_PROVIDER=console is for development only. Configure smtp or resend in production.');
  }
  const hint = `It is required when EMAIL_PROVIDER=${provider}.`;
  const smtp =
    provider === 'smtp'
      ? {
          host: required('SMTP_HOST', hint),
          port: parsePort(optional('SMTP_PORT'), 587),
          user: required('SMTP_USER', hint),
          pass: required('SMTP_PASS', hint),
        }
      : undefined;
  return {
    provider: provider as EmailProviderName,
    // "Tripivo <no-reply@yourdomain.com>". With Resend the domain must be verified; with SMTP it
    // defaults to the SMTP account itself (e.g. your Gmail address).
    from:
      provider === 'resend'
        ? required('EMAIL_FROM', hint)
        : (optional('EMAIL_FROM') ?? (smtp ? `Tripivo <${smtp.user}>` : 'Tripivo <no-reply@tripivo.local>')),
    resendApiKey: provider === 'resend' ? required('RESEND_API_KEY', hint) : undefined,
    smtp,
  };
}

/** A code accepted for every phone and email verification. Development only. */
function parseDevMasterOtp(isProduction: boolean): string | null {
  const value = optional('DEV_MASTER_OTP');
  if (!value) return null;
  if (isProduction) throw new Error('DEV_MASTER_OTP lets anyone sign in to any account. Remove it in production.');
  if (!/^\d{6}$/.test(value)) throw new Error(`DEV_MASTER_OTP must be 6 digits, got "${value}".`);
  return value;
}

const PLACES_PROVIDERS = ['photon', 'google'] as const;
export type PlacesProviderName = (typeof PLACES_PROVIDERS)[number];

function parsePlacesConfig() {
  const provider = optional('PLACES_PROVIDER') ?? 'photon';
  if (!(PLACES_PROVIDERS as readonly string[]).includes(provider)) {
    throw new Error(`PLACES_PROVIDER must be one of ${PLACES_PROVIDERS.join(', ')}, got "${provider}".`);
  }
  return {
    provider: provider as PlacesProviderName,
    // Photon: OpenStreetMap search, free and keyless. Self-host it for heavy traffic.
    photonUrl: (optional('PHOTON_URL') ?? 'https://photon.komoot.io').replace(/\/+$/, ''),
    googleApiKey: provider === 'google' ? required('GOOGLE_PLACES_API_KEY', 'It is required when PLACES_PROVIDER=google.') : undefined,
  };
}

const STORAGE_PROVIDERS = ['local', 's3'] as const;
export type StorageProviderName = (typeof STORAGE_PROVIDERS)[number];

function parseStorageConfig() {
  const provider = optional('STORAGE_PROVIDER') ?? 'local';
  if (!(STORAGE_PROVIDERS as readonly string[]).includes(provider)) {
    throw new Error(`STORAGE_PROVIDER must be one of ${STORAGE_PROVIDERS.join(', ')}, got "${provider}".`);
  }
  if (provider !== 's3') return { provider: provider as StorageProviderName, s3: undefined };
  const hint = 'It is required when STORAGE_PROVIDER=s3.';
  return {
    provider: provider as StorageProviderName,
    // Any S3-compatible store: AWS S3, Cloudflare R2, MinIO (set S3_ENDPOINT for the last two).
    s3: {
      bucket: required('S3_BUCKET', hint),
      region: optional('S3_REGION') ?? 'auto',
      endpoint: optional('S3_ENDPOINT'),
      accessKeyId: required('S3_ACCESS_KEY_ID', hint),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY', hint),
      // Where the bucket's objects are publicly readable, e.g. a CDN or https://<bucket>.s3.<region>.amazonaws.com.
      publicUrl: required('S3_PUBLIC_URL', hint).replace(/\/+$/, ''),
      // MinIO needs path-style URLs (http://host:9000/bucket/key).
      forcePathStyle: optional('S3_FORCE_PATH_STYLE') === 'true',
    },
  };
}

function parseRedisConfig(isProduction: boolean) {
  const url = optional('REDIS_URL');
  // Behind a load balancer, in-memory rate limits and typing indicators silently break, so
  // production must have Redis.
  if (!url && isProduction) {
    throw new Error('REDIS_URL is required in production (e.g. rediss://default:<password>@<host>:6379).');
  }
  if (url && !/^rediss?:\/\//.test(url)) {
    throw new Error('REDIS_URL must start with redis:// or rediss:// (TLS).');
  }
  const keyPrefix = optional('REDIS_KEY_PREFIX') ?? 'tripivo:';
  if (!/^[\w:.-]{1,40}$/.test(keyPrefix)) {
    throw new Error(`REDIS_KEY_PREFIX may only contain letters, digits and ":._-", got "${keyPrefix}".`);
  }
  return { url, keyPrefix };
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
  // Where uploaded images are written (a directory URL ending in '/'). Defaults to backend/uploads.
  uploadDir: optional('UPLOAD_DIR')
    ? pathToFileURL(`${optional('UPLOAD_DIR')!.replace(/\/+$/, '')}/`)
    : new URL('../../uploads/', import.meta.url),
  // POST /api/auth/dev-login signs in as a demo user without any credentials. Never in production.
  devLoginEnabled: !isProduction && optional('DEV_LOGIN') !== 'false',
  email: parseEmailConfig(isProduction),
  devMasterOtp: parseDevMasterOtp(isProduction),
  places: parsePlacesConfig(),
  // Cache, rate-limit counters and cross-instance real-time events. Without a URL they are kept
  // in this process's memory, which is fine for one API instance but not behind a load balancer
  // (and refused in production). The prefix separates environments sharing one Redis server.
  redis: parseRedisConfig(isProduction),
  storage: parseStorageConfig(),
  // Requests per minute per client IP across the whole API (0 disables the limit).
  apiRateLimitPerMinute: parseNonNegativeInt('API_RATE_LIMIT_PER_MINUTE', 300),
  logRequests: optional('LOG_REQUESTS') !== 'false',
  // Optional: required only if "enhanced push security" is enabled for the Expo project.
  expoAccessToken: optional('EXPO_ACCESS_TOKEN'),
  phoneAuth: {
    provider: otpProvider,
    twilio: parseTwilioConfig(otpProvider),
  },
} as const;
