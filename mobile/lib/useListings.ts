import { useCallback, useEffect, useState } from 'react';
import { fetchListings } from './api';
import { Listing } from './types';

// Loads the browse feed with the four states the UI needs: initial loading,
// error, the data itself, and a pull-to-refresh flag.
export function useListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const data = await fetchListings();
      setListings(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    listings,
    loading,
    error,
    refreshing,
    refresh: () => load(true),
    reload: () => load(false),
  };
}
