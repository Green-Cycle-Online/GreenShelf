import { useCallback, useEffect, useState } from 'react';
import { fetchSchools } from './api';
import { School } from './types';

// One shared in-memory copy so the create form, filters, profile and admin
// screen do not each hit the network. Refresh after an admin edit.
let cache: School[] | null = null;
let inflight: Promise<School[]> | null = null;
const listeners = new Set<(s: School[]) => void>();

function load(force = false): Promise<School[]> {
  if (cache && !force) return Promise.resolve(cache);
  if (inflight && !force) return inflight;
  inflight = fetchSchools()
    .then((s) => {
      cache = s;
      listeners.forEach((fn) => fn(s));
      return s;
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

export function useSchools() {
  const [schools, setSchools] = useState<School[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    listeners.add(setSchools);
    load()
      .then(setSchools)
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => {
      listeners.delete(setSchools);
    };
  }, []);

  const refresh = useCallback(() => load(true).then(setSchools).catch(() => {}), []);

  return { schools, active: schools.filter((s) => s.is_active), loading, refresh };
}
