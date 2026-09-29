export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';

// ---------------------------------------------------------------------------------------------
// Transport

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

/** Called by the auth provider whenever the session changes. */
export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Called when a signed-in request comes back 401 (session expired or account deleted). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Machine-readable reason from the API, e.g. 'email_not_verified'. */
    readonly code?: string,
    /** The request field the error is about, for showing it next to that input. */
    readonly field?: string,
    /** The whole error body, for endpoints that include extra data (e.g. `devCode`). */
    readonly body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The API's message for `field`, if `error` is about that field. */
export function fieldError(error: unknown, field: string): string | undefined {
  return error instanceof ApiError && error.field === field ? error.message : undefined;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Overrides the stored session token (used while signing in). */
  token?: string | null;
  query?: Record<string, string | number | boolean | undefined | null | string[]>;
};

function buildUrl(path: string, query: RequestOptions['query']) {
  const params = Object.entries(query ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && !value.length))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(Array.isArray(value) ? value.join(',') : String(value))}`);
  return `${API_BASE_URL}${path}${params.length ? `?${params.join('&')}` : ''}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = options.token === undefined ? authToken : options.token;
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'Can’t reach Tripivo. Check your connection and try again.');
  }

  if (response.status === 401 && token && options.token === undefined) onUnauthorized?.();
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string; code?: string; field?: string } | null;
    throw new ApiError(
      response.status,
      body?.error ?? `Request failed (${response.status})`,
      body?.code,
      body?.field,
      body ?? undefined,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------------------------
// Health and auth

export type ApiHealth = {
  status: string;
  service: string;
  database: 'ok' | 'unreachable';
  redis?: 'ok' | 'unreachable' | 'disabled';
};

export function getApiHealth() {
  return request<ApiHealth>('/health', { token: null });
}

export type User = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  picture: string | null;
};

export type Session = { token: string; user: User };

/** Exchanges a Google ID token for a Tripivo session. */
export function signInWithGoogle(idToken: string) {
  return request<Session>('/auth/google', { method: 'POST', body: { idToken }, token: null });
}

export type SendPhoneCodeResult = {
  /** The number normalized by the API (E.164), to use when verifying. */
  phone: string;
  resendAfterSeconds: number;
  /** Development only: the code, returned because the API has no SMS provider configured. */
  devCode?: string;
};

/** Texts a one-time sign-in code to `phone` (with country code, e.g. "+91 98765 43210"). */
export function sendPhoneCode(phone: string) {
  return request<SendPhoneCodeResult>('/auth/phone/send-code', { method: 'POST', body: { phone }, token: null });
}

/** Exchanges a phone number and the code texted to it for a Tripivo session. */
export function verifyPhoneCode(phone: string, code: string) {
  return request<Session>('/auth/phone/verify', { method: 'POST', body: { phone, code }, token: null });
}

/** Development only: a session for the API's demo account. */
export function devLogin() {
  return request<Session>('/auth/dev-login', { method: 'POST', token: null });
}

/** `devCode` is only set in development, when the API has no email provider and sends nothing. */
export type PendingVerification = { email: string; resendAfterSeconds: number; devCode?: string };

/** Creates an unverified email account; a 6-digit code is emailed to it. */
export function signUp(details: { name: string; email: string; password: string; acceptTerms: boolean }) {
  return request<PendingVerification>('/auth/signup', { method: 'POST', body: details, token: null });
}

/** Confirms the emailed code and signs the new account in. */
export function verifyEmail(email: string, code: string) {
  return request<Session>('/auth/email/verify', { method: 'POST', body: { email, code }, token: null });
}

export function resendVerificationEmail(email: string) {
  return request<PendingVerification>('/auth/email/resend', { method: 'POST', body: { email }, token: null });
}

/**
 * Signs in with an email (or phone number) and password. Rejects with code
 * 'email_not_verified' when the email still needs its code (a new one has been sent).
 */
export function logIn(identifier: string, password: string) {
  return request<Session>('/auth/login', { method: 'POST', body: { identifier, password }, token: null });
}

/** Emails a reset code if the address has an account (the response is the same either way). */
export function forgotPassword(email: string) {
  return request<PendingVerification>('/auth/password/forgot', { method: 'POST', body: { email }, token: null });
}

/** Sets a new password with the emailed code, signing out other devices, and signs in. */
export function resetPassword(email: string, code: string, password: string) {
  return request<Session>('/auth/password/reset', { method: 'POST', body: { email, code, password }, token: null });
}

