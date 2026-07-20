import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchListings } from './api';
import { Listing } from './types';
import { useAuth } from './auth';

// Loads the browse feed with the four states the UI needs: initial loading,
// error, the data itself, and a pull-to-refresh flag. Listings from users the
// viewer has blocked are hidden instantly (Apple Guideline 1.2).
export function useListings() {
  const { blockedIds } = useAuth();
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

  const visible = useMemo(
    () => (blockedIds.size === 0 ? listings : listings.filter((l) => !l.owner_id || !blockedIds.has(l.owner_id))),
    [listings, blockedIds],
  );

  return {
    listings: visible,
    loading,
    error,
    refreshing,
    refresh: () => load(true),
    reload: () => load(false),
  };
}
