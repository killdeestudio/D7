/* 오프라인 실행: 네트워크 우선, 실패하면 캐시 (재난 상황에서도 열리도록)
 * 새 버전을 올리면 온라인일 때 바로 받아오고, 오프라인이면 마지막으로 받은 버전을 쓴다. */
const CACHE = 'd7-v2';
const FILES = ['./', 'index.html', 'css/style.css', 'js/data.js', 'js/engine.js', 'js/region.js',
  'js/i18n-en.js', 'js/sound.js', 'js/ui.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
