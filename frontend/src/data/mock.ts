// Sample content for the screens. The API has no trips, travelers or chat endpoints yet, so
// everything here stays on the device. Replace these with calls in src/lib/api.ts as the backend
// grows.

const unsplash = (id: string, width = 800) =>
  `https://images.unsplash.com/photo-${id}?w=${width}&q=70&auto=format&fit=crop`;

export const images = {
  splash: unsplash('1506905925346-21bda4d32df4', 1200),
  hikers: unsplash('1501554728187-ce583db33af7'),
  goa: unsplash('1512343879784-a960bf40e7f2'),
  goaShacks: unsplash('1614082242765-7c98ca0f3df3'),
  goaCove: unsplash('1507525428034-b723cf961d3e', 1200),
  goaPalms: unsplash('1519046904884-53103b34b206'),
  goaSunset: unsplash('1473116763249-2faaef81ccda'),
  manali: unsplash('1622308644420-b20142dc993c'),
  manaliSnow: unsplash('1626621341517-bbf3d9990a23'),
  ladakh: unsplash('1605649487212-47bdab064df7'),
  bali: unsplash('1518548419970-58e3b4079ab2'),
  jaipur: unsplash('1599661046289-e31897846e41'),
  kasol: unsplash('1581791534721-e599df4417f7'),
  rishikesh: unsplash('1500534314209-a25ddb2bd429'),
  kerala: unsplash('1602216056096-3b40cc0c9944'),
  mumbai: unsplash('1570168007204-dfb528c6958f'),
  scuba: unsplash('1544551763-46a013bb70d5'),
  party: unsplash('1533174072545-7a4b6ad7a6c3'),
  food: unsplash('1565299624946-b28f40a0ae38'),
  camping: unsplash('1487730116645-74489c95b41b'),
  photography: unsplash('1530789253388-582c481c54b0'),
  fort: unsplash('1587474260584-136574528ed5'),
  resort: unsplash('1566073771259-6a8506099945'),
};

const portrait = (gender: 'men' | 'women', n: number) =>
  `https://randomuser.me/api/portraits/${gender}/${n}.jpg`;

export type Traveler = {
  id: string;
  name: string;
  age: number;
  city: string;
  avatar: string;
  verified: boolean;
};

export const travelers: Traveler[] = [
  { id: 'rahul', name: 'Rahul', age: 26, city: 'Delhi', avatar: portrait('men', 32), verified: true },
  { id: 'sneha', name: 'Sneha', age: 24, city: 'Mumbai', avatar: portrait('women', 44), verified: true },
  { id: 'aman', name: 'Aman', age: 28, city: 'Bangalore', avatar: portrait('men', 46), verified: true },
  { id: 'priya', name: 'Priya', age: 25, city: 'Pune', avatar: portrait('women', 68), verified: true },
  { id: 'vikram', name: 'Vikram', age: 27, city: 'Hyderabad', avatar: portrait('men', 75), verified: true },
  { id: 'neha', name: 'Neha', age: 24, city: 'Chennai', avatar: portrait('women', 26), verified: true },
];

export function travelerById(id: string) {
  return travelers.find((traveler) => traveler.id === id);
}

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

export type Destination = {
  id: string;
  name: string;
  tags: string;
  image: string;
};

export const destinations: Destination[] = [
  { id: 'goa', name: 'Goa', tags: 'Beaches, Nightlife', image: images.goa },
  { id: 'manali', name: 'Manali', tags: 'Trekking, Mountains', image: images.manali },
  { id: 'ladakh', name: 'Ladakh', tags: 'Adventure, Biking', image: images.ladakh },
  { id: 'bali', name: 'Bali', tags: 'Beaches, Culture', image: images.bali },
  { id: 'jaipur', name: 'Jaipur', tags: 'Heritage, Culture', image: images.jaipur },
  { id: 'kasol', name: 'Kasol', tags: 'Camping, Rivers', image: images.kasol },
  { id: 'rishikesh', name: 'Rishikesh', tags: 'Rafting, Yoga', image: images.rishikesh },
  { id: 'kerala', name: 'Kerala', tags: 'Backwaters, Food', image: images.kerala },
];

export const TRENDING_DESTINATIONS = ['goa', 'manali', 'kasol', 'rishikesh'];

