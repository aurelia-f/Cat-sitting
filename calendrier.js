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

function getAnimalColorOverrides() {
  return Storage.get(userKey("animalcolors")) || {};
}
function saveAnimalColorOverrides(overrides) {
  Storage.set(userKey("animalcolors"), overrides);
}
function animalColorKey(ownerKey, name) {
  return `${ownerKey || ""}|${name || ""}`;
}

function getAnimalColor(ownerKey, name) {
  const overrides = getAnimalColorOverrides();
  const key = animalColorKey(ownerKey, name);
  const val = overrides[key];
  if (typeof val === "string" && val) return val;
  if (typeof val === "number" && ANIMAL_COLOR_PALETTE[val]) return ANIMAL_COLOR_PALETTE[val];
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

    // Nombre de chats par propriétaire ce jour-là (pour savoir quand préciser le nom du maître)
    const ownerCounts = {};
    animalChips.forEach(c => { ownerCounts[c.ownerKey] = (ownerCounts[c.ownerKey] || 0) + 1; });

    // Regroupe les chats d'un même propriétaire en UNE seule puce
    const chipsByOwner = {};
    animalChips.forEach(c => {
      if (!chipsByOwner[c.ownerKey]) chipsByOwner[c.ownerKey] = [];
      chipsByOwner[c.ownerKey].push(c);
    });
    Object.entries(chipsByOwner).forEach(([owKey, animals]) => {
      const color = getAnimalColor(owKey, animals[0].name);
      let label;
      if (animals.length >= 2) {
        // Plusieurs chats chez la même personne : on affiche juste le nom du maître, souligné
        label = `<u>${escapeHtml(getOwnerName(owKey))}</u>`;
      } else {
        label = escapeHtml(animals[0].name);
      }
      inner += `<div class="pill-dot" style="background-color:${color};">${label}</div>`;
    });

    // Regroupe les visites planifiées d'un même chat : si 2 visites (matin + après-midi), affiche M A
    const visiteGroups = {};
    visites.forEach(v => {
      const k = `${v.ownerKey}|${v.animalName}`;
      if (!visiteGroups[k]) visiteGroups[k] = [];
      visiteGroups[k].push(v);
    });
    Object.values(visiteGroups).forEach(group => {
      group.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
      const v = group[0];
      const color = getAnimalColor(v.ownerKey, v.animalName);
      const ownerSuffix = ownerCounts[v.ownerKey] >= 2 ? ` · <u>${escapeHtml(getOwnerName(v.ownerKey))}</u>` : "";
      const letters = group.length >= 2 ? ` <b>M</b> <b>A</b>` : "";
      inner += `<div class="pill-dot" draggable="true" data-visite-id="${v.id}" style="background-color:${color};">${escapeHtml(v.animalName)}${ownerSuffix}${letters}</div>`;
    });

    const rdvByOwner = {};
    rdvs.forEach(r => {
      if (!rdvByOwner[r.ownerKey]) rdvByOwner[r.ownerKey] = [];
      rdvByOwner[r.ownerKey].push(r);
    });
    Object.entries(rdvByOwner).forEach(([owKey, group]) => {
      const color = getAnimalColor(owKey, group[0].animalName);
      const distinctAnimals = new Set(group.map(r => r.animalName)).size;
      let label;
      if (distinctAnimals >= 2) {
        label = `<u>${escapeHtml(getOwnerName(owKey))}</u>`;
      } else {
        label = escapeHtml(group[0].animalName);
      }
      inner += `<div class="pill-dot" style="background-color:${color};">🔑 ${label}</div>`;
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

  // Complète la dernière semaine avec des cases vides pour que la grille reste un rectangle net
  const totalCells = startOffset + daysInMonth;
  const trailingEmpty = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < trailingEmpty; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-day empty";
    grid.appendChild(empty);
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

  const rdvByOwnerType = {};
  rdvs.forEach(r => {
    const k = `${r.ownerKey}|${r.type}`;
    if (!rdvByOwnerType[k]) rdvByOwnerType[k] = [];
    rdvByOwnerType[k].push(r);
  });
  Object.values(rdvByOwnerType).forEach(group => {
    const r = group[0];
    const color = getAnimalColor(r.ownerKey, r.animalName);
    const distinctAnimals = new Set(group.map(x => x.animalName)).size;
    const nameLabel = distinctAnimals >= 2
      ? `<u>${escapeHtml(getOwnerName(r.ownerKey))}</u>`
      : escapeHtml(r.animalName);
    html += `
      <div class="card tint-purple">
        <div class="card-title" style="font-size:14px; display:flex; align-items:center; gap:6px;"><span style="width:9px; height:9px; border-radius:50%; background:${color}; display:inline-block;"></span>🔑 ${r.type === "recuperation" ? "Récupération" : "Rendu"} — ${nameLabel}</div>
        <div class="card-sub">${r.time || ""} ${r.place ? "· " + escapeHtml(r.place) : ""}</div>
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
  const entries = [];
  owners.forEach(key => {
    const animals = getSortedAnimals(key);
    if (animals.length === 0) return;
    if (animals.length >= 2) {
      // Même famille, plusieurs chats : une seule entrée avec le nom du propriétaire, souligné
      entries.push({ ownerKey: key, colorName: animals[0].name, label: getOwnerName(key), isOwner: true });
    } else {
      entries.push({ ownerKey: key, colorName: animals[0].name, label: animals[0].name, isOwner: false });
    }
  });
  if (entries.length === 0) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = entries.map(e => {
    const color = getAnimalColor(e.ownerKey, e.colorName);
    const labelHtml = e.isOwner ? `<u>${escapeHtml(e.label)}</u>` : escapeHtml(e.label);
    return `<span class="small legend-chip" data-legend-owner="${escapeHtml(e.ownerKey)}" data-legend-name="${escapeHtml(e.colorName)}" data-legend-label="${escapeHtml(e.label)}" style="display:inline-flex; align-items:center; gap:5px;"><span style="width:10px; height:10px; border-radius:50%; background:${color}; display:inline-block;"></span>${labelHtml}</span>`;
  }).join("");

  el.querySelectorAll("[data-legend-owner]").forEach(chip => {
    chip.addEventListener("click", () => {
      openColorPicker(chip.dataset.legendOwner, chip.dataset.legendName, chip.dataset.legendLabel);
    });
  });
}

/* ---------- Sélecteur de couleur manuel ---------- */
let pendingColorTarget = null;
let selectedColorValue = null;

function openColorPicker(ownerKey, name, displayLabel) {
  pendingColorTarget = { ownerKey, name };
  document.getElementById("colorPickerTitle").textContent = `Couleur de ${displayLabel || name}`;

  const overrides = getAnimalColorOverrides();
  const key = animalColorKey(ownerKey, name);
  const currentVal = overrides[key];
  selectedColorValue = typeof currentVal === "string" ? currentVal
    : (typeof currentVal === "number" ? ANIMAL_COLOR_PALETTE[currentVal] : null);

  const swatchGroup = document.getElementById("colorSwatchGroup");
  swatchGroup.innerHTML = ANIMAL_COLOR_PALETTE.map((color) => `
    <div class="color-swatch${color === selectedColorValue ? " selected" : ""}" data-color-value="${color}" style="background-color:${color};"></div>
  `).join("");

  swatchGroup.querySelectorAll(".color-swatch").forEach(sw => {
    sw.addEventListener("click", () => {
      swatchGroup.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
      sw.classList.add("selected");
      selectedColorValue = sw.dataset.colorValue;
    });
  });

  const customInput = document.getElementById("customColorInput");
  customInput.value = (selectedColorValue && selectedColorValue.startsWith("#")) ? selectedColorValue : "#E8896A";

  document.getElementById("modalColorPicker").classList.add("open");
}

document.getElementById("customColorInput").addEventListener("input", (e) => {
  document.querySelectorAll("#colorSwatchGroup .color-swatch").forEach(s => s.classList.remove("selected"));
  selectedColorValue = e.target.value;
});

document.getElementById("saveColorBtn").addEventListener("click", () => {
  if (!pendingColorTarget || !selectedColorValue) {
    document.getElementById("modalColorPicker").classList.remove("open");
    return;
  }
  const overrides = getAnimalColorOverrides();
  const key = animalColorKey(pendingColorTarget.ownerKey, pendingColorTarget.name);
  overrides[key] = selectedColorValue;
  saveAnimalColorOverrides(overrides);
  document.getElementById("modalColorPicker").classList.remove("open");
  renderGrid();
  renderAnimalLegend();
  if (selectedDate) renderDayDetail(selectedDate);
});

document.getElementById("resetColorBtn").addEventListener("click", () => {
  if (!pendingColorTarget) return;
  const overrides = getAnimalColorOverrides();
  const key = animalColorKey(pendingColorTarget.ownerKey, pendingColorTarget.name);
  delete overrides[key];
  saveAnimalColorOverrides(overrides);
  document.getElementById("modalColorPicker").classList.remove("open");
  renderGrid();
  renderAnimalLegend();
  if (selectedDate) renderDayDetail(selectedDate);
});

renderDow();
renderGrid();
renderAnimalLegend();
