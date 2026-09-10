/* ============================================
   CAT SITTING — storage.js
   Fonctions partagées : stockage, tri, calcul, utils
   DOIT être chargé EN PREMIER dans chaque page HTML
   ============================================ */

/* ---------- Stockage bas niveau ---------- */
const Storage = {
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error("Storage.get error", key, e);
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error("Storage.set error", key, e);
      return false;
    }
  },
  remove(key) {
    localStorage.removeItem(key);
  }
};

/* ---------- Utilisateur courant ---------- */
function getCurrentUser() {
  return localStorage.getItem("cs-current-user") || null;
}

function getCurrentUserName() {
  return localStorage.getItem("cs-current-name") || "";
}

function setCurrentUser(key, name) {
  localStorage.setItem("cs-current-user", key);
  localStorage.setItem("cs-current-name", name);
}

function logoutCurrentUser() {
  localStorage.removeItem("cs-current-user");
  localStorage.removeItem("cs-current-name");
}

function userKey(suffix) {
  const u = getCurrentUser() || "guest";
  return `cs-${u}-${suffix}`;
}

/* ---------- Données principales (par utilisateur) ---------- */
function getProfiles() {
  return Storage.get(userKey("profiles")) || {};
}
function saveProfiles(p) {
  return Storage.set(userKey("profiles"), p);
}

function getCalEvents() {
  return Storage.get(userKey("calevents")) || {};
}
function saveCalEvents(c) {
  return Storage.set(userKey("calevents"), c);
}

function getTarifs() {
  return Storage.get(userKey("tarifs")) || DEFAULT_TARIFS;
}
function saveTarifs(t) {
  return Storage.set(userKey("tarifs"), t);
}

/* ---------- Tarifs MCER (définitifs) ---------- */
const DEFAULT_TARIFS = {
  independant: { nom: "Indépendant", desc: "1 visite de 30 min tous les 2 jours", visites: 0.5, prix: 10.5, parVisite: true },
  classique:   { nom: "Classique",   desc: "1 visite de 30 min / jour",           visites: 1,   prix: 9,    parVisite: true },
  delicat:     { nom: "Délicat",     desc: "2 visites de 30 min / jour",          visites: 2,   prix: 10,   parVisite: true },
  calin:       { nom: "Câlin",       desc: "1 visite de 1h / jour",               visites: 1,   prix: 15,   parVisite: true },
  royal:       { nom: "Royal",       desc: "1 visite de 2h / jour",               visites: 1,   prix: 25,   parVisite: true },
  nuit:        { nom: "Garde de nuit", desc: "Dort à domicile",                   visites: 1,   prix: 30,   parVisite: false },
  diabetique:  { nom: "Diabétique",  desc: "2 visites + injection insuline",      visites: 2,   prix: 12.5, parVisite: true }
};

/* La remise des clés en main propre en fin de mission compte comme une visite Classique (9€), quelle que soit la formule */
const KEY_RETURN_IN_PERSON_PRICE = 9;

/* ---------- Tri alphabétique ---------- */
function getSortedOwners() {
  const profiles = getProfiles();
  return Object.keys(profiles).sort((a, b) => {
    const nameA = profiles[a].name || a;
    const nameB = profiles[b].name || b;
    return nameA.localeCompare(nameB, "fr");
  });
}

function getSortedAnimals(key) {
  const profiles = getProfiles();
  const p = profiles[key];
  if (!p) return [];
  if (p.animals && p.animals.length > 0) {
    return [...p.animals].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  }
  // rétrocompatibilité : ancien format (fiche par animal)
  if (p.name) {
    return [{
      name: p.name,
      animal_type: p.animal_type || [],
      animal_gender: p.animal_gender || "",
      animal_age: p.animal_age || "",
      is_cuddly: p.is_cuddly || "",
      comes_to_me: p.comes_to_me || "",
      is_playful: p.is_playful || "",
      eats_how: p.eats_how || "",
      personality: p.personality || [],
      favorite_things: p.favorite_things || [],
      dislikes: p.dislikes || [],
      special_behavior: p.special_behavior || "",
      has_litter: p.has_litter || "",
      has_water: p.has_water || "",
      has_croquettes: p.has_croquettes || "",
      has_pate: p.has_pate || ""
    }];
  }
  return [];
}

