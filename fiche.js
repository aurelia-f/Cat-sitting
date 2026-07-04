// ═══════════════════════════════════
// FICHE.JS
// ═══════════════════════════════════

if (!getCurrentUser()) goTo("index.html");

const params   = new URLSearchParams(window.location.search);
const isNew    = params.get("new") === "1";
const editName = params.get("name") || "";

let ficheName = editName;
let charForm  = {};
let infoForm  = {};
let prestations = [];

const profiles = getProfiles();

if (!isNew && editName) {
  const p = profiles[editName] || {};
  charForm  = { ...p };
  infoForm  = { ...(p.info || {}) };
  prestations = [...(p.prestations || [])];
  document.getElementById("fiche-title").textContent = "Fiche — " + editName;
  ficheName = editName;
} else {
  ficheName = prompt("Prénom de l'animal ?");
  if (!ficheName) goTo("accueil.html");
  document.getElementById("fiche-title").textContent = "Fiche — " + ficheName;
}

function switchTab(name) {
  ["character","info","prestations"].forEach(t => {
    document.getElementById("tab-"+t).classList.toggle("active", t===name);
    document.getElementById("content-"+t).classList.toggle("active", t===name);
  });
}

// ── Helpers UI ──
function makeSelect(id, label, icon, options) {
  const current = charForm[id];
  const opts = options.map(o => `
    <button type="button" class="option${current===o?" selected":""}" onclick="setChar('${id}','${o}',this)">
      ${current===o?"✓ ":""}${o}
    </button>`).join("");
  return `<div style="margin-bottom:14px">
    <label class="field-label">${icon} ${label}</label>
    <div class="options">${opts}</div>
  </div>`;
}

function makeMulti(id, label, icon, options) {
  const current = charForm[id] || [];
  const tags = options.map(o => `
    <button type="button" class="tag-btn${current.includes(o)?" selected":""}" onclick="toggleChar('${id}','${o}',this)">
      ${current.includes(o)?"✓ ":""}${o}
    </button>`).join("");
  return `<div style="margin-bottom:14px">
    <label class="field-label">${icon} ${label}</label>
    <div class="tags">${tags}</div>
  </div>`;
}

function makeText(id, label, icon, ph) {
  return `<div style="margin-bottom:14px">
    <label class="field-label">${icon} ${label}</label>
    <input type="text" placeholder="${ph}" value="${(charForm[id]||"").replace(/"/g,"&quot;")}"
      oninput="charForm['${id}']=this.value">
  </div>`;
}

function makeInfoText(id, label, icon, ph) {
  return `<div style="margin-bottom:14px">
    <label class="field-label">${icon} ${label}</label>
    <input type="text" placeholder="${ph}" value="${(infoForm[id]||"").replace(/"/g,"&quot;")}"
      oninput="infoForm['${id}']=this.value">
  </div>`;
}

// ── Render character tab ──
function renderCharacter() {
  document.getElementById("content-character").innerHTML = `
    ${makeMulti("animal_type","Type d'animal","🐾",["Chat","Chien","Lapin","Autre"])}
    ${makeSelect("animal_gender","Sexe","⚥",["Mâle","Femelle","Mixte"])}
    ${makeSelect("animal_age","Âge","🎂",["Chaton / Jeune (- 1 an)","Adulte (1-7 ans)","Senior (+ 7 ans)"])}
    ${makeSelect("is_cuddly","Niveau de câlins","🥰",["Très câlin(e)","Un peu câlin(e)","Pas trop câlin(e)","Indépendant(e)"])}
    ${makeSelect("comes_to_me","Vient spontanément ?","👣",["Oui, tout le temps","Parfois","Pas vraiment","Se cache"])}
    ${makeSelect("is_playful","Joueur/joueuse ?","🎾",["Très joueur/joueuse","Un peu","Pas vraiment","Dort beaucoup"])}
    ${makeSelect("eats_how","Rapport à la nourriture","🍽️",["Mange tout de suite","Mange à son rythme","Difficile / capricieux","Très gourmand(e)"])}
    ${makeMulti("personality","Personnalité","✨",["Timide","Curieux/se","Collant(e)","Dominant(e)","Peureux/se","Bavard(e)","Calme","Aventurier/ère"])}
    ${makeMulti("favorite_things","Ce qu'il/elle adore","💕",["Les caresses sur la tête","Le ventre","Jouer avec une canne","Les jouets qui bougent","Regarder par la fenêtre","Les hauteurs","Les câlins dans les bras","Ronronner sur les genoux"])}
    ${makeMulti("dislikes","Ce qu'il/elle n'aime pas","🚫",["Être pris(e) dans les bras","Les bruits forts","Les inconnus","Être seul(e)","Trop de câlins","Qu'on touche son ventre"])}
    ${makeText("special_behavior","Comportement particulier","📝","Ex: miaule beaucoup...")}
    ${makeSelect("has_litter","Litière à nettoyer ?","🪣",["Oui","Non"])}
    ${makeSelect("has_water","Eau à changer ?","💧",["Oui","Non"])}
    ${makeSelect("has_croquettes","Croquettes à remettre ?","🟤",["Oui","Non"])}
    ${makeSelect("has_pate","Pâtée à donner ?","🍖",["Oui","Non"])}
  `;
}

