/* ============================================
   CAT SITTING — itineraire.js
   Itinéraire optimisé du jour (OSRM = itinéraire routier réel)
   ============================================ */

await window.hydrateFromSupabase();
if (!getCurrentUser()) {
  goTo("index.html");
}

document.getElementById("backBtn").addEventListener("click", () => goTo("accueil.html"));
document.getElementById("prefsBtn").addEventListener("click", () => goTo("preferences.html"));

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* Catégorie de durée d'une formule, pour le badge ⏱️ */
function durationCategory(mcerKey) {
  const t = DEFAULT_TARIFS[mcerKey];
  if (!t) return null;
  if (/1h|2h/i.test(t.desc)) return "long";
  if (/30 ?min/i.test(t.desc)) return "court";
  return null;
}

/* ---------- Optimisation (TSP) ---------- */
function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    permutations(rest).forEach(p => result.push([arr[i], ...p]));
  }
  return result;
}

function nearestNeighborOrder(indices, matrix) {
  const remaining = [...indices];
  const order = [remaining.shift()];
  while (remaining.length > 0) {
    const last = order[order.length - 1];
    let bestI = 0, bestCost = Infinity;
    remaining.forEach((idx, i) => {
      const c = matrix[last][idx];
      if (c < bestCost) { bestCost = c; bestI = i; }
    });
    order.push(remaining.splice(bestI, 1)[0]);
  }
  return order;
}

function optimalOrder(indices, matrix) {
  if (indices.length <= 1) return indices;
  if (indices.length > 8) return nearestNeighborOrder(indices, matrix);
  let best = null, bestCost = Infinity;
  permutations(indices).forEach(perm => {
    let cost = 0;
    for (let i = 0; i < perm.length - 1; i++) cost += matrix[perm[i]][perm[i + 1]];
    if (cost < bestCost) { bestCost = cost; best = perm; }
  });
  return best;
}

/* ---------- OSRM ---------- */
async function fetchDurationMatrix(coordsList) {
  const coordStr = coordsList.map(c => `${c.lng},${c.lat}`).join(";");
  const url = `https://router.project-osrm.org/table/v1/driving/${coordStr}?annotations=duration,distance`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Requête OSRM échouée");
  const data = await res.json();
  if (data.code !== "Ok") throw new Error("OSRM : " + data.code);
  return { durations: data.durations, distances: data.distances };
}

