import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { InterestKey } from '../data/mock';
import { getCurrentUser, type Session } from './api';
import { signOutOfGoogle } from './googleSignIn';
import { clearSession, loadSession, saveSession } from './session';
import { getItem, removeItem, setItem } from './storage';

// Who is signed in, and their traveler profile. The root layout uses `status` and
// `profile.completed` to decide which screens are reachable: the welcome/login flow, the
// profile setup flow, or the app itself.

export type Profile = {
  name: string;
  username: string;
  photo: string | null;
  age: string;
  gender: string;
  city: string;
  profession: string;
  bio: string;
  email: string;
  travelStyles: InterestKey[];
  interests: InterestKey[];
  /** Set once the user finishes the profile setup screens. */
  completed: boolean;
  /** The Tripivo user this profile belongs to (null when signed in without an account). */
  userId: string | null;
};

export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

/** Details collected before an account exists (onboarding, sign-up form), applied on sign-in. */
export type ProfileDraft = Partial<Pick<Profile, 'name' | 'email' | 'travelStyles'>>;

type Auth = {
  status: AuthStatus;
  /** Null for providers that aren't wired to the backend yet (Apple). */
  session: Session | null;
  profile: Profile;
  draft: ProfileDraft;
  setDraft: (draft: ProfileDraft) => void;
  signIn: (session: Session | null) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (changes: Partial<Profile>) => void;
};

const PROFILE_KEY = 'tripivo.profile';

const emptyProfile: Profile = {
  name: '',
  username: '',
  photo: null,
  age: '',
  gender: '',
  city: '',
  profession: '',
  bio: '',
  email: '',
  travelStyles: [],
  interests: [],
  completed: false,
  userId: null,
};

const AuthContext = createContext<Auth | null>(null);

async function loadProfile(): Promise<Profile | null> {
  const stored = await getItem(PROFILE_KEY);
  if (!stored) return null;
  try {
    return { ...emptyProfile, ...(JSON.parse(stored) as Partial<Profile>) };
  } catch {
    return null;
  }
}

function usernameFrom(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [draft, setDraft] = useState<ProfileDraft>({});

  useEffect(() => {
    let isActive = true;

    async function restoreSession() {
      const stored = await loadSession().catch(() => null);
      if (!stored) return null;

      try {
        const user = await getCurrentUser(stored.token);
        if (!user) {
          await clearSession();
          return null;
        }
        return { ...stored, user };
      } catch {
        // API unreachable: trust the stored session rather than signing the user out offline.
        return stored;
      }
    }

    Promise.all([restoreSession(), loadProfile()]).then(([restored, storedProfile]) => {
      if (!isActive) return;
      if (restored) {
        setSession(restored);
        if (storedProfile?.userId === restored.user.id) setProfile(storedProfile);
        setStatus('signedIn');
      } else {
        setStatus('signedOut');
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  const auth = useMemo<Auth>(() => {
    function persist(next: Profile) {
      void setItem(PROFILE_KEY, JSON.stringify(next));
    }

    return {
      status,
      session,
      profile,
      draft,
      setDraft: (changes) => setDraft((current) => ({ ...current, ...changes })),

      async signIn(nextSession) {
        if (nextSession) await saveSession(nextSession);

        const userId = nextSession?.user.id ?? null;
        const storedProfile = await loadProfile();
        if (storedProfile && storedProfile.userId === userId) {
          setProfile(storedProfile);
        } else {
          const user = nextSession?.user;
          const name = draft.name ?? user?.name ?? '';
          const fresh: Profile = {
            ...emptyProfile,
            userId,
            name,
            username: usernameFrom(name),
            email: draft.email ?? user?.email ?? '',
            photo: user?.picture ?? null,
            travelStyles: draft.travelStyles ?? [],
            interests: draft.travelStyles ?? [],
          };
          setProfile(fresh);
          persist(fresh);
        }

        setDraft({});
        setSession(nextSession);
        setStatus('signedIn');
      },

      async signOut() {
        setStatus('signedOut');
        setSession(null);
        setProfile(emptyProfile);
        await Promise.allSettled([clearSession(), signOutOfGoogle(), removeItem(PROFILE_KEY)]);
      },

      updateProfile(changes) {
        setProfile((current) => {
          const next = { ...current, ...changes };
          if (changes.name !== undefined && !current.username) next.username = usernameFrom(changes.name);
          persist(next);
          return next;
        });
      },
    };
  }, [status, session, profile, draft]);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>.');
  return auth;
}
