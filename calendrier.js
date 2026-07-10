/* ============================================
   CAT SITTING — calendrier.js
   ============================================ */

if (!getCurrentUser()) {
  goTo("index.html");
}

document.getElementById("backBtn").addEventListener("click", () => goTo("accueil.html"));

let viewDate = new Date();
viewDate.setDate(1);
let selectedDate = null;
let pendingVisiteDate = null;

const DOW_LABELS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

/* ---------- Couleur par chat (reste dans la palette existante) ---------- */
const ANIMAL_COLOR_PALETTE = [
  "var(--accent)",
  "var(--blue)",
  "var(--green)",
  "var(--purple)",
  "var(--accent-dk)"
];

function getAnimalColor(ownerKey, name) {
  const key = `${ownerKey || ""}|${name || ""}`;
  const h = Math.abs(parseInt(simpleHash(key), 36)) || 0;
  return ANIMAL_COLOR_PALETTE[h % ANIMAL_COLOR_PALETTE.length];
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function renderDow() {
  const el = document.getElementById("calDow");
  el.innerHTML = DOW_LABELS.map(d => `<div class="cal-dow">${d}</div>`).join("");
}

function monthLabel(d) {
  return `${MOIS_FR[d.getMonth()][0].toUpperCase()}${MOIS_FR[d.getMonth()].slice(1)} ${d.getFullYear()}`;
}

/* renvoie les prestations actives pour une date donnée (ds format YYYY-MM-DD) */
function prestationsForDate(ds) {
  return getAnimalsByDate(ds);
}

function calEventsForDate(ds) {
  const events = getCalEvents();
  return events[ds] || [];
}

function keyRdvPillsForDate(ds) {
  return getKeyRdvsByDate(ds);
}

function getOwnerName(ownerKey) {
  const profiles = getProfiles();
  const p = profiles[ownerKey];
  return p ? (p.name || ownerKey) : ownerKey;
}

function renderGrid() {
  document.getElementById("monthLabel").textContent = monthLabel(viewDate);
  const grid = document.getElementById("calGrid");
  grid.innerHTML = "";

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  // Lundi = 0 ... Dimanche = 6
  let startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = fmtISODate(new Date());

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-day empty";
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const ds = fmtISODate(new Date(year, month, day));
    const cell = document.createElement("div");
    cell.className = "cal-day" + (ds === todayStr ? " today" : "");
    cell.dataset.date = ds;

    const pres = prestationsForDate(ds);
    const visites = calEventsForDate(ds);
    const rdvs = keyRdvPillsForDate(ds);

    let inner = `<div class="num">${day}</div>`;

    // Toutes les paires (animal, propriétaire) en garde ce jour-là
    const animalChips = [];
    pres.forEach(p => {
      if (p.animals && p.animals.length > 0) {
        p.animals.forEach(a => animalChips.push({ ownerKey: p.ownerKey, name: a.name || "À définir" }));
      } else {
        animalChips.push({ ownerKey: p.ownerKey, name: "À définir" });
      }
    });

    animalChips.slice(0, 2).forEach(chip => {
      const color = getAnimalColor(chip.ownerKey, chip.name);
      const ownerSuffix = animalChips.length > 1 ? ` · ${getOwnerName(chip.ownerKey)}` : "";
      inner += `<div class="pill-dot" style="background-color:${color};">🐾 ${escapeHtml(chip.name)}${escapeHtml(ownerSuffix)}</div>`;
    });
    if (animalChips.length > 2) {
      inner += `<div class="pill-dot" style="background-color:var(--text-lt);">+${animalChips.length - 2}</div>`;
    }

    visites.forEach(v => {
      const color = getAnimalColor(v.ownerKey, v.animalName);
      const ownerSuffix = animalChips.length > 1 ? ` · ${getOwnerName(v.ownerKey)}` : "";
      inner += `<div class="pill-dot" draggable="true" data-visite-id="${v.id}" style="background-color:${color};">⏰ ${escapeHtml(v.animalName)}${escapeHtml(ownerSuffix)}${v.time ? " " + v.time : ""}</div>`;
    });

    rdvs.slice(0, 1).forEach(r => {
      const color = getAnimalColor(r.ownerKey, r.animalName);
      inner += `<div class="pill-dot" style="background-color:${color};">🔑 ${r.time || ""}</div>`;
    });

    cell.innerHTML = inner;

    cell.addEventListener("click", (e) => {
      if (e.target.closest("[data-visite-id]")) return;
      selectDate(ds);
    });

    cell.addEventListener("dragover", (e) => e.preventDefault());
    cell.addEventListener("drop", (e) => {
      e.preventDefault();
      const visiteId = e.dataTransfer.getData("text/plain");
      if (visiteId) moveVisite(visiteId, ds);
    });

    grid.appendChild(cell);
  }

  grid.querySelectorAll("[data-visite-id]").forEach(el => {
    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", el.dataset.visiteId);
    });
  });
}

