/* ============================================
   CAT SITTING — sw.js
   Service worker : mise en cache pour usage hors-ligne
   Stratégie : réseau en priorité (network-first), cache en secours
   ============================================ */

const CACHE_NAME = "cat-sitting-v6";
const FILES_TO_CACHE = [
  "./index.html",
  "./login.js",
  "./accueil.html",
  "./accueil.js",
  "./calendrier.html",
  "./calendrier.js",
  "./fiche.html",
  "./fiche.js",
  "./prestation.html",
  "./prestation.js",
  "./ajour.html",
  "./ajour.js",
  "./admin.html",
  "./admin.js",
  "./message.html",
  "./messages.html",
  "./style.css",
  "./storage.js",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Network-first : on va toujours chercher la dernière version sur le réseau.
   On ne retombe sur le cache que si le réseau est indisponible (hors-ligne). */
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
