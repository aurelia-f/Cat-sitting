/* ============================================
   CAT SITTING — fiche.js
   ============================================ */

if (!getCurrentUser()) {
  goTo("index.html");
}

const params = new URLSearchParams(window.location.search);
const isNew = params.get("new") === "1";
const ownerParam = params.get("owner") || "";
let currentKey = params.get("key") || null;

let profiles = getProfiles();
let currentProfile;

if (isNew) {
  currentKey = ownerTechKey(ownerParam);
  currentProfile = {
    name: ownerParam,
    info: { owner_name: ownerParam },
    animals: [],
    prestations: []
  };
} else if (currentKey && profiles[currentKey]) {
  currentProfile = JSON.parse(JSON.stringify(profiles[currentKey]));
  // rétrocompatibilité
  if (!currentProfile.animals) {
    currentProfile.animals = getSortedAnimals(currentKey);
  }
  if (!currentProfile.info) {
    currentProfile.info = { owner_name: currentProfile.name || "" };
  }
  if (!currentProfile.prestations) {
    currentProfile.prestations = [];
  }
} else {
  goTo("accueil.html");
}

document.getElementById("ficheTitle").textContent = currentProfile.name || "Fiche";
document.getElementById("backBtn").addEventListener("click", () => goTo("accueil.html"));

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
  });
});

