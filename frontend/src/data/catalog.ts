// Fixed lists the app ships with: interest categories, form options and a few illustration
// photos. Everything else (trips, people, chats) comes from the API in src/lib/api.ts.

import type { BudgetKey, BudgetLevel, ExpenseCategory, GroupSizeKey, Industry, LookingFor, VibeAxis } from '../lib/api';

const unsplash = (id: string, width = 800) =>
  `https://images.unsplash.com/photo-${id}?w=${width}&q=70&auto=format&fit=crop`;

export const images = {
  splash: unsplash('1506905925346-21bda4d32df4', 1200),
  hikers: unsplash('1501554728187-ce583db33af7'),
  manaliSnow: unsplash('1626621341517-bbf3d9990a23'),
  ladakh: unsplash('1605649487212-47bdab064df7'),
  goaPalms: unsplash('1519046904884-53103b34b206'),
  goaSunset: unsplash('1473116763249-2faaef81ccda'),
  photography: unsplash('1530789253388-582c481c54b0'),
  kerala: unsplash('1602216056096-3b40cc0c9944'),
};

/** Faces around the globe on the second onboarding slide. */
export const onboardingPortraits = [
  'https://randomuser.me/api/portraits/men/32.jpg',
  'https://randomuser.me/api/portraits/women/44.jpg',
  'https://randomuser.me/api/portraits/men/46.jpg',
  'https://randomuser.me/api/portraits/women/68.jpg',
  'https://randomuser.me/api/portraits/men/75.jpg',
  'https://randomuser.me/api/portraits/women/26.jpg',
];

export type InterestKey =
  | 'trekking'
  | 'beaches'
  | 'food'
  | 'photography'
  | 'nightlife'
  | 'camping'
  | 'culture'
  | 'roadTrips'
  | 'wildlife'
  | 'scuba'
  | 'sightseeing';

export type Interest = {
  key: InterestKey;
  label: string;
  /** A MaterialCommunityIcons glyph name. */
  icon: string;
  tint: string;
  background: string;
};

export const interests: Record<InterestKey, Interest> = {
  trekking: { key: 'trekking', label: 'Trekking', icon: 'hiking', tint: '#1D6AE5', background: '#E3EDFD' },
  beaches: { key: 'beaches', label: 'Beaches', icon: 'beach', tint: '#E8833A', background: '#FDEEE1' },
  food: { key: 'food', label: 'Food', icon: 'silverware-fork-knife', tint: '#D97706', background: '#FEF3DC' },
  photography: { key: 'photography', label: 'Photography', icon: 'camera', tint: '#0E7490', background: '#E0F4F7' },
  nightlife: { key: 'nightlife', label: 'Nightlife', icon: 'glass-cocktail', tint: '#7C3AED', background: '#EFE7FD' },
  camping: { key: 'camping', label: 'Camping', icon: 'tent', tint: '#15803D', background: '#E3F5E8' },
  culture: { key: 'culture', label: 'Culture', icon: 'bank', tint: '#B45309', background: '#FCEFD9' },
  roadTrips: { key: 'roadTrips', label: 'Road Trips', icon: 'car-side', tint: '#2563EB', background: '#E3EDFD' },
  wildlife: { key: 'wildlife', label: 'Wildlife', icon: 'paw', tint: '#92400E', background: '#F6EBDD' },
  scuba: { key: 'scuba', label: 'Scuba Diving', icon: 'diving-scuba-tank', tint: '#0284C7', background: '#E0F2FE' },
  sightseeing: { key: 'sightseeing', label: 'Sightseeing', icon: 'binoculars', tint: '#1E40AF', background: '#E3E9FB' },
};

export const TRAVEL_STYLES: InterestKey[] = ['trekking', 'beaches', 'food', 'photography', 'nightlife', 'camping'];
export const PROFILE_INTERESTS: InterestKey[] = [...TRAVEL_STYLES, 'culture', 'roadTrips', 'wildlife'];
export const TRIP_ACTIVITIES: InterestKey[] = [
  'trekking',
  'photography',
  'food',
  'nightlife',
  'camping',
  'scuba',
  'sightseeing',
  'wildlife',
];

