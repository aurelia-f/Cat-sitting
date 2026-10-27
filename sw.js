/* ============================================
   CAT SITTING — sw.js
   Service worker : mise en cache pour usage hors-ligne
   Stratégie : réseau en priorité (network-first), cache en secours
   ============================================ */

const CACHE_NAME = "cat-sitting-v36-correctifs";
const FILES_TO_CACHE = [
  "./index.html",
  "./login.js",
  "./cloudsync.js",
  "./auth.js",
  "./supabase-config.js",
  "./reset-password.html",
  "./reset-password.js",
  "./budget.html",
  "./budget.js",
  "./preferences.html",
  "./preferences.js",
  "./map-clients.html",
  "./map-clients.js",
  "./itineraire.html",
  "./itineraire.js",
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
  "./import.html",
  "./import.js",
  "./admin.html",
  "./admin.js",
  "./aide.html",
  "./aide.js",
  "./diagnostic.html",
  "./diagnostic.js",
  "./message.html",
  "./messages.html",
  "./style.css",
  "./storage.js",
  "./icons.js",
  "./footer.js",
  "./manifest.json",
  "./icon.svg",
  "./logo.png",
  "./logo-192.png"
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

/* ---------- Notifications push (rappels de départs et de clés) ---------- */
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(d.title || "Petsitting", {
    body: d.body || "",
    icon: "./logo-192.png",
    badge: "./logo-192.png",
    data: { url: d.url || "./accueil.html" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "./accueil.html";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ("focus" in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