if (isNew) {
  document.querySelector('[data-tab="animaux"]').click();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

/* ================= ANIMAUX ================= */

let editingAnimalIndex = null;

function sortedAnimalsLocal() {
  return [...currentProfile.animals].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
}

function renderAnimals() {
  const list = document.getElementById("animalsList");
  const animals = sortedAnimalsLocal();
  if (animals.length === 0) {
    list.innerHTML = `<div class="empty-state">Aucun animal ajouté pour l'instant 🐾</div>`;
    return;
  }
  list.innerHTML = animals.map(a => {
    const realIdx = currentProfile.animals.indexOf(a);
    return `
      <div class="card">
        <div class="card-row">
          <div>
            <div class="card-title">${animalEmoji(a.animal_type)} ${escapeHtml(a.name || "Sans nom")}</div>
            <div class="card-sub">${escapeHtml(a.animal_gender || "")} ${a.animal_gender ? "·" : ""} ${escapeHtml(a.animal_age || "")} ${a.animal_age ? "·" : ""} ${escapeHtml(a.is_cuddly || "")}</div>
          </div>
          <div class="flex gap-8">
            <div class="icon-action" data-edit-animal="${realIdx}">✏️</div>
            <div class="icon-action" data-del-animal="${realIdx}">🗑</div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-edit-animal]").forEach(btn => {
    btn.addEventListener("click", () => openAnimalModal(parseInt(btn.dataset.editAnimal)));
  });
  list.querySelectorAll("[data-del-animal]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.delAnimal);
      if (confirm(`Supprimer ${currentProfile.animals[idx].name || "cet animal"} ?`)) {
        currentProfile.animals.splice(idx, 1);
        renderAnimals();
      }
    });
  });
}

function clearAnimalModal() {
  document.getElementById("a_name").value = "";
  document.getElementById("a_special_behavior").value = "";
  document.querySelectorAll("#modalAnimal .pill").forEach(p => p.classList.remove("selected"));
  document.querySelectorAll("#modalAnimal .switch").forEach(s => s.classList.remove("on"));
}

function openAnimalModal(idx) {
  editingAnimalIndex = (idx === undefined || idx === null) ? null : idx;
  clearAnimalModal();
  document.getElementById("animalModalTitle").textContent =
    editingAnimalIndex === null ? "Ajouter un animal" : "Modifier l'animal";

  if (editingAnimalIndex !== null) {
    const a = currentProfile.animals[editingAnimalIndex];
    document.getElementById("a_name").value = a.name || "";
    document.getElementById("a_special_behavior").value = a.special_behavior || "";
    setPillGroup("animal_type", a.animal_type || []);
    setPillGroup("animal_gender", a.animal_gender ? [a.animal_gender] : []);
    setPillGroup("animal_age", a.animal_age ? [a.animal_age] : []);
    setPillGroup("is_cuddly", a.is_cuddly ? [a.is_cuddly] : []);
    setPillGroup("comes_to_me", a.comes_to_me ? [a.comes_to_me] : []);
    setPillGroup("is_playful", a.is_playful ? [a.is_playful] : []);
    setPillGroup("eats_how", a.eats_how ? [a.eats_how] : []);
    setPillGroup("personality", a.personality || []);
    setPillGroup("favorite_things", a.favorite_things || []);
    setPillGroup("dislikes", a.dislikes || []);
    setToggle("has_litter", a.has_litter === "Oui");
    setToggle("has_water", a.has_water === "Oui");
    setToggle("has_croquettes", a.has_croquettes === "Oui");
    setToggle("has_pate", a.has_pate === "Oui");
  }

  document.getElementById("modalAnimal").classList.add("open");
}

function setPillGroup(field, values) {
  const group = document.querySelector(`.pill-group[data-field="${field}"]`);
  if (!group) return;
  group.querySelectorAll(".pill").forEach(p => {
    p.classList.toggle("selected", values.includes(p.dataset.value));
  });
}

function getPillGroupValue(field, multi) {
  const group = document.querySelector(`.pill-group[data-field="${field}"]`);
  const selected = [...group.querySelectorAll(".pill.selected")].map(p => p.dataset.value);
  return multi ? selected : (selected[0] || "");
}

function setToggle(name, on) {
  const el = document.querySelector(`.switch[data-toggle="${name}"]`);
  if (el) el.classList.toggle("on", !!on);
}

function getToggle(name) {
  const el = document.querySelector(`.switch[data-toggle="${name}"]`);
  return el && el.classList.contains("on") ? "Oui" : "Non";
}

/* pill click behavior (single vs multi select) */
document.querySelectorAll("#modalAnimal .pill-group").forEach(group => {
  const isMulti = group.dataset.multi === "1";
  group.querySelectorAll(".pill").forEach(pill => {
    pill.addEventListener("click", () => {
      if (isMulti) {
        pill.classList.toggle("selected");
      } else {
        group.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
        pill.classList.add("selected");
      }
    });
  });
});

/* toggle switch click */
document.querySelectorAll("#modalAnimal .switch").forEach(sw => {
  sw.addEventListener("click", () => sw.classList.toggle("on"));
});

document.getElementById("addAnimalBtn").addEventListener("click", () => openAnimalModal(null));

document.getElementById("saveAnimalBtn").addEventListener("click", () => {
  const name = document.getElementById("a_name").value.trim();
  if (!name) {
    alert("Merci de renseigner le prénom de l'animal.");
    return;
  }
  const animal = {
    name,
    animal_type: getPillGroupValue("animal_type", true),
    animal_gender: getPillGroupValue("animal_gender", false),
    animal_age: getPillGroupValue("animal_age", false),
    is_cuddly: getPillGroupValue("is_cuddly", false),
    comes_to_me: getPillGroupValue("comes_to_me", false),
    is_playful: getPillGroupValue("is_playful", false),
    eats_how: getPillGroupValue("eats_how", false),
    personality: getPillGroupValue("personality", true),
    favorite_things: getPillGroupValue("favorite_things", true),
    dislikes: getPillGroupValue("dislikes", true),
    special_behavior: document.getElementById("a_special_behavior").value.trim(),
    has_litter: getToggle("has_litter"),
    has_water: getToggle("has_water"),
    has_croquettes: getToggle("has_croquettes"),
    has_pate: getToggle("has_pate")
  };

  if (editingAnimalIndex !== null) {
    currentProfile.animals[editingAnimalIndex] = animal;
  } else {
    currentProfile.animals.push(animal);
  }
  document.getElementById("modalAnimal").classList.remove("open");
  renderAnimals();
});

/* ================= INFOS ================= */

function loadInfoTab() {
  const info = currentProfile.info || {};
  document.getElementById("info_owner_name").value = info.owner_name || currentProfile.name || "";
  document.getElementById("info_owner_phone").value = info.owner_phone || "";
  document.getElementById("info_address").value = info.address || "";
  document.getElementById("info_access_code").value = info.access_code || "";
  document.getElementById("info_vet").value = info.vet || "";
  document.getElementById("info_food").value = info.food || "";
  document.getElementById("info_health_notes").value = info.health_notes || "";
  document.getElementById("info_special_notes").value = info.special_notes || "";
}

function collectInfoTab() {
  return {
    owner_name: document.getElementById("info_owner_name").value.trim(),
    owner_phone: document.getElementById("info_owner_phone").value.trim(),
    address: document.getElementById("info_address").value.trim(),
    access_code: document.getElementById("info_access_code").value.trim(),
    vet: document.getElementById("info_vet").value.trim(),
    food: document.getElementById("info_food").value.trim(),
    health_notes: document.getElementById("info_health_notes").value.trim(),
    special_notes: document.getElementById("info_special_notes").value.trim()
  };
}

/* ================= PRESTATIONS ================= */

function renderPrestations() {
  const list = document.getElementById("prestationsList");
  const prestations = currentProfile.prestations || [];
  if (prestations.length === 0) {
    list.innerHTML = `<div class="empty-state">Aucune prestation enregistrée</div>`;
    return;
  }
  const sorted = prestations.map((p, i) => ({ p, i })).sort((a, b) => new Date(a.p.date_start) - new Date(b.p.date_start));

  list.innerHTML = sorted.map(({ p, i }) => {
    const calc = calcPrestation(p);
    const paidBadge = p.payment_status === "paye"
      ? `<span class="badge badge-green">Payé</span>`
      : `<span class="badge badge-red">En attente</span>`;
    let keyWarning = "";
    const today = fmtISODate(new Date());
    if (p.date_end < today && !p.keys_returned) {
      keyWarning = `<div class="badge badge-red mt-8">⚠️ Clés non rendues</div>`;
    }
    return `
      <div class="card tint-green">
        <div class="card-row">
          <div>
            <div class="card-title">${fmtShort(p.date_start)} → ${fmtShort(p.date_end)}</div>
            <div class="card-sub">${p.visit_time ? "Visites : " + escapeHtml(p.visit_time) : ""}</div>
            <div class="card-sub">${calc.total}€ ${paidBadge}</div>
            ${keyWarning}
          </div>
          <div class="flex gap-8">
            <div class="icon-action" data-edit-pres="${i}">✏️</div>
            <div class="icon-action" data-del-pres="${i}">🗑</div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-edit-pres]").forEach(btn => {
    btn.addEventListener("click", () => {
      persistProfile(false);
      goTo(`prestation.html?key=${encodeURIComponent(currentKey)}&idx=${btn.dataset.editPres}`);
    });
  });
  list.querySelectorAll("[data-del-pres]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.delPres);
      if (confirm("Supprimer cette prestation ?")) {
        currentProfile.prestations.splice(idx, 1);
        renderPrestations();
      }
    });
  });
}

