import { jwtVerify, SignJWT } from 'jose';
import { env } from '../../config/env.js';

const SESSION_ISSUER = 'tripivo-api';
const SESSION_TTL = '30d';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Issues a signed session token (HS256 JWT) whose subject is the user's ID. */
export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(SESSION_ISSUER)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(env.sessionSecret);
}

/** Returns the user ID the session token was issued for. Throws if it is invalid or expired. */
export async function readSessionToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, env.sessionSecret, { issuer: SESSION_ISSUER });
  // Tokens issued before users were stored in PostgreSQL carry a Google ID instead of a UUID.
  if (!payload.sub || !UUID_PATTERN.test(payload.sub)) {
    throw new Error('Malformed session token');
  }
  return payload.sub;
}
