/*
 * Service worker PromptBuilder (M4) — chiến lược ĐƠN GIẢN, an toàn với Vite:
 *  - KHÔNG precache (tránh giữ bundle cũ sau mỗi lần deploy).
 *  - Điều hướng (HTML): network-first, offline thì trả bản cache gần nhất.
 *  - Asset build có hash (/assets/*): cache-first — tên file đổi theo nội dung
 *    nên cache không bao giờ ôi.
 *  - Còn lại: mặc định qua mạng.
 * Dữ liệu Firestore đã có IndexedDB persistence riêng (firebase.ts) lo phần offline.
 */
const CACHE = 'pb-runtime-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // không đụng Firebase/API bên ngoài
  if (url.pathname.startsWith('/api/')) return;    // API luôn qua mạng

  // Điều hướng: network-first + fallback cache khi offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return resp;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Asset có hash: cache-first.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname === '/favicon.png') {
    event.respondWith(
      caches.match(request).then((hit) => {
        if (hit) return hit;
        return fetch(request).then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return resp;
        });
      })
    );
  }
});
