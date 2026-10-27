/* ============================================
   CAT SITTING — fiche.js
   ============================================ */

await window.hydrateFromSupabase();
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
    prestations: [],
    site: getCreationSite()
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
let pendingPhoto = null;     // photo réduite (data URL) de l'animal en cours d'édition

function showPhotoPreview() {
  const img = document.getElementById("a_photo_preview");
  img.style.display = pendingPhoto ? "" : "none";
  if (pendingPhoto) img.src = pendingPhoto;
  document.getElementById("a_photo_remove").style.display = pendingPhoto ? "" : "none";
}
/* Réduit la photo (≈ 240 px, JPEG) pour qu'elle reste légère dans la fiche */
function shrinkPhoto(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 240;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.65));
      };
      img.onerror = () => resolve(null);
      img.src = reader.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
document.getElementById("a_photo_file").addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  pendingPhoto = await shrinkPhoto(f);
  showPhotoPreview();
});
document.getElementById("a_photo_remove").addEventListener("click", (e) => {
  e.preventDefault();
  pendingPhoto = null;
  document.getElementById("a_photo_file").value = "";
  showPhotoPreview();
});

function sortedAnimalsLocal() {
  return [...currentProfile.animals].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
}

function renderAnimals() {
  const list = document.getElementById("animalsList");
  const animals = sortedAnimalsLocal();
  if (animals.length === 0) {
    list.innerHTML = `<div class="empty-state">Aucun animal ajouté pour l'instant ${ic("paw")}</div>`;
    return;
  }
  list.innerHTML = animals.map(a => {
    const realIdx = currentProfile.animals.indexOf(a);
    return `
      <div class="card">
        <div class="card-row">
          <div style="display:flex; align-items:center; gap:10px;">
            ${a.photo ? `<img src="${a.photo}" alt="" style="width:48px; height:48px; border-radius:50%; object-fit:cover; flex-shrink:0;">` : ""}
            <div>
            <div class="card-title">${animalEmoji(a.animal_type)} ${escapeHtml(a.name || "Sans nom")}</div>
            <div class="card-sub">${escapeHtml(a.animal_gender || "")} ${a.animal_gender ? "·" : ""} ${escapeHtml(a.animal_age || "")} ${a.animal_age ? "·" : ""} ${escapeHtml(a.is_cuddly || "")}</div>
            </div>
          </div>
          <div class="flex gap-8">
            <div class="icon-action" data-edit-animal="${realIdx}">${ic("pencil")}</div>
            <div class="icon-action" data-del-animal="${realIdx}">${ic("trash")}</div>
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
  pendingPhoto = (editingAnimalIndex !== null && currentProfile.animals[editingAnimalIndex].photo) || null;
  document.getElementById("a_photo_file").value = "";
  showPhotoPreview();
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
    photo: pendingPhoto || undefined,
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
  document.getElementById("info_owner_email").value = info.owner_email || "";
  document.getElementById("info_address").value = info.address || "";
  document.getElementById("info_city").value = info.city || "";
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
    owner_email: document.getElementById("info_owner_email").value.trim(),
    address: document.getElementById("info_address").value.trim(),
    city: document.getElementById("info_city").value.trim(),
    access_code: document.getElementById("info_access_code").value.trim(),
    vet: document.getElementById("info_vet").value.trim(),
    food: document.getElementById("info_food").value.trim(),
    health_notes: document.getElementById("info_health_notes").value.trim(),
    special_notes: document.getElementById("info_special_notes").value.trim()
  };
}

/* ================= MESSAGES AU CLIENT (vouvoiement) ================= */
let msgPresIndex = null;

function firstWord(s) { return (s || "").trim().split(/\s+/)[0] || ""; }
function listNames(names) {
  if (names.length <= 1) return names[0] || "votre animal";
  return names.slice(0, -1).join(", ") + " et " + names[names.length - 1];
}
function frDateLong(iso) {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
function buildMessage(kind) {
  const p = currentProfile.prestations[msgPresIndex] || {};
  const info = currentProfile.info || {};
  const animals = sortedAnimalsLocal().map(a => a.name).filter(Boolean);
  const plural = animals.length > 1;
  const who = listNames(animals);
  const client = firstWord(info.owner_name || currentProfile.name);
  const me = firstWord(getCurrentUserName());
  const extra = document.getElementById("msgExtra").value.trim();
  const hello = client ? `Bonjour ${client},` : "Bonjour,";

  if (kind === "nouvelles") {
    return `${hello}\n\nJe viens de passer chez vous : ${who} ${plural ? "vont" : "va"} bien. ` +
      (extra ? `${extra.charAt(0).toUpperCase() + extra.slice(1).replace(/[.!]+$/, "")}. ` : "") +
      `Tout est en ordre.\n\nBelle journée,\n${me}`;
  }
  // fin de garde + clés
  let keys;
  if (p.keys_returned) {
    keys = "Les clés vous ont bien été rendues.";
  } else if (p.keys_rdv_date) {
    keys = `Pour les clés, je vous propose de vous les rendre le ${frDateLong(p.keys_rdv_date)}` +
      (p.keys_rdv_time ? ` à ${p.keys_rdv_time}` : "") + (p.keys_rdv ? ` (${p.keys_rdv})` : "") +
      ". Cela vous convient-il ?";
  } else {
    keys = "Pour les clés, pourriez-vous me proposer un moment et un lieu pour que je vous les rende ?";
  }
  return `${hello}\n\nLa garde de ${who} se termine ${p.date_end ? "le " + frDateLong(p.date_end) : "bientôt"}. ` +
    `Tout s'est très bien passé.` + (extra ? ` ${extra.charAt(0).toUpperCase() + extra.slice(1).replace(/[.!]+$/, "")}.` : "") +
    `\n\n${keys}\n\nMerci pour votre confiance,\n${me}`;
}
function phoneForWa(raw) {
  let d = (raw || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d.slice(1);
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("0")) return "33" + d.slice(1);
  return d;
}
function refreshMessage() {
  const kind = document.querySelector("#msgKind .pill.selected").dataset.value;
  const text = buildMessage(kind);
  document.getElementById("msgText").value = text;
  updateMsgLinks();
}
function updateMsgLinks() {
  const text = document.getElementById("msgText").value;
  const info = currentProfile.info || {};
  const phone = (info.owner_phone || "").replace(/\s+/g, "");
  document.getElementById("msgSms").href = `sms:${phone}?&body=${encodeURIComponent(text)}`;
  document.getElementById("msgWa").href = `https://wa.me/${phoneForWa(info.owner_phone)}?text=${encodeURIComponent(text)}`;
  document.getElementById("msgMail").href = `mailto:${info.owner_email || ""}?subject=${encodeURIComponent("Nouvelles de " + listNames(sortedAnimalsLocal().map(a => a.name).filter(Boolean)))}&body=${encodeURIComponent(text)}`;
  document.getElementById("msgHint").textContent = phone ? "" : "Pas de numéro dans l'onglet Infos : copie le message pour l'envoyer.";
}
function openMessage(i) {
  msgPresIndex = i;
  document.getElementById("msgExtra").value = "";
  const p = currentProfile.prestations[i] || {};
  const today = fmtISODate(new Date());
  const kind = (p.date_end && p.date_end <= today) ? "fin" : "nouvelles";
  document.querySelectorAll("#msgKind .pill").forEach(x => x.classList.toggle("selected", x.dataset.value === kind));
  refreshMessage();
  document.getElementById("modalMessage").classList.add("open");
}
document.querySelectorAll("#msgKind .pill").forEach(pill => pill.addEventListener("click", (e) => {
  e.stopPropagation();
  document.querySelectorAll("#msgKind .pill").forEach(x => x.classList.remove("selected"));
  pill.classList.add("selected");
  refreshMessage();
}));
document.getElementById("msgExtra").addEventListener("input", refreshMessage);
document.getElementById("msgText").addEventListener("input", updateMsgLinks);
document.getElementById("msgCopy").addEventListener("click", async () => {
  const t = document.getElementById("msgText");
  try { await navigator.clipboard.writeText(t.value); } catch (e) { t.select(); document.execCommand("copy"); }
  const b = document.getElementById("msgCopy");
  b.innerHTML = ic("check") + " Copié";
  setTimeout(() => { b.innerHTML = ic("note") + " Copier"; }, 1500);
});

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
      keyWarning = `<div class="badge badge-red mt-8">${ic("alert")} Clés non rendues</div>`;
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
            <div class="icon-action" data-msg-pres="${i}" title="Message au client">${ic("chat")}</div>
            <div class="icon-action" data-edit-pres="${i}">${ic("pencil")}</div>
            <div class="icon-action" data-del-pres="${i}">${ic("trash")}</div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-msg-pres]").forEach(btn => {
    btn.addEventListener("click", () => openMessage(Number(btn.dataset.msgPres)));
  });
  list.querySelectorAll("[data-edit-pres]").forEach(btn => {
    btn.addEventListener("click", async () => {
      persistProfile(false);
      await window.flushCloudSync();
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

document.getElementById("addPrestationBtn").addEventListener("click", async () => {
  persistProfile(false);
  await window.flushCloudSync();
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

document.getElementById("saveBtn").addEventListener("click", async () => {
  persistProfile(true);
  await window.flushCloudSync();
  goTo("accueil.html");
});

document.getElementById("deleteFicheBtn").addEventListener("click", async () => {
  if (confirm(`Supprimer définitivement la fiche de ${currentProfile.name} ?`)) {
    profiles = getProfiles();
    delete profiles[currentKey];
    saveProfiles(profiles);
    await window.flushCloudSync();
    goTo("accueil.html");
  }
});

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => btn.closest(".modal-overlay").classList.remove("open"));
});

/* ---------- Site de la fiche (si plusieurs sites) ---------- */
(function initSiteField() {
  const sites = getMySites();
  if (sites.length < 2) return;
  const sel = document.getElementById("ficheSite");
  sel.innerHTML = sites.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  sel.value = siteOfProfile(currentProfile);
  document.getElementById("siteField").style.display = "";
  sel.addEventListener("change", () => { currentProfile.site = sel.value; });
})();

/* ---------- Init ---------- */
loadInfoTab();
renderAnimals();
renderPrestations();
