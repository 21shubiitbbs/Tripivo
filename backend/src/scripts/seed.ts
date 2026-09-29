// Fills a development database with sample travelers, trips, chats and notifications so every
// screen of the app has something to show. Safe to run more than once.
//
//   npm run db:seed                      # sample content + the demo account (dev login)
//   npm run db:seed -- +919876543210     # also put your own phone-number account on the trips
//
// Refuses to run with NODE_ENV=production.

import type pg from 'pg';
import { env } from '../config/env.js';
import { runMigrations } from '../db/migrator.js';
import { pool } from '../db/pool.js';
import type { BudgetLevel, Industry, ItineraryActivity, LookingFor, ProfilePrompt } from '../db/schema/index.js';
import { withTransaction } from '../db/transaction.js';
import { DEMO_PHONE } from '../modules/auth/auth.service.js';
import { normalizePhoneNumber } from '../modules/auth/phone/phone-number.js';
import { findOrCreateDirectRoom, insertPoll, upsertVote } from '../modules/chats/chats.repository.js';
import { insertNotification } from '../modules/notifications/notifications.repository.js';
import {
  addMember,
  findTripExtras,
  insertJoinRequest,
  insertTrip,
  replaceItinerary,
  upsertReview,
} from '../modules/trips/trips.repository.js';
import {
  insertBucketListItem,
  updateUser,
  upsertPhoneUser,
  upsertTravelProfile,
} from '../modules/users/users.repository.js';

if (env.isProduction) {
  console.error('Refusing to seed a production database.');
  process.exit(1);
}