function moveVisite(visiteId, newDate) {
  const events = getCalEvents();
  let moved = null;
  Object.keys(events).forEach(ds => {
    const idx = events[ds].findIndex(v => v.id === visiteId);
    if (idx !== -1) {
      moved = events[ds][idx];
      events[ds].splice(idx, 1);
      if (events[ds].length === 0) delete events[ds];
    }
  });
  if (moved) {
    if (!events[newDate]) events[newDate] = [];
    events[newDate].push(moved);
    saveCalEvents(events);
    renderGrid();
    if (selectedDate) renderDayDetail(selectedDate);
  }
}

function selectDate(ds) {
  selectedDate = ds;
  renderDayDetail(ds);
}

function renderDayDetail(ds) {
  document.getElementById("dayDetailTitle").textContent = fmtDate(ds);
  const container = document.getElementById("dayDetail");
  const pres = prestationsForDate(ds);
  const visites = calEventsForDate(ds);
  const rdvs = keyRdvPillsForDate(ds);

  let html = "";

  if (pres.length === 0 && visites.length === 0 && rdvs.length === 0) {
    html += `<div class="empty-state">Rien de prévu ce jour-là</div>`;
  }

  pres.forEach(p => {
    const animals = p.animals && p.animals.length > 0 ? p.animals : [{ name: "À définir", animal_type: [] }];
    const chipsHtml = animals.map(a => {
      const color = getAnimalColor(p.ownerKey, a.name);
      return `<span style="display:inline-flex; align-items:center; gap:4px; margin-right:8px;"><span style="width:9px; height:9px; border-radius:50%; background:${color}; display:inline-block;"></span>${animalEmoji(a.animal_type)} ${escapeHtml(a.name)}</span>`;
    }).join("");
    const ownerLine = pres.length > 1 ? `<div class="card-sub">👤 ${escapeHtml(getOwnerName(p.ownerKey))}</div>` : "";
    html += `
      <div class="card tint-blue">
        <div class="card-row">
          <div>
            <div class="card-title" style="font-size:14px;">${chipsHtml}</div>
            ${ownerLine}
          </div>
          <div class="icon-action" onclick="goTo('fiche.html?key=${encodeURIComponent(p.ownerKey)}')">›</div>
        </div>
      </div>
    `;
  });

  visites.forEach(v => {
    const color = getAnimalColor(v.ownerKey, v.animalName);
    const ownerBit = visites.length > 1 ? ` · ${escapeHtml(getOwnerName(v.ownerKey))}` : "";
    html += `
      <div class="card tint-purple">
        <div class="card-row">
          <div>
            <div class="card-title" style="font-size:14px; display:flex; align-items:center; gap:6px;"><span style="width:9px; height:9px; border-radius:50%; background:${color}; display:inline-block;"></span>🐾 ${escapeHtml(v.animalName)}</div>
            <div class="card-sub">Visite planifiée ${v.time ? "à " + v.time : ""}${ownerBit}</div>
          </div>
          <div class="icon-action" data-del-visite="${v.id}">🗑</div>
        </div>
      </div>
    `;
  });

  rdvs.forEach(r => {
    const color = getAnimalColor(r.ownerKey, r.animalName);
    const ownerBit = rdvs.length > 1 ? ` · ${escapeHtml(getOwnerName(r.ownerKey))}` : "";
    html += `
      <div class="card tint-purple">
        <div class="card-title" style="font-size:14px; display:flex; align-items:center; gap:6px;"><span style="width:9px; height:9px; border-radius:50%; background:${color}; display:inline-block;"></span>🔑 ${r.type === "recuperation" ? "Récupération" : "Rendu"} — ${escapeHtml(r.animalName)}</div>
        <div class="card-sub">${r.time || ""} ${r.place ? "· " + escapeHtml(r.place) : ""}${ownerBit}</div>
      </div>
    `;
  });

  if (pres.length > 0) {
    html += `<button class="btn btn-outline mt-8" id="planVisiteBtn">+ Planifier une visite</button>`;
  }

  container.innerHTML = html;

  container.querySelectorAll("[data-del-visite]").forEach(btn => {
    btn.addEventListener("click", () => {
      const events = getCalEvents();
      Object.keys(events).forEach(d => {
        events[d] = events[d].filter(v => v.id !== btn.dataset.delVisite);
        if (events[d].length === 0) delete events[d];
      });
      saveCalEvents(events);
      renderGrid();
      renderDayDetail(ds);
    });
  });

  const planBtn = document.getElementById("planVisiteBtn");
  if (planBtn) {
    planBtn.addEventListener("click", () => openVisiteModal(ds));
  }
}

