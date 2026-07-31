const CACHE = 'velvet-beta-shell-v16';
const APP_SHELL = [
  '/membres/',
  '/assets/members-live.css',
  '/assets/members-live.js',
  '/assets/members-onboarding-v2.css',
  '/assets/members-onboarding-v2.js',
  '/assets/velvet-premium-ui.css',
  '/assets/velvet-premium-ui.js',
  '/assets/velvet-editorial-ui.css',
  '/assets/velvet-messaging-upgrade.css?v=20260731-5',
  '/assets/velvet-messaging-upgrade.js?v=20260731-5',
  '/assets/velvet-mobile-feed-hotfix.css?v=20260731-5',
  '/assets/velvet-mobile-feed-hotfix.js?v=20260731-5',
  '/assets/velvet-chat-whatsapp.css?v=20260731-1',
  '/assets/velvet-chat-whatsapp.js?v=20260731-1',
  '/assets/velvet-mobile-viewport-guard.css?v=20260731-2',
  '/assets/velvet-mobile-viewport-guard.js?v=20260731-2',
  '/assets/velvet-social-interactions-hotfix.css?v=20260731-1',
  '/assets/velvet-social-interactions-hotfix.js?v=20260731-1',
  '/assets/velvet-social-realtime.css?v=20260731-1',
  '/assets/velvet-social-realtime.js?v=20260731-1',
  '/assets/velvet-realtime-reconcile.js?v=20260731-1',
  '/assets/velvet-push-deeplink.js?v=20260731-1',
  '/assets/pwa-ios.js',
  '/assets/photo-protection.js?v=20260731-5',
  '/assets/location-verification.js',
  '/assets/velvet-icon-180.png',
  '/assets/velvet-icon-192.png',
  '/assets/velvet-icon-512.png',
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
    fetch(event.request, { cache: 'no-store' })
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
    icon: '/assets/velvet-icon-192.png',
    badge: '/assets/velvet-icon-192.png',
    image: event.data.image || undefined,
    tag: event.data.tag || 'velvet-update',
    renotify: true,
    data: { url: event.data.url || '/membres/' }
  }));
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json?.() || {};
  } catch {
    payload = { body: event.data?.text?.() || '' };
  }
  const declarative = payload.notification || payload;
  const conversationId = payload.conversationId || declarative.conversationId || '';
  const profileId = payload.profileId || declarative.profileId || '';
  const eventId = payload.eventId || declarative.eventId || '';
  let destination = declarative.navigate || payload.url || '/membres/';
  if (conversationId) {
    destination = `/membres/?route=conversations&conversation=${encodeURIComponent(conversationId)}`;
  } else if (profileId) {
    destination = `/membres/?route=discover&profile=${encodeURIComponent(profileId)}`;
  } else if (eventId) {
    destination = `/membres/?route=events&event=${encodeURIComponent(eventId)}`;
  }
  event.waitUntil(self.registration.showNotification(declarative.title || 'Velvet', {
    body: declarative.body || 'Une nouvelle activité vous attend.',
    icon: declarative.icon || '/assets/velvet-icon-192.png',
    badge: declarative.badge || '/assets/velvet-icon-192.png',
    image: declarative.image || undefined,
    tag: declarative.tag || 'velvet-push',
    renotify: declarative.renotify !== false,
    requireInteraction: declarative.requireInteraction === true,
    data: {
      url: destination,
      route: payload.route || null,
      conversationId: conversationId || null,
      profileId: profileId || null,
      eventId: eventId || null
    }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destination = event.notification.data?.url || '/membres/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        await existing.focus();
        return existing.navigate(destination);
      }
      return self.clients.openWindow(destination);
    })
  );
});
