import { HttpError } from '../../shared/http/errors.js';
import {
  optionalInt,
  optionalString,
  stringList,
} from '../../shared/http/validate.js';
import {
  block,
  findProfile,
  follow,
  isUsernameTaken,
  listBlocked,
  listContacts,
  relationship,
  unblock,
  unfollow,
  updateUser,
  upsertTravelProfile,
  type ProfileRecord,
} from './users.repository.js';
import { withTransaction } from '../../db/transaction.js';

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
  travelStyles: string[];
  interests: string[];
  completed: boolean;
  stats: { trips: number; rating: number | null; followers: number; following: number };
};

/** The signed-in user's own profile also carries their contact details. */
export type MyProfile = Profile & { email: string | null; phone: string | null };

export type PublicProfile = Profile & { isMe: boolean; isFollowing: boolean; isBlocked: boolean };

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
    travelStyles: record.travel_styles,
    interests: record.interests,
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
  return { ...toProfile(record), email: record.email, phone: record.phone };
}

export async function getPublicProfile(viewerId: string, userId: string): Promise<PublicProfile> {
  const record = await findProfile(userId);
  if (!record) throw HttpError.notFound('User not found');
  const { is_following, is_blocked } = await relationship(viewerId, userId);
  return { ...toProfile(record), isMe: viewerId === userId, isFollowing: is_following, isBlocked: is_blocked };
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
    throw HttpError.badRequest('That username is taken');
  }

  const email = optionalString(body.email, 'email', 200);
  if (email && !EMAIL_PATTERN.test(email)) throw HttpError.badRequest('Enter a valid email address');

  const completed = body.completed === true;

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
        throw HttpError.badRequest('That email is already used by another account');
      }
      throw error;
    }
    await upsertTravelProfile(
      userId,
      {
        bio: optionalString(body.bio, 'bio', 1000),
        age: optionalInt(body.age, 'age', 13, 120),
        gender: optionalString(body.gender, 'gender', 40),
        city: optionalString(body.city, 'city', 100),
        profession: optionalString(body.profession, 'profession', 100),
        travel_styles: stringList(body.travelStyles, 'travelStyles'),
        interests: stringList(body.interests, 'interests'),
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

export const getBlockedUsers = listBlocked;
export const getContacts = listContacts;
