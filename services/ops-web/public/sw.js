/**
 * RNOS-41 / WIN-1 — PWA service worker (push only).
 *
 * Safari/WebKit fails navigations with:
 *   "Response served by service worker has redirections"
 * when the SW returns a redirected Response for mode=navigate.
 * Do NOT intercept navigations — let the browser handle redirects to /login.
 */
const CACHE = 'ptt-ops-pwa-v6';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('push', (event) => {
  const payload = (() => {
    try {
      return event.data?.json() ?? {};
    } catch {
      return { title: 'PTT CRM', body: event.data?.text() ?? 'Lead B2B mới' };
    }
  })();
  const title = payload.title ?? 'PTT CRM';
  const options = {
    body: payload.body ?? 'Lead B2B mới',
    data: payload.data ?? {},
    icon: '/icons/icon-192.png',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? '/crm/b2b/leads';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

// Intentionally no fetch handler for navigations.
self.addEventListener('fetch', () => {
  /* network default — avoids Safari redirect error */
});