export type ItineraryItem = {
  time: string;
  title: string;
  detail: string;
  image: string;
};

export type Review = {
  id: string;
  travelerId: string;
  rating: number;
  when: string;
  text: string;
};

export type JoinMethod = 'open' | 'approval';

export type Trip = {
  id: string;
  title: string;
  destination: string;
  image: string;
  startDate: string;
  endDate: string;
  dateLabel: string;
  nights: number;
  spots: number;
  joined: number;
  groupSize: string;
  pricePerPerson: number;
  budgetLabel: string;
  rating: number;
  reviewCount: number;
  about: string;
  activities: InterestKey[];
  joinMethod: JoinMethod;
  hostId: string;
  travelerIds: string[];
  itinerary: ItineraryItem[][];
  reviews: Review[];
  /** Distance from the user, for the map view. */
  distanceKm: number;
  /** Position on the illustrated map, as fractions of its width and height. */
  map: { x: number; y: number };
};

const goaItinerary: ItineraryItem[][] = [
  [
    { time: '09:00 AM', title: 'Arrive at Goa', detail: 'Check-in and freshen up', image: images.resort },
    { time: '11:00 AM', title: 'Calangute Beach', detail: 'Beach time and water activities', image: images.goaPalms },
    { time: '01:00 PM', title: 'Lunch', detail: 'Local Goan cuisine', image: images.food },
    { time: '04:00 PM', title: 'Fort Aguada', detail: 'Explore the historic fort', image: images.fort },
    { time: '07:00 PM', title: 'Beach Party', detail: 'Music, drinks and fun', image: images.party },
  ],
  [
    { time: '08:00 AM', title: 'Scuba at Grande Island', detail: 'Guided dive for beginners', image: images.scuba },
    { time: '02:00 PM', title: 'Anjuna Flea Market', detail: 'Shopping and street food', image: images.goaShacks },
    { time: '06:30 PM', title: 'Sunset at Chapora', detail: 'Golden hour photos', image: images.goaSunset },
  ],
  [
    { time: '10:00 AM', title: 'Old Goa Churches', detail: 'Heritage walk', image: images.fort },
    { time: '01:30 PM', title: 'Seafood Lunch', detail: 'Fish thali at a beach shack', image: images.food },
    { time: '05:00 PM', title: 'Palolem Beach', detail: 'Kayaking and chill', image: images.goa },
  ],
  [
    { time: '09:00 AM', title: 'Breakfast & Checkout', detail: 'Last group photos', image: images.resort },
    { time: '12:00 PM', title: 'Head Home', detail: 'Airport and station drops', image: images.goaCove },
  ],
];

const goaReviews: Review[] = [
  {
    id: 'r1',
    travelerId: 'priya',
    rating: 5,
    when: '5 days ago',
    text: 'Amazing trip! Great people and well planned. Would definitely join again.',
  },
  {
    id: 'r2',
    travelerId: 'aman',
    rating: 5,
    when: '2 weeks ago',
    text: 'Had a wonderful time. The host was very helpful and the group was fun.',
  },
  {
    id: 'r3',
    travelerId: 'neha',
    rating: 4,
    when: '1 month ago',
    text: 'Loved the beaches and the food. The itinerary was a little packed on day one.',
  },
];

