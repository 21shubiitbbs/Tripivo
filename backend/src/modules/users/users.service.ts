import {
  BUDGET_LEVELS,
  INDUSTRIES,
  isOneOf,
  LOOKING_FOR,
  type BudgetLevel,
  type Industry,
  type LookingFor,
  type ProfilePrompt,
} from '../../db/schema/index.js';
import { HttpError } from '../../shared/http/errors.js';
import {
  optionalInt,
  optionalString,
  stringList,
} from '../../shared/http/validate.js';
import {
  block,
  countBucketList,
  deleteBucketListItem,
  findProfile,
  insertBucketListItem,
  listBucketList,
  follow,
  isUsernameTaken,
  listBlocked,
  listContacts,
  relationship,
  unblock,
  unfollow,
  updateUser,
  upsertTravelProfile,
  type BucketListItem,
  type ProfileRecord,
} from './users.repository.js';
import { withTransaction } from '../../db/transaction.js';
import { getCompatibility, type Compatibility } from '../matching/matching.service.js';
import { getPlace } from '../places/places.service.js';
import { getUserTrips, type TripSummary } from '../trips/trips.service.js';
import {
  MAX_BUCKET_LIST,
  MAX_PROMPT_ANSWER,
  MAX_PROMPTS,
  PROFILE_PROMPTS,
  type Vibe,
} from './profile-options.js';

export type Profile = {
  id: string;
  name: string | null;
  username: string | null;
  picture: string | null;
  verified: boolean;
  bio: string | null;
  age: number | null;
  gender: string | null;
  city: string | null;
  profession: string | null;
  /** The field they work in, for matching people by profession. */
  industry: Industry | null;
  travelStyles: string[];
  interests: string[];
  languages: string[];
  lookingFor: LookingFor[];
  budget: BudgetLevel | null;
  vibe: Vibe;
  prompts: ProfilePrompt[];
  bucketList: BucketListItem[];
  /** Earned from trips and the profile, e.g. `explorer`, `super_host`; labels live in the app. */
  badges: string[];
  completed: boolean;
  stats: { trips: number; rating: number | null; followers: number; following: number };
};

/** The signed-in user's own profile also carries their contact details. */
export type MyProfile = Profile & {
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  /** False for Google and phone accounts that haven't set a password. */
  hasPassword: boolean;
  /** The home city's place and coordinates, when it was picked from place search. */
  cityPlaceId: string | null;
  homeLocation: { latitude: number; longitude: number } | null;
  /** How much of the profile is filled in, and the keys of the parts that aren't. */
  completeness: { percent: number; missing: string[] };
};

export type PublicProfile = Profile & {
  isMe: boolean;
  isFollowing: boolean;
  isBlocked: boolean;
  /** How well the viewer and this traveler would get on; null on your own profile or when blocked. */
  compatibility: Compatibility | null;
  /** Trips they host or joined, newest first. Empty when blocked either way. */
  trips: TripSummary[];
};

function badgesFor(record: ProfileRecord): string[] {
  const rating = record.rating === null ? null : Number(record.rating);
  const badges: [string, boolean][] = [
    ['verified', record.verified],
    ['first_trip', record.completed_count >= 1],
    ['explorer', record.place_count >= 5],
    ['globetrotter', record.country_count >= 3],
    ['host', record.hosted_count >= 1 && record.hosted_count < 3],
    ['super_host', record.hosted_count >= 3 && rating !== null && rating >= 4.5],
    ['trusted_host', record.hosted_count >= 3 && (rating === null || rating < 4.5)],
    ['social', record.follower_count >= 10],
    ['dreamer', record.bucket_list.length >= 5],
    ['polyglot', record.languages.length >= 3],
  ];
  return badges.filter(([, earned]) => earned).map(([key]) => key);
}

/** Each part counts once; the app turns the missing keys into "Add a bio"-style nudges. */
function completenessOf(record: ProfileRecord): MyProfile['completeness'] {
  const parts: [string, boolean][] = [
    ['picture', Boolean(record.picture)],
    ['bio', Boolean(record.bio)],
    ['city', Boolean(record.city)],
    ['profession', Boolean(record.profession && record.industry)],
    ['interests', record.interests.length >= 3],
    ['languages', record.languages.length > 0],
    ['vibe', [record.vibe_pace, record.vibe_planning, record.vibe_social, record.vibe_rhythm].every((v) => v !== null)],
    ['prompts', record.prompts.length > 0],
    ['bucketList', record.bucket_list.length > 0],
  ];
  const missing = parts.filter(([, done]) => !done).map(([key]) => key);
  return { percent: Math.round(((parts.length - missing.length) / parts.length) * 100), missing };
}

