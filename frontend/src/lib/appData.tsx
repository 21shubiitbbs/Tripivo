import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BudgetKey, GroupSizeKey } from './api';
import { getItem, setItem } from './storage';

// App-wide UI state that isn't stored by the API: the search filters and this device's recent
// searches. Trips, chats and everything else are loaded from the API by each screen.

export type SearchFilters = {
  destination: string;
  from: string;
  to: string;
  groupSize: GroupSizeKey | null;
  budget: BudgetKey | null;
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
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
};

const RECENT_KEY = 'tripivo.recentSearches';
const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    getItem(RECENT_KEY).then((stored) => {
      try {
        const parsed = JSON.parse(stored ?? '[]');
        if (Array.isArray(parsed)) setRecentSearches(parsed.filter((item) => typeof item === 'string'));
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
      addRecentSearch: (query) =>
        setRecentSearches((current) => {
          const next = [query, ...current.filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, 6);
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