/* ---------- Calcul de prestation ---------- */
function calcPrestation(p) {
  if (!p || !p.date_start || !p.date_end) {
    return { days: 0, totalVisits: 0, basePrice: 0, keyPrice: 0, total: 0 };
  }
  const start = new Date(p.date_start);
  const end = new Date(p.date_end);
  let days = Math.round((end - start) / 86400000) + 1;
  if (days < 1) days = 1;

  let visitesParJour = 1;
  let prixParVisite = 0;

  if (p.is_mcer && p.mcer_key) {
    const t = DEFAULT_TARIFS[p.mcer_key];
    if (t) {
      visitesParJour = t.visites;
      prixParVisite = (p.price_per_visit != null ? p.price_per_visit : t.prix) || 0;
    }
  } else {
    visitesParJour = p.mcer_visites || 1;
    prixParVisite = p.price_per_visit || 0;
  }

  let totalVisits = Math.round(days * visitesParJour * 100) / 100;

  // Si la formule comporte 2 visites/jour, on ajuste selon le moment d'arrivée/départ
  if (visitesParJour === 2) {
    if (p.start_period === "apres-midi") totalVisits -= 1; // visite du matin manquée le 1er jour
    if (p.end_period === "matin") totalVisits -= 1;         // visite du soir manquée le dernier jour
    if (totalVisits < 0) totalVisits = 0;
  }

  const basePrice = (p.mcer_par_visite === false)
    ? (prixParVisite * days)
    : Math.round(totalVisits * prixParVisite * 100) / 100;

  let keyPrice = 0;
  if (p.key_return_type === "9") keyPrice = KEY_RETURN_IN_PERSON_PRICE;
  else if (p.key_return_type === "0") keyPrice = 0;
  else if (p.key_return_type === "autre") keyPrice = parseFloat(p.key_return_price) || 0;
  else keyPrice = parseFloat(p.key_return_price) || 0;

  const total = Math.round((basePrice + keyPrice) * 100) / 100;

  return { days, totalVisits, basePrice, keyPrice, total };
}

function getAllPrestations() {
  const profiles = getProfiles();
  const all = [];
  Object.entries(profiles).forEach(([key, p]) => {
    const animals = (p.animals && p.animals.length > 0)
      ? [...p.animals].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"))
      : null;
    const animalName = animals
      ? animals.map(a => a.name).filter(Boolean).join(", ")
      : (p.name || key);
    const animalTypes = animals
      ? animals.flatMap(a => a.animal_type || [])
      : (p.animal_type || []);
    (p.prestations || []).forEach((pr, idx) => {
      all.push({
        ...pr,
        animalName: animalName || "À définir",
        animalTypes,
        ownerKey: key,
        ownerName: p.name || key,
        idx
      });
    });
  });
  return all.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
}

function getGardesEnCours() {
  const today = fmtISODate(new Date());
  return getAllPrestations().filter(p => p.date_start <= today && p.date_end >= today);
}

function getGardesAvenir() {
  const today = fmtISODate(new Date());
  return getAllPrestations().filter(p => p.date_start > today);
}

function getClesARegler() {
  const today = fmtISODate(new Date());
  return getAllPrestations().filter(p => {
    const finished = p.date_end < today;
    const unresolved = (!p.keys_picked_up && p.keys_pickup_rdv !== undefined && p.key_return_type !== undefined)
      ? false : false;
    // Une garde est "clés à régler" si elle est terminée et que le rendu des clés n'a pas été fait
    return finished && !p.keys_returned;
  });
}

