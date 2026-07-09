const CACHE_NAME = 'greenshelf-v38';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/native.js',
  '/config.js',
  '/vendor/supabase.js',
  '/fonts/fraunces-latin.woff2',
  '/fonts/fraunces-italic-latin.woff2',
  '/fonts/inter-latin.woff2',
  '/motion.js',
  '/404.html',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

// Install: cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network first for API/Supabase, cache first for static
self.addEventListener('fetch', (event) => {
  // The cache only ever holds GET responses; let everything else pass through
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Always go to network for Supabase calls (exact host match, not substring)
  if (url.hostname === 'supabase.co' || url.hostname.endsWith('.supabase.co')) {
    return; // let browser handle normally
  }

  // Network-first for HTML (so you get fresh updates)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first with background revalidation: serve instantly from cache,
  // then quietly refresh the stored copy from the network. Updates (including
  // security fixes) reach returning visitors even between CACHE_NAME bumps.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fresh = fetch(event.request).then((resp) => {
        if (resp && resp.ok && resp.type === 'basic') {
          const copy = resp.clone();
          // waitUntil keeps the worker alive until the refreshed copy is stored
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
        }
        return resp;
      });
      if (cached) {
        // Serve instantly; let the refresh finish in the background, ignore failures
        event.waitUntil(fresh.then(() => {}, () => {}));
        return cached;
      }
      // Nothing cached: network is the only source. respondWith must receive a
      // Response, so surface a proper network error instead of undefined.
      return fresh.catch(() => Response.error());
    })
  );
});
