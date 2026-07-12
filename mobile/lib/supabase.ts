import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Same backend as the website (config.js). The anon key is intentionally public;
// Row Level Security on the database enforces what an anonymous visitor can do.
// Do NOT stand up a new project: this is the shared GreenShelf Supabase.
export const SUPABASE_URL = 'https://wvladknkebqiqutboohw.supabase.co';
export const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2bGFka25rZWJxaXF1dGJvb2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTAxMjksImV4cCI6MjA5MzEyNjEyOX0.xHIZHgUQ72XRxHtQkHBJ4AbI7M9shejCPR5iv5SmqJ4';

export const PHOTO_BUCKET = 'book-photos';

// iOS kills idle keep-alive sockets and the next request on one dies with
// "The network connection was lost" (error -1005) before any bytes arrive.
// Apple's reviewer hit exactly that on Sign in. Safe to retry: the request
// never reached the server. Real HTTP responses are returned as-is, and only
// the network-level TypeError ("fetch failed" / connection lost) is retried.
const FETCH_TIMEOUT_MS = 15000;
const FETCH_RETRIES = 2;

async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      return await fetch(input, { ...init, signal: init?.signal ?? controller.signal });
    } catch (e) {
      lastError = e;
      // Only a network-level TypeError (socket died before any response) is
      // provably safe to retry. Aborts and timeouts are not: the request may
      // have reached the server, so retrying could double-submit.
      const retryable = e instanceof TypeError && attempt < FETCH_RETRIES && !init?.signal?.aborted;
      if (!retryable) throw e;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { fetch: resilientFetch },
  auth: {
    // On native there is no browser URL to parse, and the session must survive
    // the app being killed, so persist through AsyncStorage (native storage).
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
