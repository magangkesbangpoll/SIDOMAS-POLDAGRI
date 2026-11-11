// Service worker SIDOMAS: menerima notifikasi HP (Web Push) untuk admin.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(
    self.registration.showNotification(d.title || 'SIDOMAS', {
      body: d.body || 'Ada pembaruan baru.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag || 'sidomas',
      renotify: true,
      data: { url: d.url || '/admin/notifikasi' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin/notifikasi';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); } }
      return self.clients.openWindow(url);
    }),
  );
});