/** `currentPassword` is only needed if the account already has a password. Signs out other devices. */
export function changePassword(newPassword: string, currentPassword?: string) {
  return request<void>('/auth/password/change', { method: 'POST', body: { currentPassword, newPassword } });
}

/** Emails a code to verify the address on the signed-in user's profile. */
export function sendOwnVerificationCode() {
  return request<PendingVerification>('/auth/me/email/send-code', { method: 'POST' });
}

export function verifyOwnEmail(code: string) {
  return request<void>('/auth/me/email/verify', { method: 'POST', body: { code } });
}

/**
 * Ends the current session on the server. The token is passed explicitly so a 401 here (session
 * already gone) doesn't trigger the unauthorized handler, which would sign out again.
 */
export function logOut() {
  if (!authToken) return Promise.resolve();
  return request<void>('/auth/logout', { method: 'POST', token: authToken });
}

export type DeviceSession = {
  id: string;
  method: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
};

export async function getSessions() {
  return (await request<{ sessions: DeviceSession[] }>('/auth/sessions')).sessions;
}

export function revokeSession(sessionId: string) {
  return request<void>(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
}

export function revokeOtherSessions() {
  return request<void>('/auth/sessions/revoke-others', { method: 'POST' });
}

/** Returns the signed-in user, or null if the session token is no longer valid. */
export async function getCurrentUser(token: string): Promise<User | null> {
  try {
    return (await request<{ user: User }>('/auth/me', { token })).user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// People

export type UserSummary = {
  id: string;
  name: string | null;
  username: string | null;
  picture: string | null;
  city: string | null;
  age: number | null;
  profession: string | null;
  industry: Industry | null;
  verified: boolean;
};

/** The field someone works in; labels and icons are in `INDUSTRIES` in data/catalog.ts. */
export type Industry =
  | 'tech'
  | 'design'
  | 'business'
  | 'finance'
  | 'marketing'
  | 'healthcare'
  | 'education'
  | 'engineering'
  | 'creative'
  | 'law'
  | 'science'
  | 'hospitality'
  | 'public_service'
  | 'student'
  | 'other';

export type LookingFor = 'travel_buddies' | 'networking' | 'workation' | 'weekend_trips' | 'long_trips';
export type BudgetLevel = 'budget' | 'moderate' | 'luxury';
export type VibeAxis = 'pace' | 'planning' | 'social' | 'rhythm';
/** Travel personality, each axis 1–5 (see `VIBE_AXES` in data/catalog.ts), or null when unset. */
export type Vibe = Record<VibeAxis, number | null>;
export type ProfilePrompt = { prompt: string; answer: string };
export type BucketListItem = { id: string; placeId: string | null; name: string; country: string | null };

/** How well the viewer and another traveler fit, from their profile. */
export type Compatibility = {
  /** 0–100. */
  score: number;
  reasons: string[];
  sharedInterests: string[];
  sharedLanguages: string[];
  sharedBucketList: string[];
  sameIndustry: boolean;
  /** 0–100, or null when either hasn't set their vibe. */
  vibeMatch: number | null;
};

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
  industry: Industry | null;
  travelStyles: string[];
  interests: string[];
  languages: string[];
  lookingFor: LookingFor[];
  budget: BudgetLevel | null;
  vibe: Vibe;
  prompts: ProfilePrompt[];
  bucketList: BucketListItem[];
  /** Badge keys; see `BADGES` in data/catalog.ts. */
  badges: string[];
  completed: boolean;
  stats: { trips: number; rating: number | null; followers: number; following: number };
};

export type MyProfile = Profile & {
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  /** False for Google and phone accounts that haven't set a password. */
  hasPassword: boolean;
  cityPlaceId: string | null;
  /** The home city's coordinates, when it was picked from place search. */
  homeLocation: Coordinates | null;
  /** Missing keys: picture, bio, city, profession, interests, languages, vibe, prompts, bucketList. */
  completeness: { percent: number; missing: string[] };
};
export type PublicProfile = Profile & {
  isMe: boolean;
  isFollowing: boolean;
  isBlocked: boolean;
  /** Null on your own profile, when blocked, or before they finish setup. */
  compatibility: Compatibility | null;
  /** Trips they host or joined, newest first. */
  trips: TripSummary[];
};

export type ProfileChanges = Partial<{
  name: string;
  username: string;
  picture: string | null;
  email: string;
  bio: string;
  age: number | null;
  gender: string;
  city: string;
  /** Picks the city from place search; the API fills in `city` from it. `null` unlinks. */
  cityPlaceId: string | null;
  profession: string;
  industry: Industry | null;
  travelStyles: string[];
  interests: string[];
  languages: string[];
  lookingFor: LookingFor[];
  budget: BudgetLevel | null;
  /** Only the axes sent are changed. */
  vibe: Partial<Vibe>;
  /** Replaces all prompts; up to three. */
  prompts: ProfilePrompt[];
  completed: boolean;
}>;

export async function getMyProfile(token?: string) {
  return (await request<{ profile: MyProfile }>('/users/me', { token })).profile;
}

export async function updateMyProfile(changes: ProfileChanges) {
  return (await request<{ profile: MyProfile }>('/users/me', { method: 'PATCH', body: changes })).profile;
}

export async function getUser(userId: string) {
  return (await request<{ profile: PublicProfile }>(`/users/${userId}`)).profile;
}

/** A place picked from place search, or typed text. Returns the whole list. */
export async function addToBucketList(place: { placeId: string } | { name: string }) {
  return (await request<{ bucketList: BucketListItem[] }>('/users/me/bucket-list', { method: 'POST', body: place }))
    .bucketList;
}

export async function removeFromBucketList(itemId: string) {
  return (await request<{ bucketList: BucketListItem[] }>(`/users/me/bucket-list/${itemId}`, { method: 'DELETE' }))
    .bucketList;
}

export function setFollowing(userId: string, following: boolean) {
  return request<void>(`/users/${userId}/follow`, { method: following ? 'POST' : 'DELETE' });
}

export function setBlocked(userId: string, blocked: boolean) {
  return request<void>(`/users/${userId}/block`, { method: blocked ? 'POST' : 'DELETE' });
}

export async function getBlockedUsers() {
  return (await request<{ users: UserSummary[] }>('/users/me/blocked')).users;
}

/** People the user shares a trip or chat with. */
export async function getContacts() {
  return (await request<{ users: UserSummary[] }>('/users/me/contacts')).users;
}

/** Uploads a base64-encoded image and returns its public URL. */
export async function uploadImage(data: string, contentType: string) {
  return (await request<{ url: string }>('/uploads', { method: 'POST', body: { data, contentType } })).url;
}

// ---------------------------------------------------------------------------------------------
// Destinations and trips

/** A real place from the API's geocoding provider (OpenStreetMap / Google). */
export type Place = {
  id: string;
  name: string;
  /** Region and country, e.g. "Himachal Pradesh, India". */
  subtitle: string | null;
  country: string | null;
  countryCode: string | null;
  /** city, town, village, region, country, island, beach, nature, attraction, area … */
  kind: string;
  latitude: number | null;
  longitude: number | null;
  /** Only filled in by `getPlace` (looked up on first request). */
  image: string | null;
};

export type PlaceScope = 'destination' | 'city';
export type Coordinates = { latitude: number; longitude: number };

/** Place suggestions for a partial name; `near` ranks nearby places first. */
export async function autocompletePlaces(query: string, scope: PlaceScope = 'destination', near?: Coordinates | null) {
  return (
    await request<{ places: Place[] }>('/places/autocomplete', {
      query: { q: query, scope, lat: near?.latitude, lng: near?.longitude },
    })
  ).places;
}

/** A place with coordinates and a photo. */
export async function getPlace(placeId: string) {
  return (await request<{ place: Place }>(`/places/${encodeURIComponent(placeId)}`)).place;
}

/** A destination ranked by real trip activity. `placeId` is null for trips created without one. */
export type RankedPlace = {
  id: string;
  placeId: string | null;
  name: string;
  subtitle: string | null;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
  tripCount: number;
  travelerCount: number;
};

/** Destinations with the most upcoming trips. */
export async function getPopularPlaces(limit = 10) {
  return (await request<{ places: RankedPlace[] }>('/places/popular', { query: { limit } })).places;
}

/** Destinations with the most activity in the last two weeks. */
export async function getTrendingPlaces(limit = 6) {
  return (await request<{ places: RankedPlace[] }>('/places/trending', { query: { limit } })).places;
}

export type Membership = 'host' | 'member' | 'pending' | null;
export type TripPhase = 'upcoming' | 'active' | 'completed';
export type JoinMethod = 'open' | 'approval';

export type TripSummary = {
  id: string;
  title: string;
  destination: string;
  placeId: string | null;
  country: string | null;
  coverImage: string | null;
  startDate: string | null;
  endDate: string | null;
  nights: number | null;
  maxMembers: number;
  memberCount: number;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  activities: string[];
  joinMethod: JoinMethod;
  status: string;
  phase: TripPhase;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  rating: number | null;
  reviewCount: number;
  isSaved: boolean;
  membership: Membership;
  host: UserSummary;
};

export type ItineraryActivity = { time?: string; title: string; location?: string; notes?: string; image?: string };
export type ItineraryDay = { dayNumber: number; date: string | null; title: string | null; activities: ItineraryActivity[] };
export type Review = { id: string; rating: number; comment: string | null; createdAt: string; author: UserSummary };
export type Traveler = UserSummary & { role: 'admin' | 'member' };

export type TripDetail = TripSummary & {
  description: string | null;
  audience: string | null;
  itinerary: ItineraryDay[];
  travelers: Traveler[];
  /** What the group looks like: the fields people work in, and how many share the viewer's. */
  crowd: { industries: { industry: Industry; count: number }[]; sameIndustry: number; averageAge: number | null };
  reviews: Review[];
  /** Number of reviews with 5, 4, 3, 2 and 1 stars. */
  ratingDistribution: number[];
  chatRoomId: string | null;
  canReview: boolean;
  pendingRequestCount: number;
  /** The host's pending request to delete the trip; only shown to people on the trip. */
  deletionRequest: TripDeletionRequest | null;
};

export type TripDeletionRequest = {
  id: string;
  reason: string | null;
  requestedAt: string;
  approvals: number;
  /** Travelers (other than the host) who all have to approve. */
  required: number;
  myVote: 'approved' | 'rejected' | null;
};

export type TripCategory = 'trekking' | 'beaches' | 'nightlife' | 'budget' | 'weekend';
export type GroupSizeKey = '2-4' | '5-8' | '9-12' | '12+';
export type BudgetKey = 'under5k' | '5k-10k' | '10k-20k' | '20k+';

export type TripQuery = {
  q?: string;
  /** Trips going to (or within ~60 km of) this place. */
  placeId?: string;
  category?: TripCategory;
  activities?: string[];
  groupSize?: GroupSizeKey | null;
  budget?: BudgetKey | null;
  from?: string;
  to?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  saved?: boolean;
  limit?: number;
};

export async function searchTrips(query: TripQuery = {}) {
  return (await request<{ trips: TripSummary[] }>('/trips', { query })).trips;
}

export async function getMyTrips() {
  return (await request<{ trips: TripSummary[] }>('/trips/mine')).trips;
}

export async function getTrip(tripId: string) {
  return (await request<{ trip: TripDetail }>(`/trips/${tripId}`)).trip;
}

export type NewTrip = {
  title: string;
  /** From place search; preferred over `destination`, which is only a name. */
  placeId?: string;
  destination?: string;
  startDate: string;
  endDate: string;
  budget: BudgetKey;
  maxMembers: number;
  activities: string[];
  joinMethod: JoinMethod;
  description?: string;
  audience?: string;
  coverImage?: string;
};

export async function createTrip(trip: NewTrip) {
  return (await request<{ trip: TripDetail }>('/trips', { method: 'POST', body: trip })).trip;
}

export async function updateItinerary(tripId: string, days: Pick<ItineraryDay, 'title' | 'activities'>[]) {
  return (await request<{ itinerary: ItineraryDay[] }>(`/trips/${tripId}/itinerary`, { method: 'PUT', body: { days } }))
    .itinerary;
}

export function setTripSaved(tripId: string, saved: boolean) {
  return request<void>(`/trips/${tripId}/save`, { method: saved ? 'POST' : 'DELETE' });
}

export function joinTrip(tripId: string, method: JoinMethod, message?: string) {
  return request<{ membership: 'member' | 'pending' }>(`/trips/${tripId}/join`, {
    method: 'POST',
    body: { method, message },
  });
}

/** Leaves the trip, or withdraws a pending request. */
export function leaveTrip(tripId: string) {
  return request<void>(`/trips/${tripId}/membership`, { method: 'DELETE' });
}

/**
 * Host: deletes the trip when nobody else has joined, otherwise asks every traveler to approve.
 * `deleted` says which happened.
 */
export function deleteTrip(tripId: string, reason?: string) {
  return request<{ deleted: boolean; deletionRequest: TripDeletionRequest | null }>(`/trips/${tripId}`, {
    method: 'DELETE',
    body: { reason },
  });
}

/** Traveler: approve or decline the host's request to delete the trip. */
export function voteOnTripDeletion(tripId: string, decision: 'approve' | 'reject') {
  return request<{ deleted: boolean }>(`/trips/${tripId}/deletion/${decision}`, { method: 'POST' });
}

/** Host: withdraw a pending deletion request. */
export function cancelTripDeletion(tripId: string) {
  return request<void>(`/trips/${tripId}/deletion`, { method: 'DELETE' });
}

export type JoinRequest = { id: string; message: string | null; createdAt: string; user: UserSummary };

export async function getJoinRequests(tripId: string) {
  return (await request<{ requests: JoinRequest[] }>(`/trips/${tripId}/requests`)).requests;
}

export function decideJoinRequest(tripId: string, requestId: string, decision: 'accept' | 'reject') {
  return request<void>(`/trips/${tripId}/requests/${requestId}/${decision}`, { method: 'POST' });
}

export async function addReview(tripId: string, rating: number, comment: string) {
  return (await request<{ reviews: Review[] }>(`/trips/${tripId}/reviews`, { method: 'POST', body: { rating, comment } }))
    .reviews;
}

// ---------------------------------------------------------------------------------------------
// Chats

export type ChatSummary = {
  id: string;
  kind: 'group' | 'direct';
  name: string;
  avatar: string | null;
  memberCount: number;
  tripId: string | null;
  otherUser: UserSummary | null;
  lastMessage: {
    body: string | null;
    type: 'text' | 'image' | 'system' | 'poll';
    senderId: string | null;
    senderName: string | null;
    createdAt: string;
  } | null;
  unread: number;
};

export type Poll = {
  id: string;
  question: string;
  options: { id: string; label: string; votes: number }[];
  myVoteOptionId: string | null;
};

export type ChatMessage = {
  id: string;
  type: 'text' | 'image' | 'system' | 'poll';
  body: string | null;
  createdAt: string;
  sender: UserSummary | null;
  poll: Poll | null;
};

export async function getChats() {
  return (await request<{ chats: ChatSummary[] }>('/chats')).chats;
}

/** The chat and its latest messages; also marks it read. */
export function getChat(roomId: string) {
  return request<{ chat: ChatSummary; messages: ChatMessage[] }>(`/chats/${roomId}`);
}

export async function startDirectChat(userId: string) {
  return (await request<{ chat: ChatSummary }>('/chats/direct', { method: 'POST', body: { userId } })).chat;
}

export async function sendChatMessage(roomId: string, body: string) {
  return (await request<{ messages: ChatMessage[] }>(`/chats/${roomId}/messages`, { method: 'POST', body: { body } }))
    .messages;
}

export async function createPoll(roomId: string, question: string, options: string[]) {
  return (await request<{ messages: ChatMessage[] }>(`/chats/${roomId}/polls`, { method: 'POST', body: { question, options } }))
    .messages;
}

export async function votePoll(roomId: string, pollId: string, optionId: string) {
  return (
    await request<{ messages: ChatMessage[] }>(`/chats/${roomId}/polls/${pollId}/vote`, {
      method: 'POST',
      body: { optionId },
    })
  ).messages;
}

// ---------------------------------------------------------------------------------------------
// Notifications and safety

export type NotificationKind = 'trips' | 'messages' | 'requests';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  body: string;
  createdAt: string;
  read: boolean;
  tripId: string | null;
  roomId: string | null;
  actor: UserSummary | null;
};

export function getNotifications(kind?: NotificationKind) {
  return request<{ notifications: AppNotification[]; unread: number }>('/notifications', { query: { kind } });
}

export function markNotificationsRead() {
  return request<void>('/notifications/read-all', { method: 'POST' });
}

export type PushPlatform = 'ios' | 'android' | 'web';

/** Sends this device push notifications for the current session (they stop when it ends). */
export function registerPushToken(token: string, platform: PushPlatform) {
  return request<void>('/notifications/push-tokens', { method: 'POST', body: { token, platform } });
}

export function unregisterPushToken(token: string) {
  return request<void>('/notifications/push-tokens', { method: 'DELETE', body: { token } });
}

export type ReportTarget = 'user' | 'trip' | 'message' | 'other';

export function sendReport(targetType: ReportTarget, details: string, targetId?: string) {
  return request<{ report: { id: string } }>('/reports', { method: 'POST', body: { targetType, targetId, details } });
}

// ---------------------------------------------------------------------------------------------
// Shared expenses. Amounts are in minor units (paise): 12345 = ₹123.45.

export type ExpenseCategory = 'transport' | 'accommodation' | 'food' | 'activities' | 'shopping' | 'other';

export type Expense = {
  id: string;
  title: string;
  category: ExpenseCategory;
  amountMinor: number;
  currency: string;
  splitType: 'equal' | 'custom';
  spentOn: string | null;
  createdAt: string;
  createdBy: string | null;
  paidBy: UserSummary;
  splits: { userId: string; amountMinor: number }[];
  canDelete: boolean;
};

export type Settlement = {
  id: string;
  fromUserId: string;
  toUserId: string;
  amountMinor: number;
  currency: string;
  createdBy: string | null;
  createdAt: string;
  canDelete: boolean;
};

export type ExpenseSummary = {
  currency: string;
  totalMinor: number;
  myShareMinor: number;
  /** Positive: the group owes you. Negative: you owe the group. */
  myNetMinor: number;
  /** Current members (`active`) plus anyone who left but still appears in the money. */
  participants: (UserSummary & { active: boolean })[];
  expenses: Expense[];
  balances: { userId: string; paidMinor: number; shareMinor: number; netMinor: number }[];
  suggestedSettlements: { fromUserId: string; toUserId: string; amountMinor: number }[];
  settlements: Settlement[];
};

export type NewExpense = {
  title: string;
  /** In major units, e.g. 1250.5. */
  amount: number;
  category?: ExpenseCategory;
  paidBy?: string;
  spentOn?: string;
} & (
  | { splitType?: 'equal'; participants?: string[] }
  | { splitType: 'custom'; splits: { userId: string; amount: number }[] }
);

export async function getExpenses(tripId: string) {
  return (await request<{ summary: ExpenseSummary }>(`/trips/${tripId}/expenses`)).summary;
}

export async function addExpense(tripId: string, expense: NewExpense) {
  return (await request<{ summary: ExpenseSummary }>(`/trips/${tripId}/expenses`, { method: 'POST', body: expense }))
    .summary;
}

export async function deleteExpense(tripId: string, expenseId: string) {
  return (await request<{ summary: ExpenseSummary }>(`/trips/${tripId}/expenses/${expenseId}`, { method: 'DELETE' }))
    .summary;
}

/** Records a payment made outside the app (cash, UPI). `amount` is in major units. */
export async function recordSettlement(tripId: string, payment: { fromUserId: string; toUserId: string; amount: number }) {
  return (
    await request<{ summary: ExpenseSummary }>(`/trips/${tripId}/expenses/settlements`, { method: 'POST', body: payment })
  ).summary;
}

export async function deleteSettlement(tripId: string, settlementId: string) {
  return (
    await request<{ summary: ExpenseSummary }>(`/trips/${tripId}/expenses/settlements/${settlementId}`, {
      method: 'DELETE',
    })
  ).summary;
}

// ---------------------------------------------------------------------------------------------
// Matching

export type TravelerMatch = UserSummary & {
  /** 0–100. */
  score: number;
  /** Why they're suggested, e.g. "3 shared interests", "Also from Pune". */
  reasons: string[];
  sharedInterests: string[];
  isFollowing: boolean;
};

export type TripRecommendation = TripSummary & { score: number; reasons: string[] };

/** What suggested travelers must share with you; `profession` fails with code `industry_required` until you set one. */
export type MatchFocus = 'all' | 'profession' | 'interests' | 'bucketList';

/** Like-minded travelers. With `tripId`: people who'd fit that trip and aren't on it yet. */
export async function getMatchingTravelers(
  options: { tripId?: string; limit?: number; focus?: MatchFocus; industry?: Industry } = {},
) {
  return (await request<{ travelers: TravelerMatch[] }>('/matching/travelers', { query: options })).travelers;
}

export async function getRecommendedTrips(limit = 10) {
  return (await request<{ trips: TripRecommendation[] }>('/matching/trips', { query: { limit } })).trips;
}
