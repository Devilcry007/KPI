const CACHE = 'kpi-v3-1';
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});

self.addEventListener('message', e => {
  const data = e.data || {};
  if (data.type === 'notify') {
    self.registration.showNotification(data.title || 'KPI', {
      body: data.body || '',
      icon: './icon.svg',
      badge: './icon.svg',
      tag: 'kpi-alarm',
      renotify: true,
      data: { url: self.registration.scope }
    });
  }
  if (data.type === 'updateConfig' && Array.isArray(data.times)) {
    self.__alarmTimes = data.times;
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.registration.scope) && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(self.registration.scope);
    })
  );
});

// Best-effort: попытаться проверить время при периодическом пробуждении
self.addEventListener('periodicsync', e => {
  if (e.tag === 'kpi-alarm-check') {
    e.waitUntil(checkAndFire());
  }
});

async function checkAndFire() {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  const nowMin = h * 60 + m;
  const alarms = self.__alarmTimes || ['13:00', '15:00'];
  for (const t of alarms) {
    const [th, tm] = t.split(':').map(Number);
    const tMin = th * 60 + tm;
    if (Math.abs(nowMin - tMin) <= 15) {
      await self.registration.showNotification('⏰ Время сверить темп', {
        body: 'Загляни в KPI Journal — сейчас хороший момент.',
        icon: './icon.svg',
        tag: 'kpi-alarm',
        renotify: true,
        data: { url: self.registration.scope }
      });
      return;
    }
  }
}