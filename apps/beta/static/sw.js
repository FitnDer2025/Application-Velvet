const CACHE = 'velvet-beta-shell-v1';
const APP_SHELL = [
  '/membres/',
  '/assets/members-live.css',
  '/assets/members-live.js',
  '/assets/velvet-icon.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/membres/')))
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'VELVET_NOTIFICATION') return;
  event.waitUntil(self.registration.showNotification(event.data.title || 'Velvet', {
    body: event.data.body || 'Une nouvelle activité vous attend.',
    icon: '/assets/velvet-icon.svg',
    badge: '/assets/velvet-icon.svg',
    tag: event.data.tag || 'velvet-update',
    data: { url: event.data.url || '/membres/' }
  }));
});

self.addEventListener('push', (event) => {
  const payload = event.data?.json?.() || {};
  event.waitUntil(self.registration.showNotification(payload.title || 'Velvet', {
    body: payload.body || 'Une nouvelle activité vous attend.',
    icon: '/assets/velvet-icon.svg',
    badge: '/assets/velvet-icon.svg',
    tag: payload.tag || 'velvet-push',
    data: { url: payload.url || '/membres/' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destination = event.notification.data?.url || '/membres/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      return existing ? existing.focus().then(() => existing.navigate(destination)) : self.clients.openWindow(destination);
    })
  );
});
