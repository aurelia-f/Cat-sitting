// ═══════════════════════════════════
// PRESTATION.JS
// ═══════════════════════════════════

if (!getCurrentUser()) goTo("index.html");

const params   = new URLSearchParams(window.location.search);
const animalName = params.get("name") || "";
const isNew    = params.get("new") === "1";
const editIdx  = params.get("idx") !== null ? parseInt(params.get("idx")) : null;

const profiles = getProfiles();
const animal   = profiles[animalName] || {};
let prests     = [...(animal.prestations || [])];

let form = isNew ? {} : (prests[editIdx] || {});

const backUrl = `fiche.html?name=${encodeURIComponent(animalName)}`;
document.getElementById("back-btn").onclick = () => goTo(backUrl);
document.getElementById("page-title").textContent = isNew ? "Nouvelle prestation" : "Modifier la prestation";
document.getElementById("page-sub").textContent = animalName;

let tarifs = getTarifs();
let showCorrection = false;
let correctionKey  = null;

function isMCER() { return document.getElementById("mode-mcer")?.classList.contains("selected"); }

function render() {
  const c = form;
  const mcer = c.is_mcer;
  const { days, totalVisits, basePrice, keyPrice, total } = calcPrestation(form);

  document.getElementById("form-container").innerHTML = `

    <!-- Dates & horaires -->
    <div class="card card-left-accent">
      <div class="section-label">📅 Dates & horaires</div>
      <div class="date-row" style="margin-bottom:10px">
        <div>
          <label class="sub-label">Début</label>
          <input type="date" id="f-date_start" value="${c.date_start||""}" onchange="setField('date_start',this.value)">
        </div>
        <div>
          <label class="sub-label">Fin</label>
          <input type="date" id="f-date_end" value="${c.date_end||""}" onchange="setField('date_end',this.value)">
        </div>
      </div>
      <label class="sub-label">🔔 Heure de visite habituelle</label>
      <input type="text" placeholder="Ex: 8h30 et 18h00" value="${c.visit_time||""}" onchange="setField('visit_time',this.value)">
    </div>

    <!-- Suivi des clés -->
    <div class="card card-left-accent">
      <div class="section-label">🔑 Suivi des clés</div>

      <label class="chk-label">
        <div class="chk-box ${c.keys_picked_up?"checked":""}" onclick="toggleField('keys_picked_up')"></div>
        ✅ J'ai récupéré les clés
      </label>
      ${!c.keys_picked_up ? `
        <div style="margin-left:32px;margin-bottom:8px">
          <label class="sub-label">📅 RDV pour récupérer les clés</label>
          <div class="date-row" style="margin-bottom:6px">
            <input type="date" value="${c.keys_pickup_date||""}" onchange="setField('keys_pickup_date',this.value)">
            <input type="time" value="${c.keys_pickup_time||""}" onchange="setField('keys_pickup_time',this.value)">
          </div>
          <input type="text" placeholder="Ex: Chez le client, dans le hall..." value="${c.keys_pickup_rdv||""}" onchange="setField('keys_pickup_rdv',this.value)">
        </div>` : ""}

      <label class="chk-label">
        <div class="chk-box ${c.keys_returned?"checked":""}" onclick="toggleField('keys_returned')"></div>
        ✅ J'ai rendu les clés
      </label>
      ${!c.keys_returned ? `
        <div style="margin-left:32px">
          <label class="sub-label">📅 RDV pour rendre les clés</label>
          <div class="date-row" style="margin-bottom:6px">
            <input type="date" value="${c.keys_rdv_date||""}" onchange="setField('keys_rdv_date',this.value)">
            <input type="time" value="${c.keys_rdv_time||""}" onchange="setField('keys_rdv_time',this.value)">
          </div>
          <input type="text" placeholder="Ex: Chez le client, dans le hall..." value="${c.keys_rdv||""}" onchange="setField('keys_rdv',this.value)">
        </div>` : ""}
    </div>

    <!-- Tarification -->
    <div class="card">
      <div class="section-label">💶 Tarification</div>
      <div class="pills">
        <button type="button" class="pill ${mcer?"selected":""}" id="mode-mcer" onclick="setMode(true)">Formule MCER</button>
        <button type="button" class="pill ${!mcer?"selected":""}" id="mode-manuel" onclick="setMode(false)">Prix manuel</button>
      </div>

      ${mcer ? renderMCER() : renderManuel()}
    </div>

    <!-- Rendu des clés (tarif) — seulement si pas MCER -->
    ${!mcer && (c.price_per_visit||c.prix_total) ? `
    <div class="card card-left-blue">
      <div class="section-label">🔑 Rendu des clés (tarif)</div>
      <div class="options">
        ${["non|Pas de rendu (0€)","9|Tarif standard (9€)","custom|Autre montant"].map(o=>{
          const [val,lbl]=o.split("|");
          return `<button type="button" class="option${c.key_return_type===val?" selected-blue":""}" onclick="setKeyReturn('${val}')">${c.key_return_type===val?"✓ ":""}${lbl}</button>`;
        }).join("")}
      </div>
      ${c.key_return_type==="custom" ? `
        <div class="price-wrap">
          <input type="number" placeholder="Montant" value="${c.key_return_price||""}" oninput="setField('key_return_price',this.value)">
          <span class="euro">€</span>
        </div>` : ""}
    </div>` : ""}

    <!-- Paiement -->
    ${(mcer ? c.mcer_key : (c.price_per_visit||c.prix_total)) ? `
    <div class="card card-left-green">
      <div class="section-label">💳 Paiement</div>
      <div class="options" style="margin-bottom:10px">
        ${["attente|⏳ En attente","paye|✅ Payé"].map(o=>{
          const [val,lbl]=o.split("|");
          return `<button type="button" class="option${c.payment_status===val?" selected-green":""}" onclick="setField('payment_status','${val}');render()">${c.payment_status===val?"✓ ":""}${lbl}</button>`;
        }).join("")}
      </div>
      <input type="text" placeholder="Mode de paiement (virement, espèces...)" value="${c.payment_mode||""}" oninput="setField('payment_mode',this.value)">
    </div>` : ""}

    <!-- Récap -->
    ${total > 0 ? `
    <div class="recap">
      <div class="section-label">🧮 Récapitulatif</div>
      ${c.date_start ? `<div style="font-size:13px;color:var(--text-lt);margin-bottom:6px">📅 ${fmtDate(c.date_start)} → ${fmtDate(c.date_end)} (${days} j)</div>` : ""}
      ${c.mcer_nom ? `<div style="font-size:13px;color:var(--text-lt);margin-bottom:6px">📋 Formule ${c.mcer_nom}</div>` : ""}
      <div class="recap-row">
        <span>${c.is_mcer ? `${totalVisits} visite${totalVisits>1?"s":""} × ${tarifs[c.mcer_key]?.prix||0}€` : c.prix_mode==="visite" ? `${totalVisits} visite${totalVisits>1?"s":""} × ${c.price_per_visit}€` : "Forfait"}</span>
        <span style="font-weight:bold;color:var(--text)">${basePrice}€</span>
      </div>
      ${c.is_mcer ? `
        <div class="recap-row"><span>🔑 Rendu des clés</span><span style="font-weight:bold">+9€</span></div>` :
        c.key_return_type==="non" ? `<div class="recap-row"><span>🔑 Clés</span><span style="color:var(--green);font-weight:bold">Offert</span></div>` :
        keyPrice > 0 ? `<div class="recap-row"><span>🔑 Clés</span><span style="font-weight:bold">+${keyPrice}€</span></div>` : ""}
      <div class="recap-total"><span>Total</span><span style="color:var(--accent)">${total}€</span></div>
      ${c.payment_status ? `<div style="margin-top:6px;font-size:13px;color:${c.payment_status==="paye"?"var(--green)":"var(--text-lt)"};font-weight:bold">${c.payment_status==="paye"?"✅ Payé":"⏳ En attente"}${c.payment_mode?" — "+c.payment_mode:""}</div>` : ""}
    </div>` : ""}
  `;
}

