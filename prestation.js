/* ============================================
   CAT SITTING — prestation.js
   ============================================ */

if (!getCurrentUser()) {
  goTo("index.html");
}

const params = new URLSearchParams(window.location.search);
const ownerKey = params.get("key");
const isNew = params.get("new") === "1";
const editIdx = params.get("idx") !== null ? parseInt(params.get("idx")) : null;

if (!ownerKey) goTo("accueil.html");

let profiles = getProfiles();
let profile = profiles[ownerKey];
if (!profile) goTo("accueil.html");
if (!profile.prestations) profile.prestations = [];

let prestation = isNew ? {} : JSON.parse(JSON.stringify(profile.prestations[editIdx] || {}));

document.getElementById("backBtn").addEventListener("click", () => goTo(`fiche.html?key=${encodeURIComponent(ownerKey)}`));

/* ---------- Build MCER pill group ---------- */
const mcerGroup = document.getElementById("mcerPillGroup");
Object.entries(DEFAULT_TARIFS).forEach(([key, t]) => {
  const pill = document.createElement("div");
  pill.className = "pill";
  pill.dataset.mcerKey = key;
  pill.textContent = t.nom;
  mcerGroup.appendChild(pill);
});

/* ---------- State helpers ---------- */
function setSwitch(el, on) {
  el.classList.toggle("on", !!on);
}
function isOn(el) {
  return el.classList.contains("on");
}

/* ---------- Toggles: clés récupérées / rendues ---------- */
const swPickedUp = document.getElementById("sw_keys_picked_up");
const swReturned = document.getElementById("sw_keys_returned");
const pickupBlock = document.getElementById("pickupRdvBlock");
const returnBlock = document.getElementById("returnRdvBlock");

function refreshKeyBlocks() {
  pickupBlock.style.display = isOn(swPickedUp) ? "none" : "block";
  returnBlock.style.display = isOn(swReturned) ? "none" : "block";
}

swPickedUp.addEventListener("click", () => { setSwitch(swPickedUp, !isOn(swPickedUp)); refreshKeyBlocks(); });
swReturned.addEventListener("click", () => { setSwitch(swReturned, !isOn(swReturned)); refreshKeyBlocks(); });

/* ---------- Mode tarif (MCER vs manuel) ---------- */
const tarifModeGroup = document.getElementById("tarifModeGroup");
const mcerBlock = document.getElementById("mcerBlock");
const manuelBlock = document.getElementById("manuelBlock");
const keyPriceSection = document.getElementById("keyPriceSection");

let tarifMode = "mcer"; // mcer | manuel
let selectedMcerKey = null;

tarifModeGroup.querySelectorAll(".pill").forEach(pill => {
  pill.addEventListener("click", () => {
    tarifModeGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
    pill.classList.add("selected");
    tarifMode = pill.dataset.mode;
    mcerBlock.style.display = tarifMode === "mcer" ? "block" : "none";
    manuelBlock.style.display = tarifMode === "manuel" ? "block" : "none";
    keyPriceSection.style.display = tarifMode === "manuel" ? "block" : "none";
    refreshPeriodSection();
  });
});

mcerGroup.querySelectorAll(".pill").forEach(pill => {
  pill.addEventListener("click", () => {
    mcerGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
    pill.classList.add("selected");
    selectedMcerKey = pill.dataset.mcerKey;
    const t = DEFAULT_TARIFS[selectedMcerKey];
    document.getElementById("mcerDesc").textContent = t.desc;
    document.getElementById("price_per_visit_mcer").value = t.prix != null ? t.prix : "";
    refreshPeriodSection();
  });
});

/* ---------- Rendu des clés (mode manuel) ---------- */
const keyReturnGroup = document.getElementById("keyReturnPillGroup");
const keyReturnAutreBlock = document.getElementById("keyReturnAutreBlock");
let keyReturnType = "0";

keyReturnGroup.querySelectorAll(".pill").forEach(pill => {
  pill.addEventListener("click", () => {
    keyReturnGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
    pill.classList.add("selected");
    keyReturnType = pill.dataset.keyReturn;
    keyReturnAutreBlock.style.display = keyReturnType === "autre" ? "block" : "none";
    updateRecap();
  });
});

/* ---------- Début / fin de journée (si 2 visites/jour) ---------- */
const periodSection = document.getElementById("periodSection");
const startPeriodGroup = document.getElementById("startPeriodGroup");
const endPeriodGroup = document.getElementById("endPeriodGroup");

function currentVisitesParJour() {
  if (tarifMode === "mcer" && selectedMcerKey) {
    const t = DEFAULT_TARIFS[selectedMcerKey];
    return t ? t.visites : 1;
  }
  return parseFloat(document.getElementById("mcer_visites").value) || 1;
}

function refreshPeriodSection() {
  const show = currentVisitesParJour() === 2;
  periodSection.style.display = show ? "block" : "none";
  if (show) {
    if (!startPeriodGroup.querySelector(".pill.selected")) {
      startPeriodGroup.querySelector('[data-period="matin"]').classList.add("selected");
    }
    if (!endPeriodGroup.querySelector(".pill.selected")) {
      endPeriodGroup.querySelector('[data-period="apres-midi"]').classList.add("selected");
    }
  }
  updateRecap();
}

