import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ApiError,
  devLogin,
  getMyProfile,
  logOut,
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
// (Email sign-up sends the name to the API directly; the draft mainly carries onboarding picks.)

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
  /**
   * Reloads the profile from the API. Calls made while one is in flight share it, and with
   * `maxAgeMs` nothing is fetched if the profile was loaded more recently than that.
   */
  refreshProfile: (options?: { maxAgeMs?: number }) => Promise<void>;
};

/**
 * Development shortcut: with EXPO_PUBLIC_BYPASS_LOGIN=true, launching without a stored session
 * signs in as the API's demo account (POST /auth/dev-login, disabled in production), skipping
 * login and profile setup. Inlined at bundle time; restart Expo after changing it.
 */
export const BYPASS_LOGIN = process.env.EXPO_PUBLIC_BYPASS_LOGIN === 'true';

// The last profile seen, so the app can start offline without sending the user back to setup.
const PROFILE_CACHE_KEY = 'tripivo.profile';
// Set while the stored session came from the login bypass, so turning the flag off discards it
// instead of leaving the device signed in to the demo account.
const DEV_SESSION_KEY = 'tripivo.devSession';
/** The API's demo account (DEMO_PHONE in backend/src/modules/auth/auth.service.ts). */
const DEMO_PHONE = '+910000000000';

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

  const loadedAt = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);

  // Functions in the context must keep their identity: screens use them in effect dependencies,
  // and a new function per profile update made those effects refetch in a loop.
  const applyProfile = useCallback((next: MyProfile) => {
    loadedAt.current = Date.now();
    // Keep the same object when nothing changed, so consumers don't re-render for nothing.
    setProfile((current) => (current && JSON.stringify(current) === JSON.stringify(next) ? current : next));
    cacheProfile(next);
  }, []);

  const refreshProfile = useCallback(
    (options: { maxAgeMs?: number } = {}) => {
      if (options.maxAgeMs !== undefined && Date.now() - loadedAt.current < options.maxAgeMs) {
        return Promise.resolve();
      }
      inFlight.current ??= getMyProfile()
        .then(applyProfile)
        .finally(() => {
          inFlight.current = null;
        });
      return inFlight.current;
    },
    [applyProfile],
  );

  const updateProfile = useCallback(
    async (changes: ProfileChanges) => {
      const updated = await updateMyProfile(changes);
      applyProfile(updated);
      return updated;
    },
    [applyProfile],
  );

  const setDraft = useCallback((changes: ProfileDraft) => {
    setDraftState((current) => ({ ...current, ...changes }));
  }, []);

  const signOut = useCallback(async () => {
    // End the session on the server too, so the token stops working; best effort offline.
    await logOut().catch(() => {});
    setAuthToken(null);
    setStatus('signedOut');
    setSession(null);
    setProfile(null);
    await Promise.allSettled([
      clearSession(),
      signOutOfGoogle(),
      removeItem(PROFILE_CACHE_KEY),
      removeItem(DEV_SESSION_KEY),
    ]);
  }, []);

  const signIn = useCallback(
    async (next: Session) => {
      setAuthToken(next.token);
      // A real sign-in replaces any demo session from the login bypass.
      await Promise.all([saveSession(next), removeItem(DEV_SESSION_KEY)]);
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
        if (BYPASS_LOGIN) {
          await signIn(await devLogin());
          await setItem(DEV_SESSION_KEY, 'true');
        } else {
          setStatus('signedOut');
        }
        return;
      }

      // Signed in by the bypass, which has since been turned off: start signed out. Sessions from
      // before the marker existed are recognised by the demo account's phone number.
      const isDemoSession = (await getItem(DEV_SESSION_KEY)) === 'true' || stored.user.phone === DEMO_PHONE;
      if (!BYPASS_LOGIN && isDemoSession) {
        setAuthToken(stored.token);
        await signOut();
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
      setDraft,
      signIn,
      signOut,
      updateProfile,
      refreshProfile,
    }),
    [status, session, profile, draft, setDraft, signIn, signOut, updateProfile, refreshProfile],
  );

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>.');
  return auth;
}

const EMPTY_PROFILE: MyProfile = {
  cityPlaceId: null,
  homeLocation: null,
  emailVerified: false,
  hasPassword: false,
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