document.getElementById("addPrestationBtn").addEventListener("click", () => {
  persistProfile(false);
  goTo(`prestation.html?key=${encodeURIComponent(currentKey)}&new=1`);
});

/* ================= SAUVEGARDE ================= */

function persistProfile(showAlert) {
  currentProfile.info = collectInfoTab();
  currentProfile.name = currentProfile.info.owner_name || currentProfile.name || currentKey;
  currentProfile.animals = sortedAnimalsLocal();

  profiles = getProfiles();
  profiles[currentKey] = currentProfile;
  saveProfiles(profiles);

  if (showAlert) {
    document.getElementById("ficheTitle").textContent = currentProfile.name;
  }
}

document.getElementById("saveBtn").addEventListener("click", () => {
  persistProfile(true);
  goTo("accueil.html");
});

document.getElementById("deleteFicheBtn").addEventListener("click", () => {
  if (confirm(`Supprimer définitivement la fiche de ${currentProfile.name} ?`)) {
    profiles = getProfiles();
    delete profiles[currentKey];
    saveProfiles(profiles);
    goTo("accueil.html");
  }
});

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => btn.closest(".modal-overlay").classList.remove("open"));
});

/* ---------- Init ---------- */
loadInfoTab();
renderAnimals();
renderPrestations();
