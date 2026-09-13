import { useCallback, useEffect, useState } from 'react';

// One shared in-memory copy per admin-managed list (schools, areas) so the
// create forms, filters, profile and admin screen do not each hit the network.
// Call refresh() after an admin edit. Returns a hook.
export function createCachedList<T>(fetcher: () => Promise<T[]>) {
  let cache: T[] | null = null;
  let inflight: Promise<T[]> | null = null;
  const listeners = new Set<(rows: T[]) => void>();

  function load(force = false): Promise<T[]> {
    if (cache && !force) return Promise.resolve(cache);
    if (inflight && !force) return inflight;
    inflight = fetcher()
      .then((rows) => {
        cache = rows;
        listeners.forEach((fn) => fn(rows));
        return rows;
      })
      .catch((e) => {
        // Table not migrated yet, or offline: behave as "no list" rather than crash.
        if (!cache) cache = [];
        throw e;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  }

  return function useCachedList() {
    const [rows, setRows] = useState<T[]>(cache ?? []);
    const [loading, setLoading] = useState(!cache);

    useEffect(() => {
      listeners.add(setRows);
      load()
        .then(setRows)
        .catch(() => {})
        .finally(() => setLoading(false));
      return () => {
        listeners.delete(setRows);
      };
    }, []);

    const refresh = useCallback(() => load(true).then(setRows).catch(() => {}), []);

    return { rows, loading, refresh };
  };
}