// ── Render info tab ──
function renderInfo() {
  document.getElementById("content-info").innerHTML = `
    ${makeInfoText("owner_name","Propriétaire(s)","👤","Ex: Marie & Paul Dupont")}
    ${makeInfoText("owner_phone","Téléphone","📞","Ex: 06 12 34 56 78")}
    ${makeInfoText("address","Adresse","📍","Ex: 12 rue des Lilas, Paris 11e")}
    ${makeInfoText("access_code","Code d'accès","🔑","Ex: B1234")}
    ${makeInfoText("vet","Vétérinaire","🏥","Ex: Dr Martin, 01 23 45 67 89")}
    ${makeInfoText("food","Nourriture / quantité","🍽️","Ex: 1 sachet matin + croquettes le soir")}
    ${makeInfoText("health_notes","Santé / médicaments","💊","Ex: Prend un comprimé le matin dans la pâtée")}
    ${makeInfoText("special_notes","Notes importantes","📝","Ex: Ne pas ouvrir la fenêtre du salon")}
  `;
}

// ── Render prestations tab ──
function renderPrestations() {
  let html = "";
  prestations.forEach((p, i) => {
    const { days, total } = calcPrestation(p);
    html += `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:bold;font-size:14px">📅 ${fmtDate(p.date_start)} → ${fmtDate(p.date_end)}</div>
          <div style="font-size:12px;color:var(--text-lt);margin-top:3px">
            ${days}j ${p.mcer_nom?"· Formule "+p.mcer_nom:""}${total>0?" · "+total+"€":""}
            ${p.payment_status ? (p.payment_status==="paye"?" ✅":" ⏳") : ""}
          </div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-small" onclick="editPrestation(${i})">✏️</button>
          <button class="btn btn-small" style="background:white;border:1px solid var(--border);color:var(--text-lt)" onclick="deletePrestation(${i})">🗑</button>
        </div>
      </div>
    </div>`;
  });
  html += `<button class="btn btn-outline" onclick="goTo('prestation.html?name=${encodeURIComponent(ficheName)}&new=1')">+ Ajouter une prestation</button>`;
  document.getElementById("content-prestations").innerHTML = html;
}

function editPrestation(i) {
  goTo(`prestation.html?name=${encodeURIComponent(ficheName)}&idx=${i}`);
}
function deletePrestation(i) {
  prestations.splice(i, 1);
  saveFicheData();
  renderPrestations();
}

// ── Char form helpers ──
function setChar(id, val, btn) {
  charForm[id] = val;
  btn.closest(".options").querySelectorAll(".option").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
}
function toggleChar(id, val, btn) {
  if (!charForm[id]) charForm[id] = [];
  if (charForm[id].includes(val)) charForm[id] = charForm[id].filter(v => v !== val);
  else charForm[id].push(val);
  btn.classList.toggle("selected", charForm[id].includes(val));
}

// ── Save ──
function saveFicheData() {
  const p = profiles[ficheName] || {};
  profiles[ficheName] = { ...p, name: ficheName, ...charForm, info: infoForm, prestations };
  saveProfiles(profiles);
}
function saveFiche() {
  saveFicheData();
  document.getElementById("save-status").textContent = "✓ Fiche sauvegardée !";
  setTimeout(() => { document.getElementById("save-status").textContent = ""; goTo("accueil.html"); }, 800);
}

// ── Init ──
renderCharacter();
renderInfo();
renderPrestations();