async function fetchRouteGeometry(orderedCoords) {
  if (orderedCoords.length < 2) return null;
  const coordStr = orderedCoords.map(c => `${c.lng},${c.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes[0]) return null;
    return data.routes[0].geometry;
  } catch (e) {
    return null;
  }
}

/* ---------- État ---------- */
let stops = [];          // [{ownerKey, ownerName, address, animals, mcerKey, coords}]
let durationMatrix = null;
let distanceMatrix = null;
let order = [];           // indices dans `stops`, dans l'ordre d'affichage actuel
let map = null;
let routeLayer = null;
let markers = [];
const prefs = getPrefs();

/* ---------- Chargement des arrêts du jour ---------- */
async function loadDay(ds) {
  const statusEl = document.getElementById("status");
  const resultsEl = document.getElementById("results");
  resultsEl.style.display = "none";
  document.getElementById("unlocatedSection").style.display = "none";
  statusEl.style.display = "block";
  statusEl.textContent = "Recherche des visites de ce jour…";

  const dayData = getAnimalsByDate(ds); // [{ownerKey, animals, prestation}]
  if (dayData.length === 0) {
    statusEl.textContent = "Aucune visite prévue ce jour-là.";
    return;
  }

  statusEl.textContent = "Localisation des adresses…";

  stops = [];
  const unlocated = [];

  for (const d of dayData) {
    const profiles = getProfiles();
    const p = profiles[d.ownerKey];
    if (!p || !p.info || !p.info.address) {
      unlocated.push({ name: (p && p.name) || d.ownerKey, address: "(aucune adresse renseignée)" });
      continue;
    }
    const alreadyCached = p.info.geocoded_lat != null && p.info.geocoded_address === p.info.address;
    const coords = await ensureGeocoded(d.ownerKey);
    if (!coords) {
      unlocated.push({ name: p.name || d.ownerKey, address: p.info.address });
    } else {
      stops.push({
        ownerKey: d.ownerKey,
        ownerName: p.name || d.ownerKey,
        address: p.info.address,
        animals: d.animals,
        mcerKey: d.prestation.mcer_key,
        coords
      });
    }
    if (!alreadyCached) await sleep(1100);
  }

  if (unlocated.length > 0) {
    document.getElementById("unlocatedSection").style.display = "block";
    document.getElementById("unlocatedList").innerHTML = unlocated.map(u => `
      <div class="card">
        <div class="card-title" style="font-size:14px;">👤 ${escapeHtml(u.name)}</div>
        <div class="card-sub">${escapeHtml(u.address)}</div>
      </div>
    `).join("") + `<button class="btn btn-outline mt-8" id="fixOnMapBtn">📍 Corriger sur la carte des clients</button>`;
    const fixBtn = document.getElementById("fixOnMapBtn");
    if (fixBtn) fixBtn.addEventListener("click", () => goTo("map-clients.html"));
  }

  if (stops.length === 0) {
    statusEl.textContent = "Aucune adresse localisable pour ce jour.";
    return;
  }

  if (stops.length === 1) {
    order = [0];
    durationMatrix = [[0, 0]];
    distanceMatrix = [[0, 0]];
    statusEl.style.display = "none";
    resultsEl.style.display = "block";
    await renderResults();
    return;
  }

  statusEl.textContent = "Calcul du meilleur itinéraire…";

  try {
    const matrices = await fetchDurationMatrix(stops.map(s => s.coords));
    durationMatrix = matrices.durations;
    distanceMatrix = matrices.distances;
    order = optimalOrder(stops.map((_, i) => i), durationMatrix);
    statusEl.style.display = "none";
    resultsEl.style.display = "block";
    await renderResults();
  } catch (e) {
    console.error(e);
    statusEl.textContent = "Impossible de calculer l'itinéraire routier pour le moment (service externe indisponible). Réessaie dans un instant.";
  }
}

/* ---------- Rendu ---------- */
function preferenceHint(stop) {
  const badges = [];
  const dur = durationCategory(stop.mcerKey);
  if (dur === "long") badges.push(`<span class="badge badge-blue">⏱️ 1h</span>`);
  if (dur === "court") badges.push(`<span class="badge badge-blue">⏱️ 30 min</span>`);
  if (stop.mcerKey === "delicat") badges.push(`<span class="badge badge-purple">🔑 Délicat</span>`);
  return badges.join(" ");
}

function suggestedFirstIndex() {
  if (prefs.difficulty_pref === "delicat_first") {
    const idx = stops.findIndex(s => s.mcerKey === "delicat");
    if (idx !== -1) return idx;
  }
  if (prefs.duration_pref === "1h_first") {
    const idx = stops.findIndex(s => durationCategory(s.mcerKey) === "long");
    if (idx !== -1) return idx;
  }
  if (prefs.duration_pref === "30min_first") {
    const idx = stops.findIndex(s => durationCategory(s.mcerKey) === "court");
    if (idx !== -1) return idx;
  }
  return null;
}

function fmtDuration(seconds) {
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}
function fmtDistance(meters) {
  return `${(meters / 1000).toFixed(1)} km`;
}

async function renderResults() {
  // Totaux
  let totalDuration = 0, totalDistance = 0;
  for (let i = 0; i < order.length - 1; i++) {
    totalDuration += durationMatrix[order[i]][order[i + 1]];
    totalDistance += distanceMatrix[order[i]][order[i + 1]];
  }
  document.getElementById("statStops").textContent = stops.length;
  document.getElementById("statDuration").textContent = fmtDuration(totalDuration);
  document.getElementById("statDistance").textContent = fmtDistance(totalDistance);

  const suggestedIdx = suggestedFirstIndex();

  // Liste
  const list = document.getElementById("stopsList");
  list.innerHTML = order.map((stopIdx, pos) => {
    const stop = stops[stopIdx];
    const animalNames = stop.animals.map(a => a.name).filter(Boolean).join(", ") || "À définir";
    const nextTravel = pos < order.length - 1
      ? `<div class="card-sub mt-8">🚗 ${fmtDuration(durationMatrix[stopIdx][order[pos + 1]])} jusqu'au prochain arrêt</div>`
      : "";
    const suggestion = (suggestedIdx === stopIdx && pos !== 0)
      ? `<div class="badge badge-orange mt-8">⭐ Suggéré en premier selon tes préférences</div>`
      : "";
    return `
      <div class="card">
        <div class="card-row">
          <div class="stop-num">${pos + 1}</div>
          <div style="flex:1;">
            <div class="card-title" style="font-size:14px;">👤 ${escapeHtml(stop.ownerName)} <span class="text-lt small">· ${escapeHtml(animalNames)}</span></div>
            <div class="card-sub">${escapeHtml(stop.address)}</div>
            <div class="mt-8">${preferenceHint(stop)}</div>
            ${suggestion}
            ${nextTravel}
          </div>
          <div class="reorder-btns">
            <div class="icon-action" data-move-up="${pos}" title="Monter">▲</div>
            <div class="icon-action" data-move-down="${pos}" title="Descendre">▼</div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-move-up]").forEach(btn => {
    btn.addEventListener("click", () => {
      const pos = parseInt(btn.dataset.moveUp);
      if (pos === 0) return;
      [order[pos - 1], order[pos]] = [order[pos], order[pos - 1]];
      renderResults();
    });
  });
  list.querySelectorAll("[data-move-down]").forEach(btn => {
    btn.addEventListener("click", () => {
      const pos = parseInt(btn.dataset.moveDown);
      if (pos === order.length - 1) return;
      [order[pos + 1], order[pos]] = [order[pos], order[pos + 1]];
      renderResults();
    });
  });

  await renderMap();
}

async function renderMap() {
  const mapEl = document.getElementById("map");
  if (!map) {
    map = L.map(mapEl);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19
    }).addTo(map);
  }

  markers.forEach(m => map.removeLayer(m));
  markers = [];
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }

  const orderedCoords = order.map(i => stops[i].coords);
  const bounds = [];

  if (prefs.home_lat != null && prefs.home_lng != null) {
    const homeIcon = L.divIcon({
      className: "",
      html: `<div style="background:var(--green,#6DB98A); color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; border:2px solid #fff; box-shadow:0 1px 4px rgba(0,0,0,0.3);">🏠</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    const homeMarker = L.marker([prefs.home_lat, prefs.home_lng], { icon: homeIcon })
      .addTo(map)
      .bindPopup(`<strong>🏠 Mon adresse</strong>`);
    markers.push(homeMarker);
    bounds.push([prefs.home_lat, prefs.home_lng]);
  }

  order.forEach((stopIdx, pos) => {
    const stop = stops[stopIdx];
    const icon = L.divIcon({
      className: "",
      html: `<div style="background:var(--accent,#E8896A); color:#fff; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px; border:2px solid #fff; box-shadow:0 1px 4px rgba(0,0,0,0.3);">${pos + 1}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
    const marker = L.marker([stop.coords.lat, stop.coords.lng], { icon }).addTo(map);
    const popupHtml = () => `<strong>${escapeHtml(stop.ownerName)}</strong><br>${escapeHtml(stop.address)}<br><button class="btn btn-sm btn-secondary mt-8" data-enable-drag-stop="${stop.ownerKey}">📍 Déplacer</button>`;
    marker.bindPopup(popupHtml());
    marker.on("popupopen", () => {
      const btn = document.querySelector(`[data-enable-drag-stop="${stop.ownerKey}"]`);
      if (btn) {
        btn.addEventListener("click", () => {
          marker.dragging.enable();
          marker.closePopup();
        });
      }
    });
    marker.on("dragend", async () => {
      const pos2 = marker.getLatLng();
      setManualCoords(stop.ownerKey, pos2.lat, pos2.lng);
      marker.dragging.disable();
      // L'emplacement a changé : on recalcule l'itinéraire avec la position corrigée
      await loadDay(document.getElementById("dayInput").value);
    });
    markers.push(marker);
    bounds.push([stop.coords.lat, stop.coords.lng]);
  });

  if (bounds.length === 1) {
    map.setView(bounds[0], 14);
  } else {
    map.fitBounds(bounds, { padding: [30, 30] });
  }

  if (orderedCoords.length >= 2) {
    const geometry = await fetchRouteGeometry(orderedCoords);
    if (geometry) {
      routeLayer = L.geoJSON(geometry, { style: { color: "#E8896A", weight: 4, opacity: 0.8 } }).addTo(map);
    }
  }
}

/* ---------- Init ---------- */
const dayInput = document.getElementById("dayInput");
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
dayInput.value = fmtISODate(tomorrow);

dayInput.addEventListener("change", () => {
  if (dayInput.value) loadDay(dayInput.value);
});

loadDay(dayInput.value);
