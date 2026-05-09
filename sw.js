// ══════════════════════════════════════════════════════════════
//  sw.js — Service Worker · Wello Chat PWA
//  Compatible GitHub Pages (/wellochat/ subfolder)
// ══════════════════════════════════════════════════════════════

const CACHE_NAME = 'wello-chat-v2';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './favicon-96x96.png',
  './web-app-manifest-192x192.png',
  './web-app-manifest-512x512.png',
  './Logo_Wello_Chat_2.png',
];

const BYPASS_PATTERNS = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'googleapis.com',
  'cloudinary.com',
  'gstatic.com',
  'cdn.tailwindcss.com',
  'unpkg.com',
];

// ── INSTALL ────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('[SW] Précache partiel :', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ───────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ──────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (event.request.method !== 'GET') return;
  if (BYPASS_PATTERNS.some(p => url.includes(p))) return;
  if (url.startsWith('chrome-extension://')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      // Revalider en arrière-plan
      const fetchPromise = fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => cached); // hors-ligne → cache

      return cached || fetchPromise;
    })
  );
});