function toProfile(record: ProfileRecord): Profile {
  return {
    id: record.id,
    name: record.name,
    username: record.username,
    picture: record.picture,
    verified: record.verified,
    bio: record.bio,
    age: record.age,
    gender: record.gender,
    city: record.city,
    profession: record.profession,
    industry: record.industry,
    travelStyles: record.travel_styles,
    interests: record.interests,
    languages: record.languages,
    lookingFor: record.looking_for,
    budget: isOneOf(BUDGET_LEVELS, record.budget) ? record.budget : null,
    vibe: {
      pace: record.vibe_pace,
      planning: record.vibe_planning,
      social: record.vibe_social,
      rhythm: record.vibe_rhythm,
    },
    prompts: record.prompts,
    bucketList: record.bucket_list,
    badges: badgesFor(record),
    completed: record.completed_at !== null,
    stats: {
      trips: record.trip_count,
      rating: record.rating === null ? null : Number(record.rating),
      followers: record.follower_count,
      following: record.following_count,
    },
  };
}

export async function getMyProfile(userId: string): Promise<MyProfile> {
  const record = await findProfile(userId);
  if (!record) throw HttpError.unauthorized('Account no longer exists');
  return {
    ...toProfile(record),
    email: record.email,
    emailVerified: record.email_verified,
    phone: record.phone,
    hasPassword: record.has_password,
    cityPlaceId: record.city_place_id,
    homeLocation:
      record.home_latitude !== null && record.home_longitude !== null
        ? { latitude: record.home_latitude, longitude: record.home_longitude }
        : null,
    completeness: completenessOf(record),
  };
}

export async function getPublicProfile(viewerId: string, userId: string): Promise<PublicProfile> {
  const record = await findProfile(userId);
  if (!record) throw HttpError.notFound('User not found');
  const isMe = viewerId === userId;
  const [{ is_following, is_blocked }, compatibility, trips] = await Promise.all([
    relationship(viewerId, userId),
    isMe ? null : getCompatibility(viewerId, userId),
    getUserTrips(viewerId, userId),
  ]);
  return {
    ...toProfile(record),
    isMe,
    isFollowing: is_following,
    isBlocked: is_blocked,
    compatibility: is_blocked ? null : compatibility,
    trips,
  };
}

function optionalEnum<const T extends readonly string[]>(values: T, value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (!isOneOf(values, value)) throw HttpError.badRequest(`${field} must be one of ${values.join(', ')}`, { field });
  return value;
}

function enumList<const T extends readonly string[]>(values: T, value: unknown, field: string) {
  const list = stringList(value, field, values.length);
  if (list?.some((item) => !isOneOf(values, item))) {
    throw HttpError.badRequest(`${field} must only contain ${values.join(', ')}`, { field });
  }
  return list as T[number][] | undefined;
}

/** `[{ prompt, answer }]`: up to three different prompts; empty answers are dropped. */
function parsePrompts(value: unknown): ProfilePrompt[] | undefined {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (!Array.isArray(value)) throw HttpError.badRequest('prompts must be a list', { field: 'prompts' });
  const prompts: ProfilePrompt[] = [];
  for (const item of value as unknown[]) {
    const { prompt, answer } = (item ?? {}) as Record<string, unknown>;
    if (!isOneOf(PROFILE_PROMPTS, prompt)) throw HttpError.badRequest('Unknown prompt', { field: 'prompts' });
    const text = optionalString(answer, 'answer', MAX_PROMPT_ANSWER);
    if (!text) continue;
    if (prompts.some((existing) => existing.prompt === prompt)) {
      throw HttpError.badRequest('Each prompt can only be answered once', { field: 'prompts' });
    }
    prompts.push({ prompt, answer: text });
  }
  if (prompts.length > MAX_PROMPTS) {
    throw HttpError.badRequest(`Pick up to ${MAX_PROMPTS} prompts`, { field: 'prompts' });
  }
  return prompts;
}

/** `vibe: { pace?, planning?, social?, rhythm? }`, each 1–5 or null. */
function parseVibe(value: unknown) {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object') throw HttpError.badRequest('vibe must be an object', { field: 'vibe' });
  const vibe = value as Record<string, unknown>;
  return {
    vibe_pace: optionalInt(vibe.pace, 'vibe.pace', 1, 5),
    vibe_planning: optionalInt(vibe.planning, 'vibe.planning', 1, 5),
    vibe_social: optionalInt(vibe.social, 'vibe.social', 1, 5),
    vibe_rhythm: optionalInt(vibe.rhythm, 'vibe.rhythm', 1, 5),
  };
}