const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=800&q=70&auto=format&fit=crop`;
const images = {
  goaCove: img('1507525428034-b723cf961d3e'),
  goaShacks: img('1614082242765-7c98ca0f3df3'),
  goaPalms: img('1519046904884-53103b34b206'),
  goaSunset: img('1473116763249-2faaef81ccda'),
  goa: img('1512343879784-a960bf40e7f2'),
  manaliSnow: img('1626621341517-bbf3d9990a23'),
  rishikesh: img('1500534314209-a25ddb2bd429'),
  kasol: img('1581791534721-e599df4417f7'),
  camping: img('1487730116645-74489c95b41b'),
  ladakh: img('1605649487212-47bdab064df7'),
  jaipur: img('1599661046289-e31897846e41'),
  resort: img('1566073771259-6a8506099945'),
  food: img('1565299624946-b28f40a0ae38'),
  fort: img('1587474260584-136574528ed5'),
  party: img('1533174072545-7a4b6ad7a6c3'),
  scuba: img('1544551763-46a013bb70d5'),
  hikers: img('1501554728187-ce583db33af7'),
};

type Person = {
  key: string;
  phone: string;
  name: string;
  username: string;
  picture: string;
  age: number;
  gender: string;
  city: string;
  profession: string;
  bio: string;
  interests: string[];
  industry: Industry;
  languages: string[];
  lookingFor: LookingFor[];
  budget: BudgetLevel;
  /** pace, planning, social, rhythm (1–5 each). */
  vibe: [number, number, number, number];
  prompts: ProfilePrompt[];
  bucketList: string[];
};

const prompt = (key: string, answer: string): ProfilePrompt => ({ prompt: key, answer });

const PEOPLE: Person[] = [
  { key: 'rahul', phone: '+919000000001', name: 'Rahul Mehta', username: 'rahul', picture: 'https://randomuser.me/api/portraits/men/32.jpg', age: 26, gender: 'Male', city: 'Delhi', profession: 'Product Designer', bio: 'Weekend beach bum and weekday designer. Always planning the next escape.', interests: ['beaches', 'nightlife', 'photography'], industry: 'design', languages: ['English', 'Hindi', 'Punjabi'], lookingFor: ['travel_buddies', 'weekend_trips'], budget: 'moderate', vibe: [3, 2, 5, 5], prompts: [prompt('ideal_trip', 'A beach shack, a good playlist and zero plans after noon.'), prompt('dont_travel_with_me', 'You want to be in bed before midnight on a Goa trip.')], bucketList: ['Bali', 'Andaman Islands'] },
  { key: 'sneha', phone: '+919000000002', name: 'Sneha Iyer', username: 'sneha', picture: 'https://randomuser.me/api/portraits/women/44.jpg', age: 24, gender: 'Female', city: 'Mumbai', profession: 'Marketing Lead', bio: 'Sunsets, street food and good company.', interests: ['beaches', 'food', 'nightlife'], industry: 'marketing', languages: ['English', 'Hindi', 'Marathi'], lookingFor: ['travel_buddies', 'weekend_trips'], budget: 'moderate', vibe: [3, 2, 5, 5], prompts: [prompt('never_without', 'A hot sauce bottle. Street food needs backup.'), prompt('best_memory', 'Dancing in the rain at a Goa beach party with strangers who became friends.')], bucketList: ['Bali', 'Thailand'] },
  { key: 'aman', phone: '+919000000003', name: 'Aman Verma', username: 'aman', picture: 'https://randomuser.me/api/portraits/men/46.jpg', age: 28, gender: 'Male', city: 'Bangalore', profession: 'Software Engineer', bio: 'Mountains over everything. Ask me about Himalayan treks.', interests: ['trekking', 'camping', 'photography'], industry: 'tech', languages: ['English', 'Hindi', 'Kannada'], lookingFor: ['networking', 'weekend_trips', 'workation'], budget: 'moderate', vibe: [4, 4, 2, 1], prompts: [prompt('can_teach_you', 'How to read a trail map, and how to debug on a 2G hotspot.'), prompt('ideal_trip', 'Up at 5 for a summit, back by sunset for Maggi and stars.')], bucketList: ['Ladakh', 'Spiti Valley', 'Kedarkantha'] },
  { key: 'priya', phone: '+919000000004', name: 'Priya Nair', username: 'priya', picture: 'https://randomuser.me/api/portraits/women/68.jpg', age: 25, gender: 'Female', city: 'Pune', profession: 'Architect', bio: 'Slow travel, old towns and long lunches.', interests: ['culture', 'food', 'beaches'], industry: 'design', languages: ['English', 'Malayalam', 'Hindi'], lookingFor: ['travel_buddies', 'long_trips'], budget: 'moderate', vibe: [1, 3, 2, 2], prompts: [prompt('ideal_trip', 'One old town, a week, and a different cafe every morning.'), prompt('travel_hack', 'Walk the first day without a map. You find the best lanes that way.')], bucketList: ['Kyoto', 'Bali', 'Hampi'] },
  { key: 'vikram', phone: '+919000000005', name: 'Vikram Rao', username: 'vikram', picture: 'https://randomuser.me/api/portraits/men/75.jpg', age: 27, gender: 'Male', city: 'Hyderabad', profession: 'Photographer', bio: 'I shoot landscapes and ride bikes to reach them.', interests: ['photography', 'roadTrips', 'trekking'], industry: 'creative', languages: ['English', 'Telugu', 'Hindi'], lookingFor: ['travel_buddies', 'long_trips'], budget: 'luxury', vibe: [4, 3, 2, 1], prompts: [prompt('can_teach_you', 'Shooting in manual mode, and fixing a bike chain on the road.'), prompt('next_adventure', 'Chasing the northern lights in Iceland.')], bucketList: ['Ladakh', 'Iceland'] },
  { key: 'neha', phone: '+919000000006', name: 'Neha Kapoor', username: 'neha', picture: 'https://randomuser.me/api/portraits/women/26.jpg', age: 24, gender: 'Female', city: 'Chennai', profession: 'Yoga Teacher', bio: 'Rivers, retreats and early mornings.', interests: ['trekking', 'culture', 'camping'], industry: 'healthcare', languages: ['English', 'Tamil'], lookingFor: ['travel_buddies', 'workation'], budget: 'budget', vibe: [2, 4, 2, 1], prompts: [prompt('never_without', 'A travel yoga mat and a first-aid kit.'), prompt('dont_travel_with_me', 'You think sunrise is optional.')], bucketList: ['Spiti Valley', 'Meghalaya'] },
];

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const a = (time: string, title: string, notes: string, image: string): ItineraryActivity => ({ time, title, notes, image });

const GOA_ITINERARY = [
  [
    a('09:00 AM', 'Arrive at Goa', 'Check-in and freshen up', images.resort),
    a('11:00 AM', 'Calangute Beach', 'Beach time and water activities', images.goaPalms),
    a('01:00 PM', 'Lunch', 'Local Goan cuisine', images.food),
    a('04:00 PM', 'Fort Aguada', 'Explore the historic fort', images.fort),
    a('07:00 PM', 'Beach Party', 'Music, drinks and fun', images.party),
  ],
  [
    a('08:00 AM', 'Scuba at Grande Island', 'Guided dive for beginners', images.scuba),
    a('02:00 PM', 'Anjuna Flea Market', 'Shopping and street food', images.goaShacks),
    a('06:30 PM', 'Sunset at Chapora', 'Golden hour photos', images.goaSunset),
  ],
  [
    a('10:00 AM', 'Old Goa Churches', 'Heritage walk', images.fort),
    a('01:30 PM', 'Seafood Lunch', 'Fish thali at a beach shack', images.food),
    a('05:00 PM', 'Palolem Beach', 'Kayaking and chill', images.goa),
  ],
  [
    a('09:00 AM', 'Breakfast & Checkout', 'Last group photos', images.resort),
    a('12:00 PM', 'Head Home', 'Airport and station drops', images.goaCove),
  ],
];

type TripSeed = {
  key: string;
  host: string;
  title: string;
  destination: string;
  image: string;
  start: number;
  nights: number;
  price: number | [number | null, number | null];
  maxMembers: number;
  joinMethod: 'open' | 'approval';
  activities: string[];
  description: string;
  audience?: string;
  lat: number;
  lng: number;
  members: string[];
  /** Also add the demo account (and any phone numbers passed on the command line). */
  enroll?: boolean;
  itinerary?: ItineraryActivity[][];
  reviews?: [string, number, string][];
};

const TRIPS: TripSeed[] = [
  {
    key: 'goa-weekend', host: 'rahul', title: 'Goa Weekend Escape', destination: 'Goa', image: images.goaCove,
    start: 18, nights: 3, price: 8500, maxMembers: 12, joinMethod: 'open',
    activities: ['beaches', 'photography', 'food', 'nightlife'],
    description: "A relaxed weekend trip to explore Goa's beautiful beaches, amazing food and vibrant nightlife. Perfect for solo travelers and groups to connect and have fun together.",
    audience: 'Solo travelers, beach lovers, first-timers', lat: 15.5439, lng: 73.7553,
    members: ['sneha', 'aman', 'priya', 'vikram', 'neha'], enroll: true, itinerary: GOA_ITINERARY,
    reviews: [
      ['priya', 5, 'Amazing trip! Great people and well planned. Would definitely join again.'],
      ['aman', 5, 'Had a wonderful time. The host was very helpful and the group was fun.'],
      ['neha', 4, 'Loved the beaches and the food. The itinerary was a little packed on day one.'],
    ],
  },
  {
    key: 'goa-party', host: 'sneha', title: 'Goa Beach & Party', destination: 'Goa', image: images.goaShacks,
    start: 23, nights: 4, price: 9200, maxMembers: 8, joinMethod: 'approval', activities: ['beaches', 'nightlife', 'food'],
    description: 'Four nights of beach hopping, shack dinners and the best parties in North Goa.',
    lat: 15.5889, lng: 73.7377, members: ['vikram', 'neha', 'aman'], itinerary: GOA_ITINERARY.slice(0, 3),
  },
  {
    key: 'south-goa', host: 'priya', title: 'South Goa Relaxation', destination: 'Goa', image: images.goaPalms,
    start: -40, nights: 4, price: 7500, maxMembers: 10, joinMethod: 'open', activities: ['beaches', 'food', 'photography'],
    description: 'Quiet beaches, yoga mornings and long lunches in the calmer south of Goa.',
    lat: 15.0100, lng: 74.0230, members: ['neha', 'aman', 'sneha', 'rahul'], enroll: true, itinerary: GOA_ITINERARY.slice(1),
    reviews: [
      ['aman', 5, 'The calmest, happiest trip I have taken this year.'],
      ['neha', 5, 'Priya planned everything beautifully.'],
      ['sneha', 4, 'Lovely beaches. Would have liked one more night!'],
    ],
  },
  {
    key: 'goa-photo', host: 'vikram', title: 'Goa Photography Trip', destination: 'Goa', image: images.goaSunset,
    start: 44, nights: 4, price: 8000, maxMembers: 8, joinMethod: 'approval', activities: ['photography', 'beaches', 'sightseeing'],
    description: 'Sunrise shoots, hidden coves and a hands-on editing session with a pro photographer.',
    lat: 15.4909, lng: 73.8278, members: ['priya', 'rahul', 'neha'], itinerary: GOA_ITINERARY.slice(0, 2),
  },
  {
    key: 'manali', host: 'aman', title: 'Manali Adventure', destination: 'Manali', image: images.manaliSnow,
    start: 38, nights: 4, price: 11500, maxMembers: 12, joinMethod: 'open', activities: ['trekking', 'camping', 'photography'],
    description: 'Snow treks, cafe hopping in Old Manali and a bonfire night by the Beas river.',
    lat: 32.2396, lng: 77.1887, members: ['rahul', 'sneha', 'vikram'], enroll: true,
    itinerary: [
      [a('10:00 AM', 'Reach Manali', 'Check in at the hostel in Old Manali', images.manaliSnow), a('04:00 PM', 'Cafe hopping', 'Old Manali cafes', images.food)],
      [a('07:00 AM', 'Hampta Pass trek', 'Guided day trek', images.hikers), a('07:00 PM', 'Bonfire', 'By the Beas river', images.camping)],
    ],
  },
  {
    key: 'rishikesh', host: 'neha', title: 'Rishikesh Retreat', destination: 'Rishikesh', image: images.rishikesh,
    start: 54, nights: 4, price: 6500, maxMembers: 12, joinMethod: 'open', activities: ['trekking', 'camping', 'culture'],
    description: 'River rafting, riverside yoga and evening aarti at Triveni Ghat.',
    lat: 30.0869, lng: 78.2676, members: ['priya', 'aman', 'rahul', 'sneha', 'vikram'],
  },
  {
    key: 'kasol', host: 'rahul', title: 'Kasol Camping Weekend', destination: 'Kasol', image: images.kasol,
    start: 10, nights: 3, price: 5000, maxMembers: 8, joinMethod: 'open', activities: ['camping', 'trekking'],
    description: 'Riverside camping in the Parvati valley with a short trek to Chalal.',
    lat: 32.0100, lng: 77.3150, members: ['neha', 'aman'],
  },
  {
    key: 'ladakh', host: 'vikram', title: 'Ladakh Bike Expedition', destination: 'Ladakh', image: images.ladakh,
    start: 70, nights: 8, price: [20000, null], maxMembers: 10, joinMethod: 'approval', activities: ['roadTrips', 'photography', 'trekking'],
    description: 'Leh to Pangong and Nubra on Royal Enfields, with a backup vehicle and mechanic.',
    lat: 34.1526, lng: 77.5771, members: ['aman'],
  },
];

async function upsertPerson(person: Person, client: pg.PoolClient) {
  const user = await upsertPhoneUser(person.phone, person.name, client);
  await updateUser(user.id, { name: person.name, username: person.username, picture: person.picture }, client);
  await upsertTravelProfile(
    user.id,
    {
      bio: person.bio,
      age: person.age,
      gender: person.gender,
      city: person.city,
      profession: person.profession,
      interests: person.interests,
      travel_styles: person.interests,
      industry: person.industry,
      languages: person.languages,
      looking_for: person.lookingFor,
      budget: person.budget,
      vibe_pace: person.vibe[0],
      vibe_planning: person.vibe[1],
      vibe_social: person.vibe[2],
      vibe_rhythm: person.vibe[3],
      prompts: person.prompts,
      completed: true,
    },
    client,
  );
  for (const name of person.bucketList) {
    await insertBucketListItem({ user_id: user.id, place_id: null, name, country: null }, client);
  }
  return user.id;
}

async function message(client: pg.PoolClient, roomId: string, senderId: string | null, body: string, minutesAgo: number) {
  await client.query(
    `INSERT INTO chat_messages (room_id, sender_id, message_type, body, created_at)
     VALUES ($1, $2, $3, $4, now() - make_interval(mins => $5))`,
    [roomId, senderId, senderId ? 'text' : 'system', body, minutesAgo],
  );
}

async function seedContent(ids: Record<string, string>, demoId: string, client: pg.PoolClient) {
  const tripIds: Record<string, string> = {};

  for (const trip of TRIPS) {
    const [budgetMin, budgetMax] = Array.isArray(trip.price) ? trip.price : [trip.price, trip.price];
    const tripId = await insertTrip(
      {
        creatorId: ids[trip.host],
        title: trip.title,
        description: trip.description,
        audience: trip.audience ?? null,
        destination: trip.destination,
        placeId: null,
        country: trip.destination === 'Bali' ? 'Indonesia' : 'India',
        coverImage: trip.image,
        startDate: daysFromNow(trip.start),
        endDate: daysFromNow(trip.start + trip.nights),
        budgetMin,
        budgetMax,
        maxMembers: trip.maxMembers,
        activities: trip.activities,
        joinMethod: trip.joinMethod,
        latitude: trip.lat,
        longitude: trip.lng,
      },
      client,
    );
    tripIds[trip.key] = tripId;
    for (const member of trip.members) await addMember(tripId, ids[member], 'member', client);
    if (trip.itinerary) {
      await replaceItinerary(
        tripId,
        trip.itinerary.map((activities, index) => ({ dayNumber: index + 1, date: daysFromNow(trip.start + index), title: null, activities })),
        client,
      );
    }
    for (const [reviewer, rating, comment] of trip.reviews ?? []) {
      await upsertReview(tripId, ids[reviewer], rating, comment, client);
    }
    if (trip.start + trip.nights < 0) await client.query(`UPDATE trips SET status = 'completed' WHERE id = $1`, [tripId]);
  }

  // Group chat with a poll on the Goa weekend.
  const goa = await findTripExtras(tripIds['goa-weekend'], client);
  if (goa?.chatRoomId) {
    await message(client, goa.chatRoomId, ids.rahul, 'Hey everyone! Excited for Goa 🌴', 300);
    await message(client, goa.chatRoomId, ids.rahul, 'Should we do scuba diving on Saturday?', 95);
    await message(client, goa.chatRoomId, ids.sneha, 'Yes! 🙌', 90);
    const pollId = await insertPoll(goa.chatRoomId, ids.rahul, 'Scuba diving on Saturday?', ['Yes', 'No'], client);
    const options = await client.query<{ id: string; position: number }>(
      'SELECT id, position FROM chat_poll_options WHERE poll_id = $1 ORDER BY position',
      [pollId],
    );
    for (const voter of ['rahul', 'sneha', 'aman', 'priya', 'vikram']) await upsertVote(pollId, ids[voter], options.rows[0].id, client);
    await upsertVote(pollId, ids.neha, options.rows[1].id, client);
  }

  const manali = await findTripExtras(tripIds.manali, client);
  if (manali?.chatRoomId) {
    await message(client, manali.chatRoomId, ids.aman, 'Pack warm layers, it will be below zero at night ❄️', 600);
    await message(client, manali.chatRoomId, ids.vikram, 'Bringing my drone for the pass!', 580);
  }

  // A trip hosted by the demo account, with join requests waiting.
  const jaipurId = await insertTrip(
    {
      creatorId: demoId,
      title: 'Jaipur Heritage Walk',
      description: 'Forts, bazaars and rooftop dinners in the Pink City.',
      audience: 'History and food lovers',
      destination: 'Jaipur',
      placeId: null,
      country: 'India',
      coverImage: images.jaipur,
      startDate: daysFromNow(30),
      endDate: daysFromNow(32),
      budgetMin: 5000,
      budgetMax: 10000,
      maxMembers: 6,
      activities: ['culture', 'food', 'photography'],
      joinMethod: 'approval',
      latitude: 26.9124,
      longitude: 75.7873,
    },
    client,
  );
  for (const [person, note] of [
    ['priya', 'I’d love to join! I know a great place for dal baati.'],
    ['vikram', 'Can I bring my camera gear? Happy to take group photos.'],
  ] as const) {
    await insertJoinRequest(jaipurId, ids[person], note, client);
    await insertNotification(
      { userId: demoId, kind: 'requests', body: `${PEOPLE.find((p) => p.key === person)!.name.split(' ')[0]} wants to join Jaipur Heritage Walk`, actorId: ids[person], tripId: jaipurId },
      client,
    );
  }

  return tripIds;
}

/** Puts an account on the sample trips, and starts a few direct chats and notifications for it. */
async function enroll(userId: string, ids: Record<string, string>, client: pg.PoolClient) {
  const trips = await client.query<{ id: string; title: string }>(
    'SELECT id, title FROM trips WHERE creator_id = ANY ($1::uuid[])',
    [Object.values(ids)],
  );
  for (const trip of TRIPS.filter((t) => t.enroll)) {
    const row = trips.rows.find((r) => r.title === trip.title);
    if (row) await addMember(row.id, userId, 'member', client);
  }
  await client.query(
    `UPDATE chat_room_members SET last_read_at = now() - interval '2 days' WHERE user_id = $1`,
    [userId],
  );

  const direct: [string, [string | 'me', string, number][]][] = [
    ['sneha', [['sneha', 'Hey! Are you joining the trip?', 75]]],
    ['aman', [['me', 'Manali looks amazing', 200], ['aman', 'Let’s plan the itinerary', 185]]],
    ['priya', [['me', 'Shall we book the same homestay?', 1500], ['priya', 'That sounds great!', 1440]]],
  ];
  for (const [person, messages] of direct) {
    const roomId = await findOrCreateDirectRoom(userId, ids[person], client);
    const existing = await client.query('SELECT 1 FROM chat_messages WHERE room_id = $1 LIMIT 1', [roomId]);
    if (existing.rowCount) continue;
    for (const [sender, body, minutesAgo] of messages) {
      await message(client, roomId, sender === 'me' ? userId : ids[sender], body, minutesAgo);
    }
    await client.query(
      `UPDATE chat_room_members SET last_read_at = now() - interval '2 days' WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId],
    );
  }

  const already = await client.query('SELECT 1 FROM notifications WHERE user_id = $1 AND actor_id = $2', [userId, ids.rahul]);
  if (!already.rowCount) {
    const goaTrip = trips.rows.find((r) => r.title === 'Goa Weekend Escape');
    await insertNotification({ userId, kind: 'requests', body: 'Rahul accepted your join request', actorId: ids.rahul, tripId: goaTrip?.id }, client);
    await insertNotification({ userId, kind: 'trips', body: 'Manali Adventure starts in 5 weeks. Start packing!', actorId: ids.aman, tripId: trips.rows.find((r) => r.title === 'Manali Adventure')?.id }, client);
  }
}