function renderMCER() {
  const c = form;
  let html = `<div class="options">`;
  Object.entries(tarifs).forEach(([key, t]) => {
    const sel = c.mcer_key === key;
    const pxD = t.prix ? `${t.prix}€/visite` : "Tarif à définir →";
    html += `<button type="button" class="option${sel?" selected":""}" onclick="selectMCER('${key}')">
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
        <div>
          <div style="font-weight:bold">${sel?"✓ ":""}${t.nom}</div>
          <div style="font-size:11px;color:var(--text-lt);margin-top:2px">${t.desc}</div>
        </div>
        <span style="font-size:13px;font-weight:bold;color:${t.prix?"var(--accent)":"var(--text-lt)"}">${pxD}</span>
      </div>
    </button>`;
  });
  html += `</div>`;

  // Bouton correction
  html += `<button type="button" style="background:none;border:none;color:var(--text-lt);font-size:12px;cursor:pointer;text-decoration:underline;padding:4px 0;margin-top:4px" onclick="toggleCorrection()">🔧 Corriger un tarif</button>`;

  if (showCorrection) {
    html += `<div class="correction-box">
      <div style="font-size:12px;color:var(--text-lt);margin-bottom:8px">Quel tarif veux-tu corriger ?</div>
      ${Object.entries(tarifs).map(([key,t])=>`
        <button type="button" class="option" style="margin-bottom:6px" onclick="startCorrection('${key}')">
          ${t.nom} — <span style="color:var(--accent);font-weight:bold">${t.prix?t.prix+"€":"non défini"}</span>
        </button>`).join("")}
    </div>`;
  }

  if (correctionKey) {
    const t = tarifs[correctionKey];
    html += `<div class="correction-box" style="margin-top:6px">
      <div style="font-size:12px;color:var(--text-lt);margin-bottom:8px">🔧 Correction — ${t.nom}</div>
      <div class="pills" style="margin-bottom:8px">
        <button type="button" class="pill ${corrMode==="prestation"?"selected":""}" onclick="setCorrMode('prestation')">Par prestation</button>
        <button type="button" class="pill ${corrMode==="visite"?"selected":""}" onclick="setCorrMode('visite')">Par visite</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <div class="price-wrap" style="flex:1">
          <input type="number" id="corr-val" placeholder="Nouveau prix" value="${t.prix||""}" style="font-size:16px;font-weight:bold">
          <span class="euro">€</span>
        </div>
        <button type="button" class="btn btn-primary btn-small" onclick="saveCorrection('${correctionKey}')">✓</button>
        <button type="button" class="btn btn-small" style="background:white;border:1px solid var(--border);color:var(--text-lt)" onclick="correctionKey=null;render()">✕</button>
        <button type="button" class="btn btn-small" style="background:white;border:1px solid var(--red);color:var(--red)" onclick="annulTarif('${correctionKey}')">🗑</button>
      </div>
    </div>`;
  }

  return html;
}