function openVisiteModal(ds) {
  pendingVisiteDate = ds;
  const pres = prestationsForDate(ds);
  const select = document.getElementById("visiteAnimalSelect");
  select.innerHTML = "";
  pres.forEach(p => {
    p.animals.forEach(a => {
      const opt = document.createElement("option");
      opt.value = JSON.stringify({ ownerKey: p.ownerKey, name: a.name });
      opt.textContent = `${animalEmoji(a.animal_type)} ${a.name}`;
      select.appendChild(opt);
    });
    if (p.animals.length === 0) {
      const opt = document.createElement("option");
      opt.value = JSON.stringify({ ownerKey: p.ownerKey, name: "À définir" });
      opt.textContent = "À définir 🐾";
      select.appendChild(opt);
    }
  });
  document.getElementById("visiteTime").value = "";
  document.getElementById("modalVisite").classList.add("open");
}

document.getElementById("saveVisiteBtn").addEventListener("click", () => {
  const select = document.getElementById("visiteAnimalSelect");
  if (!select.value) return;
  const chosen = JSON.parse(select.value);
  const time = document.getElementById("visiteTime").value;

  const events = getCalEvents();
  if (!events[pendingVisiteDate]) events[pendingVisiteDate] = [];
  events[pendingVisiteDate].push({
    id: `v-${Date.now().toString(36)}`,
    ownerKey: chosen.ownerKey,
    animalName: chosen.name,
    time
  });
  saveCalEvents(events);
  document.getElementById("modalVisite").classList.remove("open");
  renderGrid();
  renderDayDetail(pendingVisiteDate);
});

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => btn.closest(".modal-overlay").classList.remove("open"));
});

document.getElementById("prevMonth").addEventListener("click", () => {
  viewDate.setMonth(viewDate.getMonth() - 1);
  renderGrid();
});
document.getElementById("nextMonth").addEventListener("click", () => {
  viewDate.setMonth(viewDate.getMonth() + 1);
  renderGrid();
});

function renderAnimalLegend() {
  const el = document.getElementById("animalLegend");
  const owners = getSortedOwners();
  const chips = [];
  owners.forEach(key => {
    getSortedAnimals(key).forEach(a => {
      chips.push({ ownerKey: key, name: a.name || "Sans nom" });
    });
  });
  if (chips.length === 0) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = chips.map(c => {
    const color = getAnimalColor(c.ownerKey, c.name);
    return `<span class="small" style="display:inline-flex; align-items:center; gap:5px;"><span style="width:10px; height:10px; border-radius:50%; background:${color}; display:inline-block;"></span>${escapeHtml(c.name)}</span>`;
  }).join("");
}

renderDow();
renderGrid();
renderAnimalLegend();