export const seedTrips: Trip[] = [
  {
    id: 'goa-weekend',
    title: 'Goa Weekend Escape',
    destination: 'Goa',
    image: images.goaCove,
    startDate: '2026-10-15',
    endDate: '2026-10-18',
    dateLabel: '15 Oct - 18 Oct',
    nights: 3,
    spots: 12,
    joined: 8,
    groupSize: '9-12',
    pricePerPerson: 8500,
    budgetLabel: '₹5K - ₹10K',
    rating: 4.8,
    reviewCount: 42,
    about:
      "A relaxed weekend trip to explore Goa's beautiful beaches, amazing food and vibrant nightlife. Perfect for solo travelers and groups to connect and have fun together.",
    activities: ['beaches', 'photography', 'food', 'nightlife'],
    joinMethod: 'open',
    hostId: 'rahul',
    travelerIds: ['rahul', 'sneha', 'aman', 'priya', 'vikram', 'neha'],
    itinerary: goaItinerary,
    reviews: goaReviews,
    distanceKm: 5,
    map: { x: 0.36, y: 0.3 },
  },
  {
    id: 'goa-party',
    title: 'Goa Beach & Party',
    destination: 'Goa',
    image: images.goaShacks,
    startDate: '2026-10-20',
    endDate: '2026-10-24',
    dateLabel: '20 Oct - 24 Oct',
    nights: 4,
    spots: 8,
    joined: 5,
    groupSize: '5-8',
    pricePerPerson: 9200,
    budgetLabel: '₹5K - ₹10K',
    rating: 4.6,
    reviewCount: 18,
    about: 'Four nights of beach hopping, shack dinners and the best parties in North Goa.',
    activities: ['beaches', 'nightlife', 'food'],
    joinMethod: 'approval',
    hostId: 'sneha',
    travelerIds: ['sneha', 'vikram', 'neha', 'aman', 'rahul'],
    itinerary: goaItinerary.slice(0, 3),
    reviews: goaReviews.slice(0, 2),
    distanceKm: 8,
    map: { x: 0.66, y: 0.24 },
  },
  {
    id: 'south-goa',
    title: 'South Goa Relaxation',
    destination: 'Goa',
    image: images.goaPalms,
    startDate: '2026-11-01',
    endDate: '2026-11-05',
    dateLabel: '1 Nov - 5 Nov',
    nights: 4,
    spots: 10,
    joined: 6,
    groupSize: '9-12',
    pricePerPerson: 7500,
    budgetLabel: '₹5K - ₹10K',
    rating: 4.7,
    reviewCount: 25,
    about: 'Quiet beaches, yoga mornings and long lunches in the calmer south of Goa.',
    activities: ['beaches', 'food', 'photography'],
    joinMethod: 'open',
    hostId: 'priya',
    travelerIds: ['priya', 'neha', 'aman', 'sneha', 'rahul', 'vikram'],
    itinerary: goaItinerary.slice(1),
    reviews: goaReviews.slice(1),
    distanceKm: 32,
    map: { x: 0.56, y: 0.56 },
  },
  {
    id: 'goa-photo',
    title: 'Goa Photography Trip',
    destination: 'Goa',
    image: images.goaSunset,
    startDate: '2026-11-10',
    endDate: '2026-11-14',
    dateLabel: '10 Nov - 14 Nov',
    nights: 4,
    spots: 8,
    joined: 4,
    groupSize: '5-8',
    pricePerPerson: 8000,
    budgetLabel: '₹5K - ₹10K',
    rating: 4.9,
    reviewCount: 12,
    about: 'Sunrise shoots, hidden coves and a hands-on editing session with a pro photographer.',
    activities: ['photography', 'beaches', 'sightseeing'],
    joinMethod: 'approval',
    hostId: 'vikram',
    travelerIds: ['vikram', 'priya', 'rahul', 'neha'],
    itinerary: goaItinerary.slice(0, 2),
    reviews: goaReviews.slice(0, 1),
    distanceKm: 12,
    map: { x: 0.8, y: 0.44 },
  },
  {
    id: 'manali-adventure',
    title: 'Manali Adventure',
    destination: 'Manali',
    image: images.manaliSnow,
    startDate: '2026-11-04',
    endDate: '2026-11-08',
    dateLabel: '4 Nov - 8 Nov',
    nights: 4,
    spots: 12,
    joined: 6,
    groupSize: '9-12',
    pricePerPerson: 11500,
    budgetLabel: '₹10K - ₹20K',
    rating: 4.8,
    reviewCount: 31,
    about: 'Snow treks, cafe hopping in Old Manali and a bonfire night by the Beas river.',
    activities: ['trekking', 'camping', 'photography'],
    joinMethod: 'open',
    hostId: 'aman',
    travelerIds: ['aman', 'rahul', 'sneha', 'vikram', 'priya', 'neha'],
    itinerary: goaItinerary.slice(0, 2),
    reviews: goaReviews,
    distanceKm: 1900,
    map: { x: 0.2, y: 0.62 },
  },
  {
    id: 'rishikesh-retreat',
    title: 'Rishikesh Retreat',
    destination: 'Rishikesh',
    image: images.rishikesh,
    startDate: '2026-11-20',
    endDate: '2026-11-24',
    dateLabel: '20 Nov - 24 Nov',
    nights: 4,
    spots: 12,
    joined: 10,
    groupSize: '9-12',
    pricePerPerson: 6500,
    budgetLabel: '₹5K - ₹10K',
    rating: 4.7,
    reviewCount: 22,
    about: 'River rafting, riverside yoga and evening aarti at Triveni Ghat.',
    activities: ['trekking', 'camping', 'culture'],
    joinMethod: 'open',
    hostId: 'neha',
    travelerIds: ['neha', 'priya', 'aman', 'rahul', 'sneha', 'vikram'],
    itinerary: goaItinerary.slice(0, 2),
    reviews: goaReviews.slice(0, 2),
    distanceKm: 1650,
    map: { x: 0.3, y: 0.8 },
  },
];