function renderManuel() {
  const c = form;
  return `
    <div class="pills" style="margin-bottom:10px">
      <button type="button" class="pill ${(c.prix_mode||"prestation")==="prestation"?"selected":""}" onclick="setPrixMode('prestation')">Par prestation</button>
      <button type="button" class="pill ${c.prix_mode==="visite"?"selected":""}" onclick="setPrixMode('visite')">Par visite</button>
    </div>
    <div class="price-wrap">
      <input type="number" placeholder="${c.prix_mode==="visite"?"Prix par visite":"Prix total de la prestation"}"
        value="${c.price_per_visit||""}" oninput="setField('price_per_visit',this.value)">
      <span class="euro">€</span>
    </div>`;
}

// ── Handlers ──
function setField(key, val) { form[key] = val; }
function toggleField(key) { form[key] = !form[key]; render(); }

function setMode(mcer) {
  form.is_mcer = mcer;
  if (!mcer) { form.mcer_key = null; form.mcer_nom = null; }
  render();
}

function selectMCER(key) {
  const t = tarifs[key];
  if (!t.prix) { correctionKey = key; corrMode = "visite"; showCorrection = false; render(); return; }
  const autoKey = ["classique","delicat","calin"].includes(key);
  form.is_mcer = true;
  form.mcer_key = key;
  form.mcer_nom = t.nom;
  form.mcer_visites = t.visites;
  form.mcer_par_visite = t.parVisite;
  form.price_per_visit = t.prix;
  if (autoKey) { form.key_return_type = "9"; form.key_return_price = "9"; }
  correctionKey = null; showCorrection = false;
  render();
}

function setKeyReturn(val) {
  form.key_return_type = val;
  form.key_return_price = val==="9"?"9":val==="non"?"0":"";
  render();
}
function setPrixMode(mode) { form.prix_mode = mode; render(); }

let corrMode = "visite";
function toggleCorrection() { showCorrection = !showCorrection; correctionKey = null; render(); }
function startCorrection(key) { correctionKey = key; corrMode = tarifs[key].parVisite?"visite":"prestation"; showCorrection = false; render(); }
function setCorrMode(m) { corrMode = m; render(); }
function saveCorrection(key) {
  const val = document.getElementById("corr-val")?.value;
  if (!val) return;
  tarifs[key] = { ...tarifs[key], prix: Number(val), parVisite: corrMode==="visite" };
  saveTarifs(tarifs);
  correctionKey = null;
  // Re-select if this was the selected formula
  if (form.mcer_key === key) selectMCER(key);
  else render();
}
function annulTarif(key) {
  tarifs[key] = { ...tarifs[key], prix: null };
  saveTarifs(tarifs);
  if (form.mcer_key === key) { form.mcer_key = null; form.mcer_nom = null; }
  correctionKey = null; render();
}

// ── Save ──
document.getElementById("save-btn").onclick = () => {
  const profiles = getProfiles();
  const animal = profiles[animalName] || {};
  let prests = [...(animal.prestations || [])];

  if (isNew) prests.push(form);
  else if (editIdx !== null) prests[editIdx] = form;

  profiles[animalName] = { ...animal, prestations: prests };
  saveProfiles(profiles);
  document.getElementById("save-status").textContent = "✓ Prestation sauvegardée !";
  setTimeout(() => goTo(backUrl), 800);
};

render();