const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Applies a partial profile update from the client. Unknown fields are ignored. */
export async function updateMyProfile(userId: string, body: Record<string, unknown>): Promise<MyProfile> {
  const username = optionalString(body.username, 'username', 30)?.replace(/^@/, '');
  if (username && !USERNAME_PATTERN.test(username)) {
    throw HttpError.badRequest('Usernames are 3–30 letters, numbers, dots or underscores');
  }
  if (username && (await isUsernameTaken(username, userId))) {
    throw HttpError.badRequest('That username is taken', { field: 'username' });
  }

  const email = optionalString(body.email, 'email', 200)?.toLowerCase();
  if (email && !EMAIL_PATTERN.test(email)) throw HttpError.badRequest('Enter a valid email address', { field: 'email' });

  const completed = body.completed === true;

  // A city picked from place search: store the place, and use its label unless one was sent.
  let city = optionalString(body.city, 'city', 100);
  let cityPlaceId: string | null | undefined;
  if (body.cityPlaceId === null) cityPlaceId = null;
  else if (typeof body.cityPlaceId === 'string' && body.cityPlaceId) {
    const place = await getPlace(body.cityPlaceId).catch(() => null);
    if (!place) throw HttpError.badRequest('Pick your city from the list', { field: 'city' });
    cityPlaceId = place.id.startsWith('catalog:') ? null : place.id;
    city ??= [place.name, place.country].filter(Boolean).join(', ');
  } else if (city !== undefined) {
    // Typed text without picking a place: keep the text, drop the old link.
    cityPlaceId = null;
  }

  await withTransaction(async (client) => {
    try {
      await updateUser(
        userId,
        {
          name: optionalString(body.name, 'name', 100),
          username,
          picture: optionalString(body.picture, 'picture', 2000),
          email,
        },
        client,
      );
    } catch (error) {
      // users_email_lower_key: the address belongs to another account.
      if ((error as { code?: string }).code === '23505') {
        throw HttpError.badRequest('That email is already used by another account', { field: 'email' });
      }
      throw error;
    }
    await upsertTravelProfile(
      userId,
      {
        bio: optionalString(body.bio, 'bio', 1000),
        age: optionalInt(body.age, 'age', 13, 120),
        gender: optionalString(body.gender, 'gender', 40),
        city,
        city_place_id: cityPlaceId,
        profession: optionalString(body.profession, 'profession', 100),
        industry: optionalEnum(INDUSTRIES, body.industry, 'industry'),
        travel_styles: stringList(body.travelStyles, 'travelStyles'),
        interests: stringList(body.interests, 'interests'),
        languages: stringList(body.languages, 'languages', 10),
        looking_for: enumList(LOOKING_FOR, body.lookingFor, 'lookingFor'),
        budget: optionalEnum(BUDGET_LEVELS, body.budget, 'budget'),
        prompts: parsePrompts(body.prompts),
        ...parseVibe(body.vibe),
        completed,
      },
      client,
    );
  });

  return getMyProfile(userId);
}

function assertNotSelf(viewerId: string, userId: string, action: string) {
  if (viewerId === userId) throw HttpError.badRequest(`You can’t ${action} yourself`);
}

export async function followUser(viewerId: string, userId: string) {
  assertNotSelf(viewerId, userId, 'follow');
  await getPublicProfile(viewerId, userId);
  await follow(viewerId, userId);
}

export async function unfollowUser(viewerId: string, userId: string) {
  await unfollow(viewerId, userId);
}

export async function blockUser(viewerId: string, userId: string) {
  assertNotSelf(viewerId, userId, 'block');
  await getPublicProfile(viewerId, userId);
  await block(viewerId, userId);
}

export async function unblockUser(viewerId: string, userId: string) {
  await unblock(viewerId, userId);
}

/** `{ placeId }` from place search, or `{ name }` typed by hand. Returns the whole list. */
export async function addToBucketList(userId: string, body: Record<string, unknown>) {
  if ((await countBucketList(userId)) >= MAX_BUCKET_LIST) {
    throw HttpError.badRequest(`Your bucket list can hold up to ${MAX_BUCKET_LIST} places`, { code: 'bucket_list_full' });
  }
  if (typeof body.placeId === 'string' && body.placeId) {
    const place = await getPlace(body.placeId).catch(() => null);
    if (!place) throw HttpError.badRequest('Pick a place from the list', { field: 'place' });
    await insertBucketListItem({
      user_id: userId,
      place_id: place.id.startsWith('catalog:') ? null : place.id,
      name: place.name,
      country: place.country,
    });
  } else {
    const name = optionalString(body.name, 'name', 100);
    if (!name) throw HttpError.badRequest('Enter a place', { field: 'place' });
    await insertBucketListItem({ user_id: userId, place_id: null, name, country: null });
  }
  return listBucketList(userId);
}

export async function removeFromBucketList(userId: string, itemId: string) {
  await deleteBucketListItem(userId, itemId);
  return listBucketList(userId);
}

export const getBlockedUsers = listBlocked;
export const getContacts = listContacts;