startPeriodGroup.querySelectorAll(".pill").forEach(pill => {
  pill.addEventListener("click", () => {
    startPeriodGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
    pill.classList.add("selected");
    updateRecap();
  });
});
endPeriodGroup.querySelectorAll(".pill").forEach(pill => {
  pill.addEventListener("click", () => {
    endPeriodGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
    pill.classList.add("selected");
    updateRecap();
  });
});

/* ---------- Paiement ---------- */
const paymentStatusGroup = document.getElementById("paymentStatusGroup");
const paymentModeGroup = document.getElementById("paymentModeGroup");

paymentStatusGroup.querySelectorAll(".pill").forEach(pill => {
  pill.addEventListener("click", () => {
    paymentStatusGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
    pill.classList.add("selected");
  });
});
paymentModeGroup.querySelectorAll(".pill").forEach(pill => {
  pill.addEventListener("click", () => {
    paymentModeGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
    pill.classList.add("selected");
  });
});

/* ---------- Recalc on date/price change ---------- */
["date_start", "date_end", "price_per_visit_mcer", "mcer_visites", "price_per_visit_manuel", "key_return_price_autre"]
  .forEach(id => {
    document.getElementById(id).addEventListener("input", updateRecap);
  });

document.getElementById("sw_par_visite").addEventListener("click", function () {
  setSwitch(this, !isOn(this));
  updateRecap();
});

document.getElementById("mcer_visites").addEventListener("input", refreshPeriodSection);

function buildPrestationObject() {
  const p = {
    date_start: document.getElementById("date_start").value,
    date_end: document.getElementById("date_end").value,
    visit_time: document.getElementById("visit_time").value.trim(),
    keys_picked_up: isOn(swPickedUp),
    keys_pickup_date: document.getElementById("keys_pickup_date").value,
    keys_pickup_time: document.getElementById("keys_pickup_time").value,
    keys_pickup_rdv: document.getElementById("keys_pickup_rdv").value.trim(),
    keys_returned: isOn(swReturned),
    keys_rdv_date: document.getElementById("keys_rdv_date").value,
    keys_rdv_time: document.getElementById("keys_rdv_time").value,
    keys_rdv: document.getElementById("keys_rdv").value.trim(),
    is_mcer: tarifMode === "mcer"
  };

  if (tarifMode === "mcer") {
    const t = DEFAULT_TARIFS[selectedMcerKey] || {};
    p.mcer_key = selectedMcerKey;
    p.mcer_nom = t.nom || "";
    p.mcer_visites = t.visites || 1;
    p.mcer_par_visite = t.parVisite !== false;
    p.price_per_visit = parseFloat(document.getElementById("price_per_visit_mcer").value) || 0;
    p.key_return_type = AUTO_KEY_RETURN_9.includes(selectedMcerKey) ? "9" : "0";
    p.key_return_price = p.key_return_type === "9" ? "9" : "0";
  } else {
    p.mcer_key = null;
    p.mcer_nom = "Manuel";
    p.mcer_visites = parseFloat(document.getElementById("mcer_visites").value) || 1;
    p.mcer_par_visite = isOn(document.getElementById("sw_par_visite"));
    p.price_per_visit = parseFloat(document.getElementById("price_per_visit_manuel").value) || 0;
    p.key_return_type = keyReturnType;
    p.key_return_price = keyReturnType === "autre"
      ? (document.getElementById("key_return_price_autre").value || "0")
      : keyReturnType;
  }

  const statusPill = paymentStatusGroup.querySelector(".pill.selected");
  p.payment_status = statusPill ? statusPill.dataset.status : "attente";
  const modePill = paymentModeGroup.querySelector(".pill.selected");
  p.payment_mode = modePill ? modePill.dataset.pmode : "";

  const startPill = startPeriodGroup.querySelector(".pill.selected");
  p.start_period = startPill ? startPill.dataset.period : "matin";
  const endPill = endPeriodGroup.querySelector(".pill.selected");
  p.end_period = endPill ? endPill.dataset.period : "apres-midi";

  return p;
}

function updateRecap() {
  const p = buildPrestationObject();
  const calc = calcPrestation(p);

  const recapSection = document.getElementById("recapSection");
  const paymentSection = document.getElementById("paymentSection");

  if (calc.total > 0) {
    recapSection.style.display = "block";
    paymentSection.style.display = "block";
    document.getElementById("recap_days").textContent = `${calc.days} jour${calc.days > 1 ? "s" : ""}`;
    document.getElementById("recap_visits").textContent = calc.totalVisits;
    document.getElementById("recap_base").textContent = `${calc.basePrice}€`;
    document.getElementById("recap_key").textContent = `${calc.keyPrice}€`;
    document.getElementById("recap_total").textContent = `${calc.total}€`;
  } else {
    recapSection.style.display = "none";
    paymentSection.style.display = "none";
  }
}

