import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

type QueryState<T> = {
  data: T | undefined;
  error: string | null;
  /** True until the first response (or error) for the current key arrives. */
  loading: boolean;
  /** Fetches again, keeping the current data on screen meanwhile. */
  reload: () => Promise<void>;
  /** Replaces the data locally, e.g. with a response from a mutation. */
  setData: (data: T) => void;
};

type QueryOptions = {
  /** Also refetch every `pollMs` while the screen is focused (e.g. chat). */
  pollMs?: number;
  /** Skip fetching until true. */
  enabled?: boolean;
};

type Result<T> = { key: string; data: T | undefined; error: string | null; settled: boolean };

/**
 * Loads `fetcher()` when the screen gains focus, and again whenever `key` changes, so data is
 * fresh after navigating back to a screen. Results are tagged with the key they were fetched
 * for, so a changed key shows the loading state rather than the previous key's data.
 */
export function useQuery<T>(key: string, fetcher: () => Promise<T>, options: QueryOptions = {}): QueryState<T> {
  const { pollMs, enabled = true } = options;
  const [result, setResult] = useState<Result<T>>({ key, data: undefined, error: null, settled: false });
  const fetcherRef = useRef(fetcher);
  const keyRef = useRef(key);
  const requestId = useRef(0);

  // Declared before the focus effect so a refetch always uses the latest fetcher and key.
  useEffect(() => {
    fetcherRef.current = fetcher;
    keyRef.current = key;
  });

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    const forKey = keyRef.current;
    try {
      const data = await fetcherRef.current();
      if (id === requestId.current) setResult({ key: forKey, data, error: null, settled: true });
    } catch (fetchError) {
      if (id !== requestId.current) return;
      const error = fetchError instanceof Error ? fetchError.message : 'Something went wrong';
      setResult((previous) => ({
        key: forKey,
        data: previous.key === forKey ? previous.data : undefined,
        error,
        settled: true,
      }));
    }
  }, []);

  const setData = useCallback((data: T) => {
    setResult({ key: keyRef.current, data, error: null, settled: true });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      void reload();
      if (!pollMs) return;
      const timer = setInterval(() => void reload(), pollMs);
      return () => clearInterval(timer);
      // `key` is included so a changed key refetches even while focused.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, enabled, pollMs, reload]),
  );

  const isCurrent = result.key === key;
  return {
    data: isCurrent ? result.data : undefined,
    error: isCurrent ? result.error : null,
    loading: !isCurrent || !result.settled,
    reload,
    setData,
  };
}