async function main() {
  await runMigrations();
  const extraPhones = process.argv.slice(2).map((phone) => {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized) throw new Error(`Not a valid phone number: ${phone}`);
    return normalized;
  });

  await withTransaction(async (client) => {
    const ids: Record<string, string> = {};
    for (const person of PEOPLE) ids[person.key] = await upsertPerson(person, client);

    const demoId = await upsertPerson(
      {
        key: 'demo', phone: DEMO_PHONE, name: 'Demo Traveler', username: 'demo', picture: 'https://randomuser.me/api/portraits/men/12.jpg',
        age: 27, gender: 'Male', city: 'Delhi, India', profession: 'Software Engineer',
        bio: 'Love exploring new places, meeting new people and capturing beautiful moments. Always up for an adventure!',
        interests: ['trekking', 'beaches', 'photography'],
        industry: 'tech', languages: ['English', 'Hindi'], lookingFor: ['travel_buddies', 'networking'], budget: 'moderate',
        vibe: [4, 4, 3, 2],
        prompts: [
          prompt('ideal_trip', 'Mountains in the morning, a new cafe in the evening, good people all day.'),
          prompt('can_teach_you', 'Night-sky photography with just a phone.'),
        ],
        bucketList: ['Ladakh', 'Spiti Valley', 'Bali'],
      },
      client,
    );

    const seeded = await client.query('SELECT 1 FROM trips WHERE creator_id = $1 LIMIT 1', [ids.rahul]);
    if (seeded.rowCount) {
      console.log('Sample trips already exist; only enrolling accounts.');
    } else {
      await seedContent(ids, demoId, client);
      console.log(`Created ${TRIPS.length + 1} trips with chats, reviews and join requests.`);
    }

    const enrollees = [demoId];
    for (const phone of extraPhones) enrollees.push((await upsertPhoneUser(phone, null, client)).id);
    for (const userId of enrollees) await enroll(userId, ids, client);
    console.log(`Enrolled ${enrollees.length} account(s) on the sample trips.`);
  });
}

try {
  await main();
} finally {
  await pool.end();
}
