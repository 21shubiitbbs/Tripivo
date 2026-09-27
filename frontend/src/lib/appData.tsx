import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BudgetKey, GroupSizeKey } from './api';
import { getItem, setItem } from './storage';

// App-wide UI state that isn't stored by the API: the search filters and this device's recent
// searches. Trips, chats and everything else are loaded from the API by each screen.

/** A destination picked from place search. */
export type PlaceRef = { id: string; name: string };

/** A recent search: free text, or a place from search. */
export type RecentSearch = { label: string; placeId?: string; subtitle?: string | null };

export type SearchFilters = {
  destination: PlaceRef | null;
  from: string;
  to: string;
  groupSize: GroupSizeKey | null;
  budget: BudgetKey | null;
  interests: string[];
};

export const emptyFilters: SearchFilters = {
  destination: null,
  from: '',
  to: '',
  groupSize: null,
  budget: null,
  interests: [],
};

type AppData = {
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  recentSearches: RecentSearch[];
  addRecentSearch: (search: RecentSearch) => void;
};

const RECENT_KEY = 'tripivo.recentSearches';
const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    getItem(RECENT_KEY).then((stored) => {
      try {
        const parsed: unknown = JSON.parse(stored ?? '[]');
        if (!Array.isArray(parsed)) return;
        // Older versions stored plain strings.
        setRecentSearches(
          parsed.flatMap((item): RecentSearch[] =>
            typeof item === 'string'
              ? [{ label: item }]
              : item && typeof item === 'object' && typeof item.label === 'string'
                ? [item as RecentSearch]
                : [],
          ),
        );
      } catch {
        // Ignore a corrupt value; it is replaced on the next search.
      }
    });
  }, []);

  const value = useMemo<AppData>(
    () => ({
      filters,
      setFilters,
      recentSearches,
      addRecentSearch: (search) =>
        setRecentSearches((current) => {
          const same = (item: RecentSearch) =>
            search.placeId ? item.placeId === search.placeId : !item.placeId && item.label.toLowerCase() === search.label.toLowerCase();
          const next = [search, ...current.filter((item) => !same(item))].slice(0, 6);
          void setItem(RECENT_KEY, JSON.stringify(next));
          return next;
        }),
    }),
    [filters, recentSearches],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const data = useContext(AppDataContext);
  if (!data) throw new Error('useAppData must be used inside <AppDataProvider>.');
  return data;
}
