// ═══════════════════════════════════
// ACCUEIL.JS
// ═══════════════════════════════════

if (!getCurrentUser()) goTo("index.html");

// Fonctions locales (utilisées si storage.js pas encore mis à jour)
function getSortedOwners() {
  const profiles = getProfiles();
  return Object.keys(profiles).sort((a, b) => a.localeCompare(b, "fr"));
}
function getSortedAnimals(ownerKey) {
  const profiles = getProfiles();
  const owner = profiles[ownerKey] || {};
  const animals = owner.animals || [];
  return [...animals].sort((a, b) => (a.name||"").localeCompare(b.name||"", "fr"));
}
function getNextKeyRdvsLocal() {
  if (typeof getNextKeyRdvs === "function") return getNextKeyRdvs();
  return [];
}

document.getElementById("greeting").textContent = `Bonjour ${getCurrentUserName()} 👋`;

function logout() {
  Storage.remove("cs-current-user");
  goTo("index.html");
}

let delConfirm = null;

function openNewFiche() {
  document.getElementById("new-fiche-modal").classList.remove("hidden");
  setTimeout(() => document.getElementById("new-owner-input").focus(), 100);
}
function createFiche() {
  const ownerName = document.getElementById("new-owner-input").value.trim();
  if (!ownerName) return;
  goTo(`fiche.html?new=1&owner=${encodeURIComponent(ownerName)}`);
}

