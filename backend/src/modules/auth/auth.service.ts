import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { env } from '../../config/env.js';
import { HttpError } from '../../shared/http/errors.js';
import { findPublicUserById, upsertGoogleUser, type PublicUser } from '../users/users.repository.js';
import { createSessionToken } from './session.js';

const googleClient = new OAuth2Client();

export type AuthResult = {
  token: string;
  user: PublicUser;
};

async function verifyGoogleIdToken(idToken: string): Promise<TokenPayload | undefined> {
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: [...env.googleClientIds] });
    return ticket.getPayload();
  } catch {
    throw HttpError.unauthorized('Invalid Google credential');
  }
}

/** Verifies a Google ID token, creates or refreshes the user, and starts a session. */
export async function signInWithGoogle(idToken: string): Promise<AuthResult> {
  if (env.googleClientIds.length === 0) {
    throw new HttpError(500, 'Google sign-in is not configured on the server');
  }

  const payload = await verifyGoogleIdToken(idToken);
  if (!payload?.email || !payload.email_verified) {
    throw HttpError.unauthorized('Your Google account email is not verified');
  }

  const user = await upsertGoogleUser({
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  });

  return { token: await createSessionToken(user.id), user };
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await findPublicUserById(userId);
  if (!user) {
    throw HttpError.unauthorized('Account no longer exists');
  }
  return user;
}
