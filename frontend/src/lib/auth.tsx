import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ApiError,
  devLogin,
  getMyProfile,
  setAuthToken,
  setUnauthorizedHandler,
  updateMyProfile,
  type MyProfile,
  type ProfileChanges,
  type Session,
} from './api';
import { signOutOfGoogle } from './googleSignIn';
import { clearSession, loadSession, saveSession } from './session';
import { getItem, removeItem, setItem } from './storage';

// Who is signed in, and their traveler profile (from GET /users/me). The root layout uses
// `status` and `profile.completed` to pick the reachable screens: the welcome/login flow, the
// profile setup flow, or the app itself.

export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

/** Details collected before an account exists (onboarding, sign-up form), saved on sign-in. */
export type ProfileDraft = Partial<Pick<ProfileChanges, 'name' | 'email' | 'travelStyles'>>;

type Auth = {
  status: AuthStatus;
  session: Session | null;
  /** Set whenever `status` is 'signedIn'. */
  profile: MyProfile | null;
  draft: ProfileDraft;
  setDraft: (draft: ProfileDraft) => void;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  /** Saves profile changes to the API. Rejects with the API's message on failure. */
  updateProfile: (changes: ProfileChanges) => Promise<MyProfile>;
  refreshProfile: () => Promise<void>;
};

/**
 * Development shortcut: with EXPO_PUBLIC_BYPASS_LOGIN=true, launching without a stored session
 * signs in as the API's demo account (POST /auth/dev-login, disabled in production), skipping
 * login and profile setup. Inlined at bundle time; restart Expo after changing it.
 */
export const BYPASS_LOGIN = process.env.EXPO_PUBLIC_BYPASS_LOGIN === 'true';

// The last profile seen, so the app can start offline without sending the user back to setup.
const PROFILE_CACHE_KEY = 'tripivo.profile';

async function loadCachedProfile(userId: string): Promise<MyProfile | null> {
  try {
    const cached = JSON.parse((await getItem(PROFILE_CACHE_KEY)) ?? 'null') as MyProfile | null;
    return cached?.id === userId ? cached : null;
  } catch {
    return null;
  }
}

function cacheProfile(profile: MyProfile) {
  // Without the bio, the only field that can be long: SecureStore warns above 2 KB.
  void setItem(PROFILE_CACHE_KEY, JSON.stringify({ ...profile, bio: null }));
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [draft, setDraftState] = useState<ProfileDraft>({});
  // signIn reads the draft through a ref so its identity (and the restore effect) stays stable.
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const applyProfile = useCallback((next: MyProfile) => {
    setProfile(next);
    cacheProfile(next);
  }, []);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setStatus('signedOut');
    setSession(null);
    setProfile(null);
    await Promise.allSettled([clearSession(), signOutOfGoogle(), removeItem(PROFILE_CACHE_KEY)]);
  }, []);

  const signIn = useCallback(
    async (next: Session) => {
      setAuthToken(next.token);
      await saveSession(next);
      let loaded = await getMyProfile(next.token);

      // Copy what the user typed before the account existed, without overwriting their profile.
      const pending = draftRef.current;
      const changes: ProfileChanges = {};
      if (pending.name && !loaded.name) changes.name = pending.name;
      if (pending.email && !loaded.email) changes.email = pending.email;
      if (pending.travelStyles?.length && !loaded.travelStyles.length) {
        changes.travelStyles = pending.travelStyles;
        if (!loaded.interests.length) changes.interests = pending.travelStyles;
      }
      if (Object.keys(changes).length) loaded = await updateMyProfile(changes).catch(() => loaded);

      setDraftState({});
      applyProfile(loaded);
      setSession(next);
      setStatus('signedIn');
    },
    [applyProfile],
  );

  // Sign out locally whenever the API says the session is no longer valid.
  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  useEffect(() => {
    let isActive = true;

    async function restore() {
      const stored = await loadSession().catch(() => null);
      if (!stored) {
        if (BYPASS_LOGIN) await signIn(await devLogin());
        else setStatus('signedOut');
        return;
      }

      setAuthToken(stored.token);
      try {
        const loaded = await getMyProfile(stored.token);
        if (!isActive) return;
        applyProfile(loaded);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await signOut();
          return;
        }
        // API unreachable: start with the cached profile rather than signing the user out offline.
        const cached = await loadCachedProfile(stored.user.id);
        if (!isActive) return;
        if (!cached) {
          setStatus('signedOut');
          return;
        }
        setProfile(cached);
      }
      setSession(stored);
      setStatus('signedIn');
    }

    restore().catch(() => isActive && setStatus('signedOut'));
    return () => {
      isActive = false;
    };
  }, [applyProfile, signIn, signOut]);

  const auth = useMemo<Auth>(
    () => ({
      status,
      session,
      profile,
      draft,
      setDraft: (changes) => setDraftState((current) => ({ ...current, ...changes })),
      signIn,
      signOut,
      async updateProfile(changes) {
        const updated = await updateMyProfile(changes);
        applyProfile(updated);
        return updated;
      },
      async refreshProfile() {
        applyProfile(await getMyProfile());
      },
    }),
    [status, session, profile, draft, signIn, signOut, applyProfile],
  );

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>.');
  return auth;
}

const EMPTY_PROFILE: MyProfile = {
  id: '',
  name: null,
  username: null,
  picture: null,
  verified: false,
  bio: null,
  age: null,
  gender: null,
  city: null,
  profession: null,
  travelStyles: [],
  interests: [],
  completed: false,
  stats: { trips: 0, rating: null, followers: 0, following: 0 },
  email: null,
  phone: null,
};

/**
 * The signed-in user's profile, for screens only reachable when signed in. Returns an empty
 * profile for the moment between signing out and those screens unmounting.
 */
export function useProfile(): MyProfile {
  return useAuth().profile ?? EMPTY_PROFILE;
}