/* ---------- Load existing data ---------- */
function loadExisting() {
  if (isNew || !prestation || Object.keys(prestation).length === 0) {
    // valeurs par défaut
    mcerGroup.querySelector('[data-mcer-key="classique"]')?.click();
    keyReturnGroup.querySelector('[data-key-return="0"]').click();
    paymentStatusGroup.querySelector('[data-status="attente"]').click();
    refreshKeyBlocks();
    refreshPeriodSection();
    return;
  }

  document.getElementById("date_start").value = prestation.date_start || "";
  document.getElementById("date_end").value = prestation.date_end || "";
  document.getElementById("visit_time").value = prestation.visit_time || "";

  setSwitch(swPickedUp, !!prestation.keys_picked_up);
  document.getElementById("keys_pickup_date").value = prestation.keys_pickup_date || "";
  document.getElementById("keys_pickup_time").value = prestation.keys_pickup_time || "";
  document.getElementById("keys_pickup_rdv").value = prestation.keys_pickup_rdv || "";

  setSwitch(swReturned, !!prestation.keys_returned);
  document.getElementById("keys_rdv_date").value = prestation.keys_rdv_date || "";
  document.getElementById("keys_rdv_time").value = prestation.keys_rdv_time || "";
  document.getElementById("keys_rdv").value = prestation.keys_rdv || "";
  refreshKeyBlocks();

  tarifMode = prestation.is_mcer !== false && prestation.mcer_key ? "mcer" : "manuel";
  tarifModeGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
  tarifModeGroup.querySelector(`[data-mode="${tarifMode}"]`).classList.add("selected");
  mcerBlock.style.display = tarifMode === "mcer" ? "block" : "none";
  manuelBlock.style.display = tarifMode === "manuel" ? "block" : "none";
  keyPriceSection.style.display = tarifMode === "manuel" ? "block" : "none";

  if (tarifMode === "mcer" && prestation.mcer_key) {
    selectedMcerKey = prestation.mcer_key;
    const pill = mcerGroup.querySelector(`[data-mcer-key="${selectedMcerKey}"]`);
    if (pill) {
      mcerGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
      pill.classList.add("selected");
      document.getElementById("mcerDesc").textContent = DEFAULT_TARIFS[selectedMcerKey].desc;
    }
    document.getElementById("price_per_visit_mcer").value = prestation.price_per_visit != null ? prestation.price_per_visit : "";
  } else {
    document.getElementById("mcer_visites").value = prestation.mcer_visites || 1;
    document.getElementById("price_per_visit_manuel").value = prestation.price_per_visit || "";
    setSwitch(document.getElementById("sw_par_visite"), prestation.mcer_par_visite !== false);
    keyReturnType = prestation.key_return_type || "0";
    keyReturnGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
    const krPill = keyReturnGroup.querySelector(`[data-key-return="${keyReturnType}"]`);
    if (krPill) krPill.classList.add("selected");
    keyReturnAutreBlock.style.display = keyReturnType === "autre" ? "block" : "none";
    if (keyReturnType === "autre") {
      document.getElementById("key_return_price_autre").value = prestation.key_return_price || "";
    }
  }

  paymentStatusGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
  const statusPill = paymentStatusGroup.querySelector(`[data-status="${prestation.payment_status || "attente"}"]`);
  if (statusPill) statusPill.classList.add("selected");

  paymentModeGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
  if (prestation.payment_mode) {
    const modePill = paymentModeGroup.querySelector(`[data-pmode="${prestation.payment_mode}"]`);
    if (modePill) modePill.classList.add("selected");
  }

  startPeriodGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
  if (prestation.start_period) {
    const sp = startPeriodGroup.querySelector(`[data-period="${prestation.start_period}"]`);
    if (sp) sp.classList.add("selected");
  }
  endPeriodGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
  if (prestation.end_period) {
    const ep = endPeriodGroup.querySelector(`[data-period="${prestation.end_period}"]`);
    if (ep) ep.classList.add("selected");
  }

  refreshPeriodSection();
}

loadExisting();

/* ---------- Save ---------- */
document.getElementById("saveBtn").addEventListener("click", () => {
  const dateStart = document.getElementById("date_start").value;
  const dateEnd = document.getElementById("date_end").value;
  if (!dateStart || !dateEnd) {
    alert("Merci de renseigner les dates de début et de fin.");
    return;
  }
  if (dateEnd < dateStart) {
    alert("La date de fin doit être après la date de début.");
    return;
  }

  const p = buildPrestationObject();

  profiles = getProfiles();
  profile = profiles[ownerKey];
  if (!profile) { goTo("accueil.html"); return; }
  if (!profile.prestations) profile.prestations = [];

  if (isNew) {
    profile.prestations.push(p);
  } else {
    profile.prestations[editIdx] = p;
  }
  profiles[ownerKey] = profile;
  saveProfiles(profiles);

  goTo(`fiche.html?key=${encodeURIComponent(ownerKey)}`);
});