function render() {
  const profiles  = getProfiles();
  const gardes    = getGardesAvenir();
  const keyRdvs   = getNextKeyRdvsLocal();
  const allPrests = getAllPrestations();

  // Warning clés à régler (garde terminée mais clés pas rendues/récupérées)
  const today3 = new Date(); today3.setHours(0,0,0,0);
  const warningsCles = [];
  Object.entries(profiles).forEach(([key, p]) => {
    const animals = p.animals?.length > 0
      ? [...p.animals].sort((a,b)=>(a.name||"").localeCompare(b.name||"","fr"))
      : null;
    const nom = animals ? animals.map(a=>a.name).filter(Boolean).join(", ") : (p.name||key);
    const types = animals ? animals.flatMap(a=>a.animal_type||[]) : (p.animal_type||[]);
    (p.prestations || []).forEach(pr => {
      if (!pr.date_end) return;
      const end = new Date(pr.date_end);
      if (end < today3) {
        if (pr.keys_picked_up && !pr.keys_returned)
          warningsCles.push({ nom, types, date_end:pr.date_end, type:"restitution" });
        if (!pr.keys_picked_up)
          warningsCles.push({ nom, types, date_end:pr.date_end, type:"récupération" });
      }
    });
  });

  const totalG    = allPrests.reduce((s, p) => s + calcPrestation(p).total, 0);

  // Stats
  document.getElementById("stats").innerHTML = `
    <div class="stat-card"><div class="stat-val">${totalG}€</div><div class="stat-lbl">Total gagné</div></div>
    <div class="stat-card"><div class="stat-val">${gardes.length}</div><div class="stat-lbl">Garde(s) à venir</div></div>
    <div class="stat-card"><div class="stat-val">${Object.keys(profiles).length}</div><div class="stat-lbl">Fiches</div></div>`;

  // Gardes en cours + à venir
  const today2 = new Date(); today2.setHours(0,0,0,0);
  const enCours = getAllPrestations().filter(p => {
    if (!p.date_start || !p.date_end) return false;
    const s = new Date(p.date_start), e = new Date(p.date_end);
    return s <= today2 && e >= today2;
  });
  let gardesHtml = "";

  if (enCours.length > 0) {
    gardesHtml += `<div class="section-tag" style="color:var(--accent)">🐾 GARDES EN COURS</div>`;
    enCours.forEach(p => {
      const { days, total } = calcPrestation(p);
      gardesHtml += `
        <div class="card" style="background:var(--accent-lt);border:1.5px solid var(--accent);display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:bold;font-size:14px;color:var(--text)">${animalEmoji(p.animalTypes)} ${p.animalName&&p.animalName!=="À définir"?p.animalName:"À définir 🐾"}</div>
            <div style="font-size:12px;color:var(--text-lt);margin-top:2px">📅 ${fmtShort(p.date_start)} → ${fmtShort(p.date_end)} · ${days}j</div>
          </div>
          <div style="text-align:right">
            ${total > 0 ? `<div style="font-weight:bold;color:var(--accent);font-size:14px">${total}€</div>` : ""}
            ${p.payment_status ? `<div style="font-size:11px;color:${p.payment_status==="paye"?"var(--green)":"var(--text-lt)"}">${p.payment_status==="paye"?"✅":"⏳"}</div>` : ""}
          </div>
        </div>`;
    });
  }

  if (gardes.length > 0) {
    gardesHtml += `<div class="section-tag tag-blue" style="margin-top:${enCours.length>0?8:0}px">📅 GARDES À VENIR</div>`;
    gardes.slice(0, 5).forEach(p => {
      const { days, total } = calcPrestation(p);
      gardesHtml += `
        <div class="card card-blue" style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:bold;font-size:14px;color:var(--text)">${animalEmoji(p.animalTypes)} ${p.animalName&&p.animalName!=="À définir"?p.animalName:"À définir 🐾"}</div>
            <div style="font-size:12px;color:var(--text-lt);margin-top:2px">${fmtShort(p.date_start)} → ${fmtShort(p.date_end)} · ${days}j</div>
          </div>
          <div style="text-align:right">
            ${total > 0 ? `<div style="font-weight:bold;color:var(--blue);font-size:14px">${total}€</div>` : ""}
            ${p.payment_status ? `<div style="font-size:11px;color:${p.payment_status==="paye"?"var(--green)":"var(--text-lt)"}">${p.payment_status==="paye"?"✅":"⏳"}</div>` : ""}
          </div>
        </div>`;
    });
  }
  document.getElementById("gardes-section").innerHTML = gardesHtml;

  // Warnings clés
  let warningHtml = "";
  if (warningsCles.length > 0) {
    warningHtml = `<div class="section-tag" style="color:var(--red);margin-top:4px">⚠️ CLÉS À RÉGLER</div>`;
    warningsCles.forEach(w => {
      warningHtml += `
        <div style="background:#FFF0F0;border-radius:12px;padding:12px 14px;margin-bottom:8px;border:2px solid var(--red);display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:bold;font-size:14px;color:var(--text)">${animalEmoji(w.types)} ${w.nom}</div>
            <div style="font-size:12px;color:var(--red);margin-top:3px;font-weight:bold">
              ⚠️ Garde terminée le ${fmtShort(w.date_end)} — Clés ${w.type==="restitution"?"pas encore rendues !":"pas encore récupérées !"}
            </div>
          </div>
          <span style="font-size:22px">${w.type==="restitution"?"↩️":"🔑"}</span>
        </div>`;
    });
  }
  document.getElementById("gardes-section").innerHTML += warningHtml;

  // RDV Clés
  let clesHtml = "";
  if (keyRdvs.length > 0) {
    clesHtml = `<div class="section-tag tag-purple" style="margin-top:4px">🔑 PROCHAINS RDV CLÉS</div>`;
    keyRdvs.forEach(r => {
      clesHtml += `
        <div class="card card-purple" style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:bold;font-size:13px;color:var(--text)">${animalEmoji(r.types)} ${r.nom}</div>
            <div style="font-size:12px;color:var(--text-lt);margin-top:2px">🔑 ${r.type==="récupération"?"Récupération":"Restitution"}${r.date?` — ${fmtShort(r.date)}`:""}${r.time?` à ${r.time}`:""}${r.rdv?` · ${r.rdv}`:""}</div>
          </div>
          <span style="font-size:22px">${r.type==="récupération"?"🔑":"↩️"}</span>
        </div>`;
    });
  }
  // Warning clés
  let warningHtml = "";
  if (warningsCles.length > 0) {
    warningHtml = `<div class="section-tag" style="color:var(--red);margin-top:4px">⚠️ CLÉS À RÉGLER</div>`;
    warningsCles.forEach(w => {
      warningHtml += `
        <div style="background:#FFF0F0;border-radius:12px;padding:12px 14px;margin-bottom:8px;border:2px solid var(--red);display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:bold;font-size:14px;color:var(--text)">${animalEmoji(w.types)} ${w.nom}</div>
            <div style="font-size:12px;color:var(--red);margin-top:3px;font-weight:bold">
              ⚠️ Garde terminée le ${fmtShort(w.date_end)} — Clés ${w.type==="restitution"?"pas encore rendues !":"pas encore récupérées !"}
            </div>
          </div>
          <span style="font-size:22px">${w.type==="restitution"?"↩️":"🔑"}</span>
        </div>`;
    });
  }
  document.getElementById("cles-section").innerHTML = warningHtml + clesHtml;

  // Mes fiches (par propriétaire, triées alphabétiquement)
  const ownerKeys = Object.keys(profiles).sort((a,b) => a.localeCompare(b, "fr"));
  let animauxHtml = "";
  if (ownerKeys.length > 0) {
    animauxHtml = `<div class="section-tag tag-accent" style="margin-top:4px">🐾 MES FICHES</div>`;
    ownerKeys.forEach(ownerKey => {
      const data = profiles[ownerKey];
      if (!data) return;
      // Support ancien format (par animal) et nouveau (par propriétaire)
      const isOwnerFormat = !!(data.animals && data.animals.length > 0);
      const animals = isOwnerFormat
        ? [...data.animals].sort((a,b) => (a.name||"").localeCompare(b.name||"","fr"))
        : [{name: data.name||ownerKey, animal_type: data.animal_type, animal_gender: data.animal_gender, is_cuddly: data.is_cuddly}];
      const ownerName = data.info?.owner_name || data.owner_name || "";
      const prest = data.prestations || [];
      const last = prest[prest.length - 1];
      const { total } = last ? calcPrestation(last) : {};
      

      // Animaux (triés alphabétiquement)
      const animalsHtml = animals.map(a => `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-size:18px">${animalEmoji(a.animal_type)}</span>
          <div>
            <span style="font-weight:bold;font-size:14px;color:var(--text)">${a.name||"?"}</span>
            <span style="font-size:11px;color:var(--text-lt);margin-left:6px">${[a.animal_gender, a.is_cuddly].filter(Boolean).join(" · ")}</span>
          </div>
        </div>`).join("");

      let keysHtml = "";
      if (last) {
        const kPickup = last.keys_picked_up
          ? `<span style="color:var(--green);font-weight:bold">🔑 Clés récupérées ✅</span>`
          : (last.keys_pickup_rdv || last.keys_pickup_date)
            ? `<span style="color:var(--text-lt)">🔑 RDV récup : ${last.keys_pickup_date ? fmtShort(last.keys_pickup_date) : ""}${last.keys_pickup_time ? " à "+last.keys_pickup_time : ""}${last.keys_pickup_rdv ? " · "+last.keys_pickup_rdv : ""}</span>`
            : `<span style="color:var(--text-lt)">🔑 Clés pas encore récupérées</span>`;
        const kReturn = last.keys_returned
          ? `<span style="color:var(--green);font-weight:bold">↩️ Clés rendues ✅</span>`
          : (last.keys_rdv || last.keys_rdv_date)
            ? `<span style="color:var(--text-lt)">· RDV rendu : ${last.keys_rdv_date ? fmtShort(last.keys_rdv_date) : ""}${last.keys_rdv_time ? " à "+last.keys_rdv_time : ""}${last.keys_rdv ? " · "+last.keys_rdv : ""}</span>`
            : `<span style="color:var(--text-lt)">· Clés pas encore rendues</span>`;
        keysHtml = `<div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:6px;border-top:1px solid #C5D9F7;font-size:11px">${kPickup} ${kReturn}</div>`;
      }

      const lastBadge = last && total > 0 ? `
        <div class="card card-blue" style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div>
              <div style="font-weight:bold;font-size:13px;color:var(--text)">📅 ${fmtShort(last.date_start)} → ${fmtShort(last.date_end)}</div>
              ${last.mcer_nom ? `<div style="font-size:11px;color:var(--text-lt);margin-top:1px">Formule ${last.mcer_nom}</div>` : ""}
              ${last.visit_time ? `<div style="font-size:11px;color:var(--text-lt);margin-top:1px">🔔 ${last.visit_time}</div>` : ""}
            </div>
            <div style="text-align:right">
              <div style="font-weight:bold;color:var(--accent);font-size:14px">${total}€</div>
              ${last.payment_status ? `<div style="font-size:11px;color:${last.payment_status==="paye"?"var(--green)":"var(--text-lt)"}">${last.payment_status==="paye"?"✅ Payé":"⏳ Attente"}</div>` : ""}
            </div>
          </div>
          ${keysHtml}
        </div>` : "";

const msgBadge = "";

      const delButtons = delConfirm === ownerKey ? `
        <div class="btn-row" style="margin-top:8px">
          <button class="btn btn-danger" onclick="deleteAnimal('${ownerKey}')">Supprimer</button>
          <button class="btn btn-outline" onclick="cancelDel()">Annuler</button>
        </div>` : `
        <button style="margin-top:6px;background:none;border:none;color:var(--text-lt);font-size:12px;cursor:pointer;width:100%" onclick="askDel('${ownerKey}')">🗑 Supprimer cette fiche</button>`;

      animauxHtml += `
        <div class="animal-card">
          <div class="animal-card-header">
            <div class="animal-info" style="flex-direction:column;align-items:flex-start">
              ${ownerName ? `<div style="font-weight:bold;font-size:15px;color:var(--text);margin-bottom:6px">👤 ${ownerName}</div>` : ""}
              ${animalsHtml}
            </div>
            <button class="btn btn-outline btn-small" style="align-self:flex-start" onclick="goTo('fiche.html?key=${encodeURIComponent(ownerKey)}')">✏️ Fiche</button>
          </div>
          ${data.owner_phone ? `<div style="font-size:12px;color:var(--text-lt);margin-bottom:6px">📞 ${data.owner_phone}</div>` : ""}
          ${lastBadge}
          ${msgBadge}
          
          ${delButtons}
        </div>`;
    });
  } else {
    animauxHtml = `<div style="text-align:center;padding:40px 20px;color:var(--text-lt)">
      <div style="font-size:48px;margin-bottom:12px">🐾</div>
      <p style="font-size:14px">Crée ta première fiche pour commencer !</p>
    </div>`;
  }
  document.getElementById("animaux-section").innerHTML = animauxHtml;

  // Récap toutes prestations
  let recapHtml = "";
  if (allPrests.length > 0) {
    recapHtml = `<div class="section-tag tag-green" style="margin-top:8px">🧾 TOUTES LES PRESTATIONS</div>
      <div class="card card-green">`;
    allPrests.forEach((p, i) => {
      const { total } = calcPrestation(p);
      recapHtml += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;margin-bottom:8px;${i<allPrests.length-1?"border-bottom:1px solid var(--border)":""}">
          <div>
            <div style="font-size:13px;font-weight:bold;color:var(--text)">${animalEmoji(p.animalTypes)} ${p.animalName}</div>
            <div style="font-size:11px;color:var(--text-lt)">${fmtShort(p.date_start)} → ${fmtShort(p.date_end)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:bold;color:var(--accent);font-size:14px">${total}€</div>
            ${p.payment_status ? `<div style="font-size:11px;color:${p.payment_status==="paye"?"var(--green)":"var(--text-lt)"}">${p.payment_status==="paye"?"✅ Payé":"⏳ Attente"}</div>` : ""}
          </div>
        </div>`;
    });
    recapHtml += `<div style="border-top:2px solid var(--border);padding-top:10px;display:flex;justify-content:space-between;font-weight:bold;font-size:15px">
        <span>Total gagné</span><span style="color:var(--accent)">${totalG}€</span>
      </div></div>`;
  }
  document.getElementById("recap-section").innerHTML = recapHtml;
}

function askDel(name) { delConfirm = name; render(); }
function cancelDel()  { delConfirm = null; render(); }
function deleteAnimal(name) {
  const p = getProfiles(); delete p[name]; saveProfiles(p);
  delConfirm = null; render();
}

render();
