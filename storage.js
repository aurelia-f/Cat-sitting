// ═══════════════════════════════════
// STORAGE — lecture/écriture localStorage
// ═══════════════════════════════════

const Storage = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch(e) { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch(e) {}
  }
};

function userKey(suffix) {
  const u = Storage.get("cs-current-user") || "default";
  return `cs-${u}-${suffix}`;
}

function getProfiles()   { return Storage.get(userKey("profiles")) || {}; }
function saveProfiles(p) { Storage.set(userKey("profiles"), p); }

function getHistory()    { return Storage.get(userKey("history")) || []; }
function saveHistory(h)  { Storage.set(userKey("history"), h); }

function getCalEvents()  { return Storage.get(userKey("calendar")) || {}; }
function saveCalEvents(c){ Storage.set(userKey("calendar"), c); }

function getTarifs() {
  return Storage.get("cs-tarifs") || {
    independant: { nom:"Indépendant",  desc:"1 visite de 30 min tous les 2 jours", visites:0.5, prix:null, parVisite:true },
    classique:   { nom:"Classique",    desc:"1 visite de 30 min / jour",           visites:1,   prix:9,    parVisite:true },
    delicat:     { nom:"Délicat",      desc:"2 visites de 30 min / jour",          visites:2,   prix:10,   parVisite:true },
    calin:       { nom:"Câlin",        desc:"1 visite de 1h / jour",               visites:1,   prix:15,   parVisite:true },
    royal:       { nom:"Royal",        desc:"1 visite de 2h / jour",               visites:1,   prix:null, parVisite:true },
    nuit:        { nom:"Garde de nuit",desc:"Dort à domicile",                     visites:1,   prix:null, parVisite:false },
    diabetique:  { nom:"Diabétique",   desc:"2 visites + injection insuline",      visites:2,   prix:null, parVisite:true },
  };
}
function saveTarifs(t) { Storage.set("cs-tarifs", t); }

// ── Utilitaires ──
function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("fr-FR", { day:"numeric", month:"long" });
}
function fmtShort(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("fr-FR", { day:"numeric", month:"short" });
}
function fmtDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });
}
function animalEmoji(types) {
  if (!types?.length) return "🐾";
  if (types.includes("Chat"))  return "🐱";
  if (types.includes("Chien")) return "🐶";
  if (types.includes("Lapin")) return "🐰";
  return "🐾";
}

function calcPrestation(p) {
  if (!p) return { days:0, totalVisits:0, basePrice:0, keyPrice:0, total:0 };
  const s = p.date_start ? new Date(p.date_start) : null;
  const e = p.date_end   ? new Date(p.date_end)   : null;
  const days = s && e ? Math.round((e - s) / (1000*60*60*24)) + 1 : 0;
  const keyPrice = p.is_mcer ? 9 : (p.key_return_price ? Number(p.key_return_price) : 0);
  let basePrice = 0, totalVisits = 0;
  const tarifs = getTarifs();
  if (p.is_mcer && p.mcer_key) {
    const t = tarifs[p.mcer_key];
    if (t && t.prix) {
      totalVisits = days * t.visites;
      basePrice   = totalVisits * t.prix;
    }
  } else if (p.prix_mode === "visite") {
    const vpd = p.visits_per_day ? parseInt(p.visits_per_day) : 1;
    totalVisits = days * vpd;
    basePrice   = totalVisits * Number(p.price_per_visit || 0);
  } else {
    basePrice = Number(p.price_per_visit || 0);
    totalVisits = days;
  }
  const total = basePrice > 0 && (p.is_mcer || p.key_return_type) ? basePrice + keyPrice : 0;
  return { days, totalVisits, basePrice, keyPrice, total };
}

function getAllPrestations() {
  const profiles = getProfiles();
  const all = [];
  Object.values(profiles).forEach(p => {
    (p.prestations || []).forEach(pr => {
      all.push({ ...pr, animalName: p.name, animalTypes: p.animal_type });
    });
  });
  return all.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
}

function getGardesAvenir() {
  const today = new Date(); today.setHours(0,0,0,0);
  return getAllPrestations().filter(p => p.date_start && new Date(p.date_start) >= today);
}

function getNextKeyRdvs() {
  const profiles = getProfiles();
  const rdvs = [];
  Object.values(profiles).forEach(p => {
    (p.prestations || []).forEach(pr => {
      if (!pr.keys_picked_up && (pr.keys_pickup_rdv || pr.keys_pickup_date))
        rdvs.push({ nom:p.name, types:p.animal_type, rdv:pr.keys_pickup_rdv, date:pr.keys_pickup_date, time:pr.keys_pickup_time, type:"récupération" });
      if (pr.keys_picked_up && !pr.keys_returned && (pr.keys_rdv || pr.keys_rdv_date))
        rdvs.push({ nom:p.name, types:p.animal_type, rdv:pr.keys_rdv, date:pr.keys_rdv_date, time:pr.keys_rdv_time, type:"restitution" });
    });
  });
  rdvs.sort((a,b) => {
    const da = a.date ? new Date(a.date + (a.time ? "T"+a.time : "")) : new Date("9999");
    const db = b.date ? new Date(b.date + (b.time ? "T"+b.time : "")) : new Date("9999");
    return da - db;
  });
  return rdvs;
}

function getAnimalsByDate(ds) {
  const profiles = getProfiles();
  const res = [];
  Object.values(profiles).forEach(p => {
    (p.prestations || []).forEach(pr => {
      if (!pr.date_start || !pr.date_end) return;
      const s = new Date(pr.date_start), e = new Date(pr.date_end), d = new Date(ds);
      if (d >= s && d <= e)
        res.push({ animalName:p.name, animalTypes:p.animal_type, visitTime:pr.visit_time });
    });
  });
  return res;
}

function getKeyRdvsByDate(ds) {
  const profiles = getProfiles();
  const res = [];
  Object.values(profiles).forEach(p => {
    (p.prestations || []).forEach(pr => {
      if (pr.keys_pickup_date === ds && !pr.keys_picked_up)
        res.push({ nom:p.name, types:p.animal_type, type:"récup", time:pr.keys_pickup_time||"" });
      if (pr.keys_rdv_date === ds && !pr.keys_returned)
        res.push({ nom:p.name, types:p.animal_type, type:"rendu", time:pr.keys_rdv_time||"" });
    });
  });
  res.sort((a,b) => (a.time||"99:99").localeCompare(b.time||"99:99"));
  return res;
}

function getDIM(y, m) { return new Date(y, m+1, 0).getDate(); }
function getFDOM(y, m) { return (new Date(y, m, 1).getDay() + 6) % 7; }
function fmtMonthYear(y, m) {
  return new Date(y, m, 1).toLocaleDateString("fr-FR", { month:"long", year:"numeric" });
}

function goTo(page) { window.location.href = page; }
function getCurrentUser() { return Storage.get("cs-current-user") || ""; }
function getCurrentUserName() { return Storage.get("cs-current-name") || getCurrentUser(); }
