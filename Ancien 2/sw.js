// ═══════════════════════════════════
// SERVICE WORKER — Cache offline
// ═══════════════════════════════════

const CACHE = "catsitting-v1";
const FILES = [
  "/",
  "/index.html",
  "/accueil.html",
  "/calendrier.html",
  "/fiche.html",
  "/prestation.html",
  "/message.html",
  "/messages.html",
  "/style.css",
  "/storage.js",
  "/login.js",
  "/accueil.js",
  "/calendrier.js",
  "/fiche.js",
  "/prestation.js",
  "/message.js"
];

// Installation — mise en cache de tous les fichiers
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

// Activation — supprime les anciens caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — sert depuis le cache, sinon réseau
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
