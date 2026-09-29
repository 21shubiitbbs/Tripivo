import type { Industry } from '../../db/schema/index.js';

// Fixed options for profiles that the API needs to know about: prompt questions (validated on
// save), vibe axes and industry labels (used in human-readable match reasons). The app has its
// own copy with icons in frontend/src/data/catalog.ts; keep the keys in sync.

export const PROFILE_PROMPTS = [
  'ideal_trip',
  'dont_travel_with_me',
  'never_without',
  'can_teach_you',
  'best_memory',
  'travel_hack',
  'next_adventure',
] as const;

export const MAX_PROMPTS = 3;
export const MAX_PROMPT_ANSWER = 200;
export const MAX_BUCKET_LIST = 25;

export const INDUSTRY_LABELS: Record<Industry, string> = {
  tech: 'Tech',
  design: 'Design',
  business: 'Business',
  finance: 'Finance',
  marketing: 'Marketing',
  healthcare: 'Healthcare',
  education: 'Education',
  engineering: 'Engineering',
  creative: 'Arts & Media',
  law: 'Law',
  science: 'Science',
  hospitality: 'Hospitality',
  public_service: 'Public service',
  student: 'Studies',
  other: 'Other',
};

export const VIBE_AXES = ['pace', 'planning', 'social', 'rhythm'] as const;
export type VibeAxis = (typeof VIBE_AXES)[number];
export type Vibe = Record<VibeAxis, number | null>;

/** How to describe two people who sit at the same end of an axis: [low end, high end]. */
export const VIBE_SHARED_LABELS: Record<VibeAxis, [string, string]> = {
  pace: ['Both like a slow pace', 'Both like packed days'],
  planning: ['Both go with the flow', 'Both love a plan'],
  social: ['Both enjoy quiet time', 'Both love meeting people'],
  rhythm: ['Both early birds', 'Both night owls'],
};
