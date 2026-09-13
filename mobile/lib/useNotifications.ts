import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { fetchUnreadCount } from './api';
import { useAuth } from './auth';

// Unread inbox count for the bell badge. Polled when the app comes to the
// foreground and on demand; there is no push yet, so this is what "alerts"
// look like until the app is opened.
export function useUnreadCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    try {
      setCount(await fetchUnreadCount(user.id));
    } catch {
      /* table missing or offline: keep the last known value */
    }
  }, [user]);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { count, refresh, setCount };
}