/** Group size options, with the member cap a new trip gets for each. */
export const GROUP_SIZES: { key: GroupSizeKey; label: string; maxMembers: number }[] = [
  { key: '2-4', label: '2-4', maxMembers: 4 },
  { key: '5-8', label: '5-8', maxMembers: 8 },
  { key: '9-12', label: '9-12', maxMembers: 12 },
  { key: '12+', label: '12+', maxMembers: 16 },
];

export const BUDGETS: { key: BudgetKey; label: string }[] = [
  { key: 'under5k', label: 'Under ₹5K' },
  { key: '5k-10k', label: '₹5K - ₹10K' },
  { key: '10k-20k', label: '₹10K - ₹20K' },
  { key: '20k+', label: '₹20K+' },
];

export function isInterestKey(key: string): key is InterestKey {
  return key in interests;
}

/** Shared-expense categories, with a MaterialCommunityIcons glyph each. */
export const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string; icon: string }[] = [
  { key: 'food', label: 'Food', icon: 'silverware-fork-knife' },
  { key: 'accommodation', label: 'Stay', icon: 'bed-outline' },
  { key: 'transport', label: 'Transport', icon: 'car-outline' },
  { key: 'activities', label: 'Activities', icon: 'ticket-outline' },
  { key: 'shopping', label: 'Shopping', icon: 'shopping-outline' },
  { key: 'other', label: 'Other', icon: 'cash-multiple' },
];

// ---------------------------------------------------------------------------------------------
// Profile options. Keys match backend/src/db/schema/enums.ts and modules/users/profile-options.ts.

/** The field someone works in, used to match travelers by profession. Icons are MaterialCommunityIcons. */
export const INDUSTRIES: { key: Industry; label: string; icon: string }[] = [
  { key: 'tech', label: 'Tech', icon: 'laptop' },
  { key: 'design', label: 'Design', icon: 'palette-outline' },
  { key: 'business', label: 'Business', icon: 'briefcase-outline' },
  { key: 'finance', label: 'Finance', icon: 'finance' },
  { key: 'marketing', label: 'Marketing', icon: 'bullhorn-outline' },
  { key: 'healthcare', label: 'Healthcare', icon: 'medical-bag' },
  { key: 'education', label: 'Education', icon: 'school-outline' },
  { key: 'engineering', label: 'Engineering', icon: 'cog-outline' },
  { key: 'creative', label: 'Arts & Media', icon: 'movie-open-outline' },
  { key: 'law', label: 'Law', icon: 'scale-balance' },
  { key: 'science', label: 'Science', icon: 'flask-outline' },
  { key: 'hospitality', label: 'Hospitality', icon: 'room-service-outline' },
  { key: 'public_service', label: 'Public service', icon: 'bank-outline' },
  { key: 'student', label: 'Student', icon: 'book-open-variant' },
  { key: 'other', label: 'Other', icon: 'dots-horizontal' },
];

export function industryLabel(key: string | null | undefined) {
  return INDUSTRIES.find((industry) => industry.key === key)?.label ?? null;
}

export const LANGUAGES = [
  'English',
  'Hindi',
  'Bengali',
  'Marathi',
  'Telugu',
  'Tamil',
  'Gujarati',
  'Kannada',
  'Malayalam',
  'Punjabi',
  'Odia',
  'Urdu',
  'French',
  'German',
  'Spanish',
];

export const LOOKING_FOR: { key: LookingFor; label: string; icon: string }[] = [
  { key: 'travel_buddies', label: 'Travel buddies', icon: 'account-group-outline' },
  { key: 'networking', label: 'Networking', icon: 'handshake-outline' },
  { key: 'workation', label: 'Workations', icon: 'laptop' },
  { key: 'weekend_trips', label: 'Weekend getaways', icon: 'calendar-weekend-outline' },
  { key: 'long_trips', label: 'Long trips', icon: 'map-marker-path' },
];

/** Travel personality. Each axis is 1–5, from `low` to `high`. */
export const VIBE_AXES: { key: VibeAxis; label: string; icon: string; low: string; high: string }[] = [
  { key: 'pace', label: 'Pace', icon: 'speedometer', low: 'Slow & easy', high: 'Packed days' },
  { key: 'planning', label: 'Planning', icon: 'clipboard-text-outline', low: 'Go with the flow', high: 'Every hour planned' },
  { key: 'social', label: 'Social battery', icon: 'account-voice', low: 'Quiet time', high: 'Life of the party' },
  { key: 'rhythm', label: 'Daily rhythm', icon: 'weather-sunset', low: 'Early bird', high: 'Night owl' },
];

