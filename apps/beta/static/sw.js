const CACHE = 'velvet-beta-shell-v21';
// Les caches v18 à v20 sont supprimés à l’activation afin de ne jamais conserver
// l’ancienne navigation latérale ni la couche people-first qui ignorait media_assets.
const APP_SHELL = [
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
  '/assets/velvet-experience-management.css?v=20260731-1',
  '/assets/velvet-experience-management.js?v=20260731-1',
  '/assets/velvet-interaction-recovery.css?v=20260801-1',
  '/assets/velvet-interaction-recovery.js?v=20260801-1',
  '/assets/velvet-web-ios-parity.css?v=20260802-2',
  '/assets/velvet-web-ios-parity.js?v=20260802-2',
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

function offlineDocument() {
  return new Response(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Velvet hors connexion</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b080a;color:#f6eee6;font-family:-apple-system,BlinkMacSystemFont,sans-serif"><main style="max-width:420px;padding:28px;text-align:center"><h1 style="font-family:Georgia,serif;font-weight:500">Velvet est hors connexion.</h1><p style="color:#b9adb1;line-height:1.6">Rétablis ta connexion puis rouvre l’application. Aucune ancienne page authentifiée n’est conservée.</p></main></body></html>`, {
    status: 503,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  const documentRequest = event.request.mode === 'navigate'
    || event.request.destination === 'document'
    || event.request.headers.get('accept')?.includes('text/html');

  if (documentRequest) {
    event.respondWith(fetch(event.request, { cache: 'no-store', credentials: 'same-origin', redirect: 'follow' }).catch(offlineDocument));
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store', credentials: 'same-origin' })
      .then((response) => {
        if (response.ok && !response.redirected) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || Response.error()))
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'VELVET_CLEAR_CACHES') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))));
    return;
  }
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
  try { payload = event.data?.json?.() || {}; }
  catch { payload = { body: event.data?.text?.() || '' }; }
  const notification = payload.notification || payload;
  const conversationId = payload.conversationId || notification.conversationId || '';
  const profileId = payload.profileId || notification.profileId || '';
  const eventId = payload.eventId || notification.eventId || '';
  let destination = notification.navigate || payload.url || '/membres/';
  if (conversationId) destination = `/membres/?route=conversations&conversation=${encodeURIComponent(conversationId)}`;
  else if (profileId) destination = `/membres/?route=discover&profile=${encodeURIComponent(profileId)}`;
  else if (eventId) destination = `/membres/?route=events&event=${encodeURIComponent(eventId)}`;
  event.waitUntil(self.registration.showNotification(notification.title || 'Velvet', {
    body: notification.body || 'Une nouvelle activité vous attend.',
    icon: notification.icon || '/assets/velvet-icon-192.png',
    badge: notification.badge || '/assets/velvet-icon-192.png',
    image: notification.image || undefined,
    tag: notification.tag || 'velvet-push',
    renotify: notification.renotify !== false,
    requireInteraction: notification.requireInteraction === true,
    data: { url: destination, conversationId: conversationId || null, profileId: profileId || null, eventId: eventId || null }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destination = event.notification.data?.url || '/membres/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.focus();
      return existing.navigate(destination);
    }
    return self.clients.openWindow(destination);
  }));
});