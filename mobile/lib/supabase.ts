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

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // On native there is no browser URL to parse, and the session must survive
    // the app being killed, so persist through AsyncStorage (native storage).
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
