// service-worker.js — EB Bernas Portal PWA offline support
// ⚠️ ILAGAY SA public/ FOLDER.
// Nagbibigay ng offline capability: pagkatapos ng unang online load,
// gagana na ang app kahit walang internet. Ang Firebase/Firestore ay may
// sariling offline persistence, kaya hindi ito kino-cache dito.

const CACHE = 'ebbernas-portal-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Huwag i-cache ang Firebase/Firestore/Google requests — may sariling offline sila
function isFirebaseOrGoogle(href) {
  return /firebaseio|firestore|googleapis|gstatic|firebaseapp|identitytoolkit|google-analytics|telegram/.test(href);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (isFirebaseOrGoogle(url.href)) return; // hayaan sa network / Firestore cache

  // Navigation (pagbukas ng page): network-first, fallback sa naka-cache na shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req)
            .then((r) => r || caches.match('./'))
            .then((r) => r || caches.match('/index.html'))
        )
    );
    return;
  }

  // Static assets (JS, CSS, images): stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
