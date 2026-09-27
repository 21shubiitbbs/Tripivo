import { OAuth2Client } from 'google-auth-library';
import { jwtVerify, SignJWT } from 'jose';
import { env } from '../../config/env.js';
import { HttpError } from '../../shared/http/errors.js';
import { signInWithGoogle } from './auth.service.js';

// Server-side Google sign-in (OAuth 2.0 authorization code flow) for clients that can't run the
// native Google SDK, such as Expo Go. The app opens /start in a browser; Google redirects to
// /callback, which signs the user in and redirects to the app's return URL with a session token.

const CALLBACK_PATH = '/api/auth/google/callback';
const STATE_AUDIENCE = 'google-oauth-state';
const STATE_TTL = '10m';

type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

function getConfig(): GoogleOAuthConfig {
  const { clientId, clientSecret, publicApiUrl } = env.googleOAuth;
  if (!clientId || !clientSecret || !publicApiUrl) {
    throw new HttpError(
      500,
      'Browser Google sign-in is not configured on the server. Set GOOGLE_WEB_CLIENT_ID, GOOGLE_WEB_CLIENT_SECRET and PUBLIC_API_URL.',
    );
  }
  return { clientId, clientSecret, redirectUri: `${publicApiUrl}${CALLBACK_PATH}` };
}

let oauthClient: OAuth2Client | null = null;

function getOAuthClient(config: GoogleOAuthConfig): OAuth2Client {
  oauthClient ??= new OAuth2Client(config);
  return oauthClient;
}

/** Only redirect tokens to app URLs we trust; anything else would leak the session. */
function assertAllowedReturnUrl(returnTo: string): void {
  const isAllowed = env.googleOAuth.returnUrlPrefixes.some((prefix) => returnTo.startsWith(prefix));
  if (!isAllowed) {
    throw HttpError.badRequest('returnTo is not an allowed app URL');
  }
}

// The state parameter carries the return URL through Google, signed so it can't be swapped.
async function createState(returnTo: string): Promise<string> {
  return new SignJWT({ returnTo })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(STATE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(STATE_TTL)
    .sign(env.sessionSecret);
}

async function readState(state: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(state, env.sessionSecret, { audience: STATE_AUDIENCE });
    if (typeof payload.returnTo !== 'string') throw new Error('State has no return URL');
    assertAllowedReturnUrl(payload.returnTo);
    return payload.returnTo;
  } catch {
    throw HttpError.badRequest('Sign-in link expired or is invalid. Please try again.');
  }
}

// Percent-encodes (spaces as %20, not "+") so the app's URL parser decodes values exactly.
function withParams(url: string, params: Record<string, string>): string {
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `${url}${url.includes('?') ? '&' : '?'}${query}`;
}

/** Returns the Google consent page URL for a sign-in that ends at `returnTo`. */
export async function createGoogleAuthorizationUrl(returnTo: string): Promise<string> {
  const config = getConfig();
  assertAllowedReturnUrl(returnTo);

  return getOAuthClient(config).generateAuthUrl({
    scope: ['openid', 'email', 'profile'],
    state: await createState(returnTo),
    prompt: 'select_account',
  });
}

export type GoogleCallbackParams = {
  code?: string;
  state?: string;
  error?: string;
};

/**
 * Completes a sign-in started by `createGoogleAuthorizationUrl` and returns where to send the
 * browser: the app's return URL with either `token` or `error` appended.
 */
export async function completeGoogleAuthorization(params: GoogleCallbackParams): Promise<string> {
  const config = getConfig();
  if (!params.state) {
    throw HttpError.badRequest('Missing state');
  }
  const returnTo = await readState(params.state);

  // From here on, report failures to the app instead of leaving the user on an API error page.
  if (params.error || !params.code) {
    const cancelled = params.error === 'access_denied';
    return withParams(returnTo, { error: cancelled ? 'cancelled' : 'Google sign-in failed.' });
  }

  try {
    const { tokens } = await getOAuthClient(config).getToken(params.code);
    if (!tokens.id_token) throw new Error('Google did not return an ID token');

    const { token } = await signInWithGoogle(tokens.id_token);
    return withParams(returnTo, { token });
  } catch (error) {
    const message = error instanceof HttpError ? error.message : 'Google sign-in failed.';
    if (!(error instanceof HttpError)) console.error('Google code exchange failed', error);
    return withParams(returnTo, { error: message });
  }
}
