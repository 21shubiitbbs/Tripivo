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
  ) {
    super(message);
    this.name = 'ApiError';
  }
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
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, body?.error ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------------------------
// Health and auth

export type ApiHealth = { status: string; service: string; database: 'ok' | 'unreachable' };

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
  verified: boolean;
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
  travelStyles: string[];
  interests: string[];
  completed: boolean;
  stats: { trips: number; rating: number | null; followers: number; following: number };
};

export type MyProfile = Profile & { email: string | null; phone: string | null };
export type PublicProfile = Profile & { isMe: boolean; isFollowing: boolean; isBlocked: boolean };

export type ProfileChanges = Partial<{
  name: string;
  username: string;
  picture: string | null;
  email: string;
  bio: string;
  age: number | null;
  gender: string;
  city: string;
  profession: string;
  travelStyles: string[];
  interests: string[];
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

export type Destination = {
  id: string;
  name: string;
  tags: string;
  image: string;
  latitude: number;
  longitude: number;
  trending: boolean;
};

export async function getDestinations() {
  return (await request<{ destinations: Destination[] }>('/destinations', { token: null })).destinations;
}

export type Membership = 'host' | 'member' | 'pending' | null;
export type TripPhase = 'upcoming' | 'active' | 'completed';
export type JoinMethod = 'open' | 'approval';

export type TripSummary = {
  id: string;
  title: string;
  destination: string;
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
  reviews: Review[];
  /** Number of reviews with 5, 4, 3, 2 and 1 stars. */
  ratingDistribution: number[];
  chatRoomId: string | null;
  canReview: boolean;
  pendingRequestCount: number;
};

export type TripCategory = 'trekking' | 'beaches' | 'nightlife' | 'budget' | 'weekend';
export type GroupSizeKey = '2-4' | '5-8' | '9-12' | '12+';
export type BudgetKey = 'under5k' | '5k-10k' | '10k-20k' | '20k+';

export type TripQuery = {
  q?: string;
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
  destination: string;
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

export type ReportTarget = 'user' | 'trip' | 'message' | 'other';

export function sendReport(targetType: ReportTarget, details: string, targetId?: string) {
  return request<{ report: { id: string } }>('/reports', { method: 'POST', body: { targetType, targetId, details } });
}
