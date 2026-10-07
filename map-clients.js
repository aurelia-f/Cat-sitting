/* ============================================
   CAT SITTING — map-clients.js
   ============================================ */

await window.hydrateFromSupabase();
if (!getCurrentUser()) {
  goTo("index.html");
}

document.getElementById("backBtn").addEventListener("click", () => goTo("accueil.html"));

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let map = null;
const clientMarkers = {}; // ownerKey -> marker
let placingKey = null;    // ownerKey en attente d'un clic pour placement manuel

function ensureMap() {
  if (map) return map;
  const mapEl = document.getElementById("map");
  mapEl.style.display = "block";
  map = L.map(mapEl).setView([46.6, 2.5], 5); // vue par défaut : France
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19
  }).addTo(map);

  map.on("click", (e) => {
    if (!placingKey) return;
    const key = placingKey;
    placingKey = null;
    document.getElementById("map").style.cursor = "";
    document.getElementById("mapStatus").style.display = "none";
    setManualCoords(key, e.latlng.lat, e.latlng.lng);
    const profiles = getProfiles();
    const p = profiles[key];
    addClientMarker({ key, name: p.name || key, animals: getSortedAnimals(key), coords: { lat: e.latlng.lat, lng: e.latlng.lng } });
    removeFromUnlocatedList(key);
    fitAllMarkers();
  });

  return map;
}

function popupHtml(item) {
  const animalNames = item.animals.map(a => a.name).filter(Boolean).join(", ") || "Aucun animal";
  return `
    <strong>${escapeHtml(item.name)}</strong><br>
    ${escapeHtml(animalNames)}<br>
    <a href="fiche.html?key=${encodeURIComponent(item.key)}">Voir la fiche →</a><br>
    <button class="btn btn-sm btn-secondary mt-8" data-enable-drag="${escapeHtml(item.key)}">📍 Déplacer</button>
  `;
}

function addClientMarker(item) {
  const m = ensureMap();
  const marker = L.marker([item.coords.lat, item.coords.lng]).addTo(m);
  marker.bindPopup(popupHtml(item));
  marker.on("popupopen", () => {
    const btn = document.querySelector(`[data-enable-drag="${item.key}"]`);
    if (btn) {
      btn.addEventListener("click", () => {
        marker.dragging.enable();
        marker.closePopup();
        showStatus(`Fais glisser le point à l'endroit de ${item.name}, puis relâche.`);
      });
    }
  });
  marker.on("dragend", () => {
    const pos = marker.getLatLng();
    setManualCoords(item.key, pos.lat, pos.lng);
    marker.dragging.disable();
    marker.setPopupContent(popupHtml(item));
    document.getElementById("mapStatus").style.display = "none";
  });
  clientMarkers[item.key] = marker;
}

function showStatus(text) {
  const el = document.getElementById("mapStatus");
  el.style.display = "block";
  el.textContent = text;
}

function fitAllMarkers() {
  const positions = Object.values(clientMarkers).map(m => m.getLatLng());
  const prefs = getPrefs();
  if (prefs.home_lat != null && prefs.home_lng != null) positions.push(L.latLng(prefs.home_lat, prefs.home_lng));
  if (positions.length === 0) return;
  if (positions.length === 1) map.setView(positions[0], 14);
  else map.fitBounds(L.latLngBounds(positions), { padding: [30, 30] });
}

function removeFromUnlocatedList(key) {
  const row = document.getElementById(`unlocated-${key}`);
  if (row) row.remove();
  const remaining = document.querySelectorAll("#unlocatedList .card").length;
  if (remaining === 0) document.getElementById("unlocatedSection").style.display = "none";
}

async function run() {
  const owners = getSortedOwners();
  const withAddress = owners.filter(key => {
    const profiles = getProfiles();
    return profiles[key] && profiles[key].info && profiles[key].info.address;
  });

  if (withAddress.length === 0) {
    document.getElementById("mapStatus").textContent = "Aucune fiche n'a d'adresse renseignée pour l'instant.";
    return;
  }

  const located = [];
  const unlocated = [];

  for (const key of withAddress) {
    const profiles = getProfiles();
    const p = profiles[key];
    const alreadyCached = p.info.geocoded_lat != null && p.info.geocoded_address === p.info.address;

    const coords = await ensureGeocoded(key);
    if (coords) {
      located.push({ key, name: p.name || key, animals: getSortedAnimals(key), coords });
    } else {
      unlocated.push({ key, name: p.name || key, address: p.info.address });
    }

    if (!alreadyCached) await sleep(1100);
  }

  document.getElementById("mapStatus").style.display = "none";

  const prefs = getPrefs();
  const hasHome = prefs.home_lat != null && prefs.home_lng != null;

  ensureMap();

  if (hasHome) {
    const homeIcon = L.divIcon({
      className: "",
      html: `<div style="background:var(--green,#6DB98A); color:#fff; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:15px; border:2px solid #fff; box-shadow:0 1px 4px rgba(0,0,0,0.3);">🏠</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
    L.marker([prefs.home_lat, prefs.home_lng], { icon: homeIcon }).addTo(map).bindPopup(`<strong>🏠 Mon adresse</strong>`);
  }

  located.forEach(addClientMarker);
  fitAllMarkers();

  if (located.length === 0 && !hasHome) {
    showStatus("Aucune adresse n'a pu être localisée pour l'instant — place-les manuellement ci-dessous.");
  }

  if (unlocated.length > 0) {
    document.getElementById("unlocatedSection").style.display = "block";
    document.getElementById("unlocatedList").innerHTML = unlocated.map(u => `
      <div class="card" id="unlocated-${escapeHtml(u.key)}">
        <div class="card-row">
          <div>
            <div class="card-title" style="font-size:14px;">👤 ${escapeHtml(u.name)}</div>
            <div class="card-sub">${escapeHtml(u.address)}</div>
          </div>
          <button class="btn btn-sm btn-secondary" data-place-manually="${escapeHtml(u.key)}">📍 Placer manuellement</button>
        </div>
      </div>
    `).join("");

    document.querySelectorAll("[data-place-manually]").forEach(btn => {
      btn.addEventListener("click", () => {
        placingKey = btn.dataset.placeManually;
        document.getElementById("map").style.cursor = "crosshair";
        showStatus(`Clique sur la carte à l'endroit de ${btn.closest(".card").querySelector(".card-title").textContent.replace("👤 ", "")}.`);
        map.getContainer().scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }
}

run();
