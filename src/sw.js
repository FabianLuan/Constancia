// Cache para abrir la app sin conexión. Firestore maneja sus propios datos sin conexión.
const C = 'constancia-v3';
const CORE = ['./', 'index.html', 'sync.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const ok = u.origin === location.origin || /(^|\.)gstatic\.com$|fonts\.googleapis\.com$/.test(u.hostname);
  if (!ok || u.pathname.startsWith('/__/') || /googleapis\.com$/.test(u.hostname) && !/fonts\./.test(u.hostname)) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; })
    .catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});

// Avisos de hábitos enviados por Firebase Cloud Messaging (mensajes de datos).
self.addEventListener('push', e => {
  let p = {}; try { p = e.data ? e.data.json() : {}; } catch (err) { p = { data: { body: e.data && e.data.text() } }; }
  const d = p.data || p.notification || {};
  e.waitUntil(self.registration.showNotification(d.title || 'Constancia', { body: d.body || '', tag: d.tag, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => 'focus' in x);
    return c ? c.focus() : self.clients.openWindow((e.notification.data && e.notification.data.url) || './');
  }));
});