export const TRAVEL_BUDGETS: { key: BudgetLevel; label: string; description: string }[] = [
  { key: 'budget', label: 'Backpacker', description: 'Hostels, buses and street food' },
  { key: 'moderate', label: 'Comfort', description: 'Good stays with a few splurges' },
  { key: 'luxury', label: 'Premium', description: 'Nice hotels, private transfers' },
];

/** Short questions travelers answer on their profile (up to three). */
export const PROFILE_PROMPTS: { key: string; question: string; placeholder: string }[] = [
  { key: 'ideal_trip', question: 'My ideal trip looks like…', placeholder: 'Sunrise treks, long lunches, no alarms…' },
  { key: 'dont_travel_with_me', question: 'Don’t travel with me if…', placeholder: 'You hate early mornings…' },
  { key: 'never_without', question: 'I never travel without…', placeholder: 'A power bank and snacks…' },
  { key: 'can_teach_you', question: 'On a trip, I can teach you…', placeholder: 'How to haggle, first aid, photography…' },
  { key: 'best_memory', question: 'My best travel memory…', placeholder: 'Getting lost in Varanasi at dawn…' },
  { key: 'travel_hack', question: 'My best travel hack…', placeholder: 'Always book the window seat on the left…' },
  { key: 'next_adventure', question: 'Next on my list…', placeholder: 'Scuba diving in the Andamans…' },
];

export function promptQuestion(key: string) {
  return PROFILE_PROMPTS.find((prompt) => prompt.key === key)?.question ?? key;
}

/** Badges the API awards from trips and the profile. */
export const BADGES: Record<string, { label: string; description: string; icon: string; tint: string }> = {
  verified: { label: 'Verified', description: 'Signed in with a verified phone or Google account', icon: 'check-decagram', tint: '#1D6AE5' },
  first_trip: { label: 'First trip', description: 'Finished a trip with Tripivo', icon: 'flag-checkered', tint: '#15803D' },
  explorer: { label: 'Explorer', description: 'Travelled to 5 or more places', icon: 'compass-outline', tint: '#0E7490' },
  globetrotter: { label: 'Globetrotter', description: 'Trips in 3 or more countries', icon: 'earth', tint: '#7C3AED' },
  host: { label: 'Host', description: 'Hosted a trip', icon: 'account-star-outline', tint: '#D97706' },
  trusted_host: { label: 'Trusted host', description: 'Hosted 3 or more trips', icon: 'shield-star-outline', tint: '#B45309' },
  super_host: { label: 'Super host', description: 'Hosted 3+ trips rated 4.5 or higher', icon: 'crown-outline', tint: '#CA8A04' },
  social: { label: 'Well connected', description: '10 or more followers', icon: 'account-heart-outline', tint: '#DB2777' },
  dreamer: { label: 'Dreamer', description: '5 or more places on the bucket list', icon: 'star-shooting-outline', tint: '#4F46E5' },
  polyglot: { label: 'Polyglot', description: 'Speaks 3 or more languages', icon: 'translate', tint: '#0284C7' },
};

/** Nudges for the parts of a profile that are still missing (`completeness.missing`). */
export const PROFILE_PARTS: Record<string, { label: string; route: string }> = {
  picture: { label: 'Add a profile photo', route: '/edit-profile' },
  bio: { label: 'Write a short bio', route: '/edit-profile' },
  city: { label: 'Add your city', route: '/edit-profile' },
  profession: { label: 'Add your profession and field', route: '/edit-profile' },
  interests: { label: 'Pick at least 3 interests', route: '/edit-profile' },
  languages: { label: 'Add the languages you speak', route: '/edit-profile' },
  vibe: { label: 'Set your travel vibe', route: '/travel-vibe' },
  prompts: { label: 'Answer a profile prompt', route: '/prompts' },
  bucketList: { label: 'Start your bucket list', route: '/bucket-list' },
};
