/* ============================================
   CAT SITTING — import.js
   Analyse d'un mail de mission et création/rapprochement de fiche
   ============================================ */

await window.hydrateFromSupabase();
if (!getCurrentUser()) {
  goTo("index.html");
}

document.getElementById("backBtn").addEventListener("click", () => goTo("accueil.html"));

/* ---------- Construction des pills de formule ---------- */
const formulaGroup = document.getElementById("formulaPillGroup");
Object.entries(DEFAULT_TARIFS).forEach(([key, t]) => {
  const pill = document.createElement("div");
  pill.className = "pill";
  pill.dataset.mcerKey = key;
  pill.textContent = t.nom;
  formulaGroup.appendChild(pill);
});
let selectedFormulaKey = null;

const periodSection = document.getElementById("periodSection");
const startPeriodGroup = document.getElementById("startPeriodGroup");
const endPeriodGroup = document.getElementById("endPeriodGroup");

function refreshPeriodSection() {
  const t = DEFAULT_TARIFS[selectedFormulaKey];
  const show = t && t.visites === 2;
  periodSection.style.display = show ? "block" : "none";
  if (show) {
    if (!startPeriodGroup.querySelector(".pill.selected")) {
      startPeriodGroup.querySelector('[data-period="matin"]').classList.add("selected");
    }
    if (!endPeriodGroup.querySelector(".pill.selected")) {
      endPeriodGroup.querySelector('[data-period="apres-midi"]').classList.add("selected");
    }
  }
}

startPeriodGroup.querySelectorAll(".pill").forEach(pill => {
  pill.addEventListener("click", () => {
    startPeriodGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
    pill.classList.add("selected");
    updatePriceComparison();
  });
});
endPeriodGroup.querySelectorAll(".pill").forEach(pill => {
  pill.addEventListener("click", () => {
    endPeriodGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
    pill.classList.add("selected");
    updatePriceComparison();
  });
});

formulaGroup.querySelectorAll(".pill").forEach(pill => {
  pill.addEventListener("click", () => {
    formulaGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
    pill.classList.add("selected");
    selectedFormulaKey = pill.dataset.mcerKey;
    refreshPeriodSection();
    updatePriceComparison();
  });
});

document.getElementById("p_date_start").addEventListener("input", updatePriceComparison);
document.getElementById("p_date_end").addEventListener("input", updatePriceComparison);


function updatePriceComparison() {
  const t = DEFAULT_TARIFS[selectedFormulaKey];
  const dateStart = document.getElementById("p_date_start").value;
  const dateEnd = document.getElementById("p_date_end").value;
  const hintEl = document.getElementById("priceAnnounced");

  if (!t || !dateStart || !dateEnd) {
    hintEl.textContent = parsed && parsed.priceAnnounced
      ? `Montant trouvé dans le mail : ${parsed.priceAnnounced} — pré-rempli ci-dessus, modifie-le si besoin.`
      : "Laisse le champ vide pour un calcul automatique, ou saisis un prix fixe.";
    return;
  }

  const startPill = startPeriodGroup.querySelector(".pill.selected");
  const endPill = endPeriodGroup.querySelector(".pill.selected");
  const autoCalc = calcPrestation({
    date_start: dateStart,
    date_end: dateEnd,
    is_mcer: true,
    mcer_key: selectedFormulaKey,
    mcer_visites: t.visites,
    mcer_par_visite: t.parVisite !== false,
    price_per_visit: t.prix,
    key_return_type: "9",
    start_period: startPill ? startPill.dataset.period : "matin",
    end_period: endPill ? endPill.dataset.period : "apres-midi"
  });

  const mailBit = parsed && parsed.priceAnnounced ? `Montant du mail : ${parsed.priceAnnounced} · ` : "";
  const ecart = parsed && parsed.priceAnnouncedNumber != null && Math.abs(parsed.priceAnnouncedNumber - autoCalc.total) > 0.5
    ? ` ⚠️ écart avec le calcul de l'app`
    : "";
  hintEl.textContent = `${mailBit}Calcul automatique de l'app : ${autoCalc.total}€${ecart} — corrige le prix ci-dessus si besoin.`;
}

