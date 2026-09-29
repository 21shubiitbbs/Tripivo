// Fixed lists the app ships with: interest categories, form options and a few illustration
// photos. Everything else (trips, people, chats) comes from the API in src/lib/api.ts.

import type { BudgetKey, ExpenseCategory, GroupSizeKey } from '../lib/api';

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