function getNextKeyRdvs() {
  const now = new Date();
  const items = [];
  const profiles = getProfiles();
  Object.entries(profiles).forEach(([key, p]) => {
    (p.prestations || []).forEach((pr, idx) => {
      const animals = getSortedAnimals(key);
      const animalName = animals.map(a => a.name).filter(Boolean).join(", ") || "À définir";
      if (!pr.keys_picked_up && pr.keys_pickup_date) {
        const dt = new Date(`${pr.keys_pickup_date}T${pr.keys_pickup_time || "00:00"}`);
        if (dt >= stripTime(now)) {
          items.push({
            type: "recuperation",
            date: pr.keys_pickup_date,
            time: pr.keys_pickup_time || "",
            place: pr.keys_pickup_rdv || "",
            ownerKey: key,
            animalName,
            idx
          });
        }
      }
      if (!pr.keys_returned && pr.keys_rdv_date) {
        const dt = new Date(`${pr.keys_rdv_date}T${pr.keys_rdv_time || "00:00"}`);
        if (dt >= stripTime(now)) {
          items.push({
            type: "rendu",
            date: pr.keys_rdv_date,
            time: pr.keys_rdv_time || "",
            place: pr.keys_rdv || "",
            ownerKey: key,
            animalName,
            idx
          });
        }
      }
    });
  });
  return items.sort((a, b) => {
    const da = new Date(`${a.date}T${a.time || "00:00"}`);
    const db = new Date(`${b.date}T${b.time || "00:00"}`);
    return da - db;
  });
}

function stripTime(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function getAnimalsByDate(ds) {
  const profiles = getProfiles();
  const result = [];
  Object.entries(profiles).forEach(([key, p]) => {
    (p.prestations || []).forEach(pr => {
      if (pr.date_start <= ds && pr.date_end >= ds) {
        const animals = getSortedAnimals(key);
        result.push({ ownerKey: key, animals, prestation: pr });
      }
    });
  });
  return result;
}

function getKeyRdvsByDate(ds) {
  const all = [];
  const profiles = getProfiles();
  Object.entries(profiles).forEach(([key, p]) => {
    (p.prestations || []).forEach((pr, idx) => {
      const animals = getSortedAnimals(key);
      const animalName = animals.map(a => a.name).filter(Boolean).join(", ") || "À définir";
      if (!pr.keys_picked_up && pr.keys_pickup_date === ds) {
        all.push({ type: "recuperation", time: pr.keys_pickup_time || "", place: pr.keys_pickup_rdv || "", ownerKey: key, animalName, idx });
      }
      if (!pr.keys_returned && pr.keys_rdv_date === ds) {
        all.push({ type: "rendu", time: pr.keys_rdv_time || "", place: pr.keys_rdv || "", ownerKey: key, animalName, idx });
      }
    });
  });
  return all.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

/* ---------- Utils dates ---------- */
function fmtISODate(d) {
  const c = new Date(d);
  const y = c.getFullYear();
  const m = String(c.getMonth() + 1).padStart(2, "0");
  const day = String(c.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MOIS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const JOURS_FR = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];

function fmtDate(d) {
  if (!d) return "";
  const c = typeof d === "string" ? new Date(d + "T00:00:00") : new Date(d);
  return `${JOURS_FR[c.getDay()]} ${c.getDate()} ${MOIS_FR[c.getMonth()]}`;
}

function fmtShort(d) {
  if (!d) return "";
  const c = typeof d === "string" ? new Date(d + "T00:00:00") : new Date(d);
  return `${String(c.getDate()).padStart(2,"0")}/${String(c.getMonth()+1).padStart(2,"0")}`;
}

function fmtDateTime(iso) {
  if (!iso) return "";
  const c = new Date(iso);
  return `${fmtShort(c)} à ${String(c.getHours()).padStart(2,"0")}h${String(c.getMinutes()).padStart(2,"0")}`;
}

/* ---------- Emoji animal ---------- */
function animalEmoji(types) {
  if (!types || types.length === 0) return "🐾";
  const t = types[0];
  if (t === "Chat") return "🐱";
  if (t === "Chien") return "🐶";
  if (t === "Lapin") return "🐰";
  return "🐾";
}

/* ---------- Navigation ---------- */
function goTo(page) {
  window.location.href = page;
}

/* ---------- Hash simple (mot de passe, etc.) ---------- */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(36);
}

/* ---------- Génération de clé technique ---------- */
function techKey(prefix) {
  const clean = (prefix || "user").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${clean}-${Date.now().toString(36)}`;
}

function ownerTechKey(ownerName) {
  const clean = (ownerName || "proprio").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${clean}-${Date.now().toString(36)}`;
}

/* ---------- Enregistrement du service worker (PWA) ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW registration failed", e));
  });
}