export const GROUP_SIZES = ['2-4', '5-8', '9-12', '12+'];
export const BUDGETS = ['Under ₹5K', '₹5K - ₹10K', '₹10K - ₹20K', '₹20K+'];

export type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  time: string;
};

export type Poll = {
  question: string;
  options: { label: string; votes: number }[];
};

export type ChatRoom = {
  id: string;
  name: string;
  avatar: string;
  isGroup: boolean;
  memberCount: number;
  lastMessage: string;
  lastTime: string;
  unread: number;
  messages: ChatMessage[];
  poll?: Poll;
};

export const seedChats: ChatRoom[] = [
  {
    id: 'goa-weekend',
    name: 'Goa Weekend',
    avatar: images.goa,
    isGroup: true,
    memberCount: 8,
    lastMessage: 'Rahul: Should we do scuba diving on Saturday?',
    lastTime: '10:30 AM',
    unread: 3,
    messages: [
      { id: 'm1', senderId: 'rahul', text: 'Should we do scuba diving on Saturday?', time: '10:24 AM' },
      { id: 'm2', senderId: 'sneha', text: 'Yes! 🙌', time: '10:26 AM' },
    ],
    poll: {
      question: 'Scuba diving on Saturday?',
      options: [
        { label: 'Yes', votes: 6 },
        { label: 'No', votes: 2 },
      ],
    },
  },
  {
    id: 'sneha',
    name: 'Sneha',
    avatar: portrait('women', 44),
    isGroup: false,
    memberCount: 2,
    lastMessage: 'Hey! Are you joining the trip?',
    lastTime: '09:15 AM',
    unread: 1,
    messages: [{ id: 'm1', senderId: 'sneha', text: 'Hey! Are you joining the trip?', time: '09:15 AM' }],
  },
  {
    id: 'aman',
    name: 'Aman',
    avatar: portrait('men', 46),
    isGroup: false,
    memberCount: 2,
    lastMessage: "Let's plan the itinerary",
    lastTime: '1:25 AM',
    unread: 0,
    messages: [{ id: 'm1', senderId: 'aman', text: "Let's plan the itinerary", time: '1:25 AM' }],
  },
  {
    id: 'priya',
    name: 'Priya',
    avatar: portrait('women', 68),
    isGroup: false,
    memberCount: 2,
    lastMessage: 'That sounds great!',
    lastTime: 'Yesterday',
    unread: 0,
    messages: [{ id: 'm1', senderId: 'priya', text: 'That sounds great!', time: 'Yesterday' }],
  },
];

export type NotificationKind = 'trips' | 'messages' | 'requests';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  text: string;
  when: string;
  avatar?: string;
  icon?: string;
};

export const notifications: AppNotification[] = [
  { id: 'n1', kind: 'requests', text: 'Rahul accepted your join request', when: '2 minutes ago', avatar: portrait('men', 32) },
  { id: 'n2', kind: 'messages', text: 'New message in Goa Weekend', when: '10 minutes ago', avatar: portrait('men', 46) },
  { id: 'n3', kind: 'trips', text: 'Your trip has 2 new join requests', when: '1 hour ago', icon: 'account-multiple-plus' },
  { id: 'n4', kind: 'messages', text: 'Sneha mentioned you in a message', when: '3 hours ago', avatar: portrait('women', 44) },
  { id: 'n5', kind: 'trips', text: 'Manali Adventure starts in 5 days', when: 'Yesterday', icon: 'calendar-clock' },
];
