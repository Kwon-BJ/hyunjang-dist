// 병무청 홈페이지 앱(설치) — "홈페이지 앱으로 다운받을 수 있게" (2026-10-26)
// 화면은 늘 인터넷에서 새로 받는다(새 판이 바로 보이게). 인터넷이 안 될 때만 마지막으로 받은 화면 · 그림을 보여 준다.
// 창구(워커) · 글꼴 같은 바깥 주소는 건드리지 않는다.
const CACHE = 'bmc-app-1';
const HOME = new URL('./', self.registration.scope).href;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('bmc-app-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || !r.url.startsWith(HOME)) return;
  const page = r.mode === 'navigate', keep = page || /\/img\/[^?]+$/.test(new URL(r.url).pathname);
  if (!keep) return;
  const key = page ? HOME : r;
  e.respondWith(fetch(r).then((res) => {
    // 그림 주소에 판 번호(?v=)가 붙어 판마다 새로 저장된다 — 같은 그림의 예전 판은 지운다 (2026-10-26)
    if (res.ok) { const copy = res.clone(), path = new URL(r.url).pathname; e.waitUntil(caches.open(CACHE).then(async (c) => { if (!page) for (const k of await c.keys()) if (new URL(k.url).pathname === path && k.url !== r.url) await c.delete(k); await c.put(key, copy); })); }
    return res;
  }).catch(() => caches.match(key).then((m) => m || (page ? caches.match(HOME) : undefined)).then((m) => m || Response.error())));
});
