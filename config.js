// Shared GreenShelf runtime config. Public values only.
// The Supabase anon key is intentionally public: row-level security on the
// database enforces what an anonymous visitor can read or write. Keeping the
// URL and key here means rotating them is a one file change, with no copies
// drifting across the app.
window.GS_CONFIG = {
  SUPABASE_URL: 'https://wvladknkebqiqutboohw.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2bGFka25rZWJxaXF1dGJvb2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTAxMjksImV4cCI6MjA5MzEyNjEyOX0.xHIZHgUQ72XRxHtQkHBJ4AbI7M9shejCPR5iv5SmqJ4'
}