/* ---------- Parsing du texte du mail ---------- */
function parseFrenchDate(str) {
  // JJ/MM/AAAA -> AAAA-MM-JJ
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function guessFormulaKey(rawName) {
  const n = normalizeText(rawName);
  const entry = Object.entries(DEFAULT_TARIFS).find(([key, t]) => normalizeText(t.nom) === n);
  return entry ? entry[0] : null;
}

function parseMissionEmail(text) {
  const result = {
    formulaKey: null,
    formulaRaw: "",
    date_start: "",
    date_end: "",
    priceAnnounced: "",
    priceAnnouncedNumber: null,
    ownerName: "",
    address: "",
    email: "",
    phone: "",
    remarks: ""
  };

  // Formule
  const formuleMatch = text.match(/mission\s+(.+?)\s+qui vous a été affectée/i);
  if (formuleMatch) {
    result.formulaRaw = formuleMatch[1].trim();
    result.formulaKey = guessFormulaKey(result.formulaRaw);
  }

  // Dates
  const datesMatch = text.match(/du\s+(\d{2}\/\d{2}\/\d{4})\s+au\s+(\d{2}\/\d{2}\/\d{4})/i);
  if (datesMatch) {
    result.date_start = parseFrenchDate(datesMatch[1]);
    result.date_end = parseFrenchDate(datesMatch[2]);
  }

  // Prix annoncé
  const priceMatch = text.match(/montant de\s+([\d.,]+)\s*€/i);
  if (priceMatch) {
    const num = parseFloat(priceMatch[1].replace(",", "."));
    result.priceAnnounced = priceMatch[1].replace(",", ".") + "€";
    result.priceAnnouncedNumber = isNaN(num) ? null : num;
  }

  // Email
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) result.email = emailMatch[0];

  // Téléphone (format français)
  const phoneMatch = text.match(/0[1-9](?:[\s.-]?\d{2}){4}/);
  if (phoneMatch) result.phone = phoneMatch[0];

  // Nom + adresse (bloc après "coordonnées du client")
  const coordIdx = text.search(/coordonnées du client/i);
  if (coordIdx !== -1) {
    const after = text.slice(coordIdx);
    const lines = after.split("\n").map(l => l.trim()).filter(Boolean);
    // lines[0] = "Voici les coordonnées du client :"
    const contentLines = lines.slice(1);
    const addressParts = [];
    for (const line of contentLines) {
      if (line.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)) break; // stop at email line
      if (line.match(/0[1-9](?:[\s.-]?\d{2}){4}/)) break; // stop at phone line
      if (!result.ownerName) {
        result.ownerName = line;
      } else {
        addressParts.push(line);
      }
    }
    result.address = addressParts.join(", ");
  }

  // Remarques
  const remarkIdx = text.search(/questions\s*\/?\s*remarques/i);
  if (remarkIdx !== -1) {
    let remarkText = text.slice(remarkIdx).replace(/questions\s*\/?\s*remarques\s*:?/i, "").trim();
    // coupe avant une formule de politesse finale si présente
    remarkText = remarkText.split(/\n\s*(bien cordialement|cordialement|merci d'avance)/i)[0].trim();
    result.remarks = remarkText;
  }

  return result;
}

/* ---------- Étape 1 : analyse ---------- */
let parsed = null;
let matchedOwnerKey = null;
let linkMode = null; // "link" | "new"

document.getElementById("analyzeBtn").addEventListener("click", () => {
  const text = document.getElementById("mailInput").value;
  if (!text.trim()) {
    alert("Colle d'abord le texte du mail.");
    return;
  }
  parsed = parseMissionEmail(text);

  // Pré-remplissage
  if (parsed.formulaKey) {
    const pill = formulaGroup.querySelector(`[data-mcer-key="${parsed.formulaKey}"]`);
    if (pill) {
      formulaGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
      pill.classList.add("selected");
      selectedFormulaKey = parsed.formulaKey;
    }
  }
  startPeriodGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
  endPeriodGroup.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
  refreshPeriodSection();
  document.getElementById("p_date_start").value = parsed.date_start;
  document.getElementById("p_date_end").value = parsed.date_end;
  document.getElementById("p_price_override").value = parsed.priceAnnouncedNumber != null ? parsed.priceAnnouncedNumber : "";
  updatePriceComparison();

  document.getElementById("c_name").value = parsed.ownerName;
  document.getElementById("c_address").value = parsed.address;
  document.getElementById("c_phone").value = parsed.phone;
  document.getElementById("c_email").value = parsed.email;
  document.getElementById("c_remarks").value = parsed.remarks || "(Aucune remarque trouvée dans le mail)";

  // Rapprochement client existant
  const match = findMatchingOwner({ name: parsed.ownerName, email: parsed.email, phone: parsed.phone });
  const matchBanner = document.getElementById("matchBanner");
  if (match) {
    matchedOwnerKey = match.key;
    linkMode = null;
    matchBanner.style.display = "block";
    document.getElementById("matchBannerText").textContent =
      `On dirait "${match.profile.name}" (déjà dans tes fiches, correspondance par ${match.matchType}).`;
  } else {
    matchedOwnerKey = null;
    linkMode = "new";
    matchBanner.style.display = "none";
  }

  document.getElementById("step1").style.display = "none";
  document.getElementById("step2").style.display = "block";
});

document.getElementById("linkExistingBtn").addEventListener("click", () => {
  linkMode = "link";
  document.getElementById("matchBanner").style.display = "none";
});
document.getElementById("createNewAnywayBtn").addEventListener("click", () => {
  linkMode = "new";
  document.getElementById("matchBanner").style.display = "none";
});

document.getElementById("cancelImportBtn").addEventListener("click", () => {
  document.getElementById("step2").style.display = "none";
  document.getElementById("step1").style.display = "block";
});

/* ---------- Validation finale ---------- */
document.getElementById("confirmImportBtn").addEventListener("click", async () => {
  const dateStart = document.getElementById("p_date_start").value;
  const dateEnd = document.getElementById("p_date_end").value;
  if (!selectedFormulaKey) {
    alert("Merci de choisir la formule.");
    return;
  }
  if (!dateStart || !dateEnd) {
    alert("Merci de renseigner les dates.");
    return;
  }
  const name = document.getElementById("c_name").value.trim();
  if (!name) {
    alert("Merci de renseigner le nom du client.");
    return;
  }

  const t = DEFAULT_TARIFS[selectedFormulaKey];
  const newPrestation = {
    date_start: dateStart,
    date_end: dateEnd,
    visit_time: "",
    keys_picked_up: false,
    keys_pickup_date: "",
    keys_pickup_time: "",
    keys_pickup_rdv: "",
    keys_returned: false,
    keys_rdv_date: "",
    keys_rdv_time: "",
    keys_rdv: "",
    is_mcer: true,
    mcer_key: selectedFormulaKey,
    mcer_nom: t.nom,
    mcer_visites: t.visites,
    mcer_par_visite: t.parVisite !== false,
    price_per_visit: t.prix || 0,
    key_return_type: "9",
    key_return_price: "9",
    payment_status: "attente",
    payment_mode: "",
    start_period: (startPeriodGroup.querySelector(".pill.selected") || {}).dataset?.period || "matin",
    end_period: (endPeriodGroup.querySelector(".pill.selected") || {}).dataset?.period || "apres-midi",
    price_override: (() => {
      const raw = document.getElementById("p_price_override").value;
      return raw !== "" ? parseFloat(raw) : null;
    })()
  };

  const profiles = getProfiles();
  let targetKey;

  if (linkMode === "link" && matchedOwnerKey && profiles[matchedOwnerKey]) {
    targetKey = matchedOwnerKey;
    const p = profiles[targetKey];
    if (!p.info) p.info = {};
    // On ne complète que les champs vides, sans écraser ce qui existe déjà
    if (!p.info.owner_phone) p.info.owner_phone = document.getElementById("c_phone").value.trim();
    if (!p.info.owner_email) p.info.owner_email = document.getElementById("c_email").value.trim();
    if (!p.info.address) p.info.address = document.getElementById("c_address").value.trim();
    if (!p.prestations) p.prestations = [];
    p.prestations.push(newPrestation);
    profiles[targetKey] = p;
  } else {
    targetKey = ownerTechKey(name);
    profiles[targetKey] = {
      name,
      info: {
        owner_name: name,
        owner_phone: document.getElementById("c_phone").value.trim(),
        owner_email: document.getElementById("c_email").value.trim(),
        address: document.getElementById("c_address").value.trim(),
        access_code: "",
        vet: "",
        food: "",
        health_notes: "",
        special_notes: parsed && parsed.remarks ? `(Depuis mail importé) ${parsed.remarks}` : ""
      },
      animals: [],
      prestations: [newPrestation]
    };
  }

  saveProfiles(profiles);
  await window.flushCloudSync();
  goTo(`fiche.html?key=${encodeURIComponent(targetKey)}`);
});
