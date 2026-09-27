import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { seedChats, seedTrips, type ChatRoom, type JoinMethod, type Trip } from '../data/mock';

// Trips, saved trips, the user's own trips and chats. All of it is in-memory sample data until
// the backend has endpoints for it, so changes are lost when the app restarts.

export type MyTripStatus = 'upcoming' | 'active' | 'completed';

export type MyTrip = {
  tripId: string;
  status: MyTripStatus;
  role: 'hosting' | 'joined' | 'requested';
  next?: string;
};

export type SearchFilters = {
  destination: string;
  from: string;
  to: string;
  groupSize: string | null;
  budget: string | null;
  interests: string[];
};

export const emptyFilters: SearchFilters = {
  destination: '',
  from: '',
  to: '',
  groupSize: null,
  budget: null,
  interests: [],
};

type AppData = {
  trips: Trip[];
  tripById: (id: string) => Trip | undefined;
  savedTripIds: string[];
  toggleSaved: (tripId: string) => void;
  myTrips: MyTrip[];
  joinTrip: (tripId: string, method: JoinMethod) => void;
  /** The group chat of a trip, if the user can see one. */
  chatIdFor: (tripId: string) => string | null;
  publishTrip: (trip: Trip) => void;
  chats: ChatRoom[];
  sendMessage: (roomId: string, senderId: string, text: string) => void;
  vote: (roomId: string, optionIndex: number) => void;
  votes: Record<string, number>;
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
};

const AppDataContext = createContext<AppData | null>(null);

function chatFor(trip: Trip): ChatRoom {
  return {
    id: trip.id,
    name: trip.title,
    avatar: trip.image,
    isGroup: true,
    memberCount: trip.joined,
    lastMessage: 'Say hi to your travel group 👋',
    lastTime: 'Now',
    unread: 0,
    messages: [],
  };
}

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>(seedTrips);
  const [savedTripIds, setSavedTripIds] = useState<string[]>(['goa-weekend']);
  const [myTrips, setMyTrips] = useState<MyTrip[]>([
    { tripId: 'goa-weekend', status: 'upcoming', role: 'joined', next: 'Next: Beach Day' },
    { tripId: 'manali-adventure', status: 'upcoming', role: 'joined' },
    { tripId: 'rishikesh-retreat', status: 'upcoming', role: 'joined' },
    { tripId: 'south-goa', status: 'completed', role: 'joined' },
  ]);
  const [chats, setChats] = useState<ChatRoom[]>(seedChats);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const [recentSearches, setRecentSearches] = useState(['Goa', 'Manali', 'Bali', 'Jaipur']);

  const value = useMemo<AppData>(
    () => ({
      trips,
      tripById: (id) => trips.find((trip) => trip.id === id),
      savedTripIds,
      toggleSaved: (tripId) =>
        setSavedTripIds((ids) => (ids.includes(tripId) ? ids.filter((id) => id !== tripId) : [...ids, tripId])),
      myTrips,
      chatIdFor: (tripId) => (chats.some((room) => room.id === tripId) ? tripId : null),
      joinTrip: (tripId, method) => {
        const trip = trips.find((t) => t.id === tripId);
        if (trip && method === 'open' && !chats.some((room) => room.id === tripId)) {
          setChats((current) => [chatFor(trip), ...current]);
        }
        setMyTrips((current) => [
          { tripId, status: 'upcoming', role: method === 'open' ? 'joined' : 'requested' },
          ...current.filter((entry) => entry.tripId !== tripId),
        ]);
        if (method === 'open') {
          setTrips((current) =>
            current.map((trip) => (trip.id === tripId ? { ...trip, joined: trip.joined + 1 } : trip)),
          );
        }
      },
      publishTrip: (trip) => {
        setTrips((current) => [trip, ...current]);
        setMyTrips((current) => [{ tripId: trip.id, status: 'upcoming', role: 'hosting' }, ...current]);
        setChats((current) => [chatFor(trip), ...current]);
      },
      chats,
      sendMessage: (roomId, senderId, text) => {
        const time = timeNow();
        setChats((current) =>
          current.map((room) =>
            room.id === roomId
              ? {
                  ...room,
                  lastMessage: `You: ${text}`,
                  lastTime: time,
                  messages: [...room.messages, { id: `${Date.now()}`, senderId, text, time }],
                }
              : room,
          ),
        );
      },
      vote: (roomId, optionIndex) => setVotes((current) => ({ ...current, [roomId]: optionIndex })),
      votes,
      filters,
      setFilters,
      recentSearches,
      addRecentSearch: (query) =>
        setRecentSearches((current) => [query, ...current.filter((item) => item !== query)].slice(0, 6)),
    }),
    [trips, savedTripIds, myTrips, chats, votes, filters, recentSearches],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const data = useContext(AppDataContext);
  if (!data) throw new Error('useAppData must be used inside <AppDataProvider>.');
  return data;
}
