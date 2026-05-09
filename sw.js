// ══════════════════════════════════════════════════════════════
//  sw.js — Service Worker · Wello Chat PWA
//  Stratégie : Cache-first pour assets statiques,
//              Network-first pour Firebase/API
// ══════════════════════════════════════════════════════════════

const CACHE_NAME = 'wello-chat-v1';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 jours

// Assets à mettre en cache dès l'installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // Fonts Google (mise en cache au premier accès via runtime cache)
];

// URLs à ne JAMAIS mettre en cache (Firebase, signalisation)
const BYPASS_PATTERNS = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'firebasestorage.googleapis.com',
  'gstatic.com/firebasejs',
  'googleapis.com',
  'cdn.tailwindcss.com',
];

// ── INSTALL : pré-cache des assets statiques ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('[SW] Précache partiel :', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE : nettoyage des anciens caches ────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH : stratégie de cache ─────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Ne pas intercepter les requêtes non-GET
  if (event.request.method !== 'GET') return;

  // Ne pas intercepter Firebase / CDN dynamiques
  if (BYPASS_PATTERNS.some(p => url.includes(p))) return;

  // Ne pas intercepter les extensions Chrome
  if (url.startsWith('chrome-extension://')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Revalider en arrière-plan (stale-while-revalidate)
        fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, response.clone());
            });
          }
        }).catch(() => {});
        return cached;
      }

      // Pas en cache → réseau
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        // Mettre en cache la réponse
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(() => {
        // Hors-ligne : retourner index.html (SPA fallback)
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ── PUSH (futur : notifications) ──────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body || 'Nouveau message',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'dismiss', title: 'Ignorer' }
    ]
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Wello Chat', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data.url;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
