import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Favourites live on-device only (no account, privacy-first) exactly like the
// website's gs_saved localStorage list. We keep an in-memory mirror and a set of
// subscribers so every heart on screen updates together.
const KEY = 'gs_saved';
let ids: string[] = [];
let loaded = false;
const subs = new Set<() => void>();

async function ensureLoaded() {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    ids = Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    ids = [];
  }
  loaded = true;
  subs.forEach((fn) => fn());
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(ids)).catch(() => {});
  subs.forEach((fn) => fn());
}

export function getSavedIds(): string[] {
  return ids;
}

export function isSavedNow(id: string): boolean {
  return ids.includes(String(id));
}

// Returns true when the id is now saved.
export function toggleSaved(id: string): boolean {
  id = String(id);
  const at = ids.indexOf(id);
  if (at === -1) ids = [...ids, id];
  else ids = ids.filter((x) => x !== id);
  persist();
  return at === -1;
}

// Hook: current saved-id list, reactive across the app.
export function useSavedIds(): string[] {
  const [snapshot, setSnapshot] = useState<string[]>(ids);
  useEffect(() => {
    const update = () => setSnapshot([...ids]);
    subs.add(update);
    ensureLoaded().then(update);
    return () => {
      subs.delete(update);
    };
  }, []);
  return snapshot;
}

// Hook: is a single id saved, plus a toggle that returns the new state.
export function useSaved(id: string): [boolean, () => boolean] {
  const savedIds = useSavedIds();
  const toggle = useCallback(() => toggleSaved(id), [id]);
  return [savedIds.includes(String(id)), toggle];
}
