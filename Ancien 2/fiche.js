// ═══════════════════════════════════
// FICHE.JS — Fiche par propriétaire + plusieurs animaux
// ═══════════════════════════════════

if (!getCurrentUser()) goTo("index.html");

const params   = new URLSearchParams(window.location.search);
const ownerKey = params.get("key") || "";
const isNew    = params.get("new") === "1";

let profiles     = getProfiles();
let ownerData    = {};
let infoForm     = {};
let prestations  = [];
let animals      = [];
let currentKey   = ownerKey;
let editAnimalIdx = null;
let animalForm   = {};

// ── Init ──
if (!isNew && ownerKey) {
  ownerData   = { ...(profiles[ownerKey] || {}) };
  infoForm    = { ...(ownerData.info || {}) };
  prestations = [...(ownerData.prestations || [])];
  animals     = [...(ownerData.animals || [])];
  const title = ownerData.info?.owner_name || ownerKey;
  document.getElementById("fiche-title").textContent = "Fiche — " + title;
  document.getElementById("fiche-sub").textContent = animals.length > 0
    ? [...animals].sort((a,b)=>(a.name||"").localeCompare(b.name||"","fr")).map(a=>a.name).join(", ")
    : "Aucun animal";
} else {
  const ownerName = params.get("owner") || "";
  currentKey = ownerName.toLowerCase().replace(/[^a-z0-9]/g,"-") + "-" + Date.now().toString(36);
  infoForm.owner_name = ownerName;
  document.getElementById("fiche-title").textContent = ownerName ? "Fiche — " + ownerName : "Nouvelle fiche";
  document.getElementById("fiche-sub").textContent = "Ajoute les animaux ! 🐾";
}

function goBack() { goTo("accueil.html"); }

function switchTab(name) {
  ["animaux","info","prestations"].forEach(t => {
    document.getElementById("tab-"+t).classList.toggle("active", t===name);
    document.getElementById("content-"+t).classList.toggle("active", t===name);
  });
}

// ═══ ANIMAUX ═══
function renderAnimaux() {
  const sorted = [...animals].sort((a,b) => (a.name||"").localeCompare(b.name||"","fr"));
  let html = sorted.length === 0
    ? `<div style="text-align:center;padding:30px 0;color:var(--text-lt)"><div style="font-size:40px;margin-bottom:10px">🐾</div><p>Aucun animal — ajoute le premier !</p></div>`
    : sorted.map((a) => {
        const realIdx = animals.indexOf(a);
        return `<div class="card card-accent" style="margin-bottom:10px">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:26px">${animalEmoji(a.animal_type)}</span>
              <div>
                <div style="font-weight:bold;font-size:16px;color:var(--text)">${a.name||"Sans nom"}</div>
                <div style="font-size:12px;color:var(--text-lt);margin-top:2px">${[a.animal_gender,a.is_cuddly,a.animal_age].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-outline btn-small" onclick="openAnimalModal(${realIdx})">✏️</button>
              ${animals.length > 1 ? `<button class="btn btn-small" style="background:white;border:1px solid var(--border);color:var(--red)" onclick="deleteAnimal(${realIdx})">🗑</button>` : ""}
            </div>
          </div>
          ${a.personality?.length ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:5px">${a.personality.slice(0,3).map(p=>`<span class="badge badge-orange">${p}</span>`).join("")}</div>` : ""}
        </div>`;
      }).join("");

  html += `<button class="btn btn-outline" onclick="openAnimalModal(null)" style="margin-top:8px;border-style:dashed">+ Ajouter un animal</button>`;
  document.getElementById("content-animaux").innerHTML = html;
}

function deleteAnimal(idx) {
  if (!confirm("Supprimer cet animal ?")) return;
  animals.splice(idx, 1);
  renderAnimaux(); updateSubtitle();
}
function updateSubtitle() {
  const s = [...animals].sort((a,b)=>(a.name||"").localeCompare(b.name||"","fr"));
  document.getElementById("fiche-sub").textContent = s.length > 0 ? s.map(a=>a.name).filter(Boolean).join(", ") : "Aucun animal";
}

// ═══ MODAL ANIMAL ═══
const ANIMAL_FIELDS = [
  {id:"animal_type",  label:"Type d'animal",          type:"multi",  options:["Chat","Chien","Lapin","Autre"],icon:"🐾"},
  {id:"animal_gender",label:"Sexe",                   type:"select", options:["Mâle","Femelle"],icon:"⚥"},
  {id:"animal_age",   label:"Âge",                    type:"select", options:["Chaton / Jeune (- 1 an)","Adulte (1-7 ans)","Senior (+ 7 ans)"],icon:"🎂"},
  {id:"is_cuddly",    label:"Niveau de câlins",        type:"select", options:["Très câlin(e)","Un peu câlin(e)","Pas trop câlin(e)","Indépendant(e)"],icon:"🥰"},
  {id:"comes_to_me",  label:"Vient spontanément ?",    type:"select", options:["Oui, tout le temps","Parfois","Pas vraiment","Se cache"],icon:"👣"},
  {id:"is_playful",   label:"Joueur/joueuse ?",         type:"select", options:["Très joueur/joueuse","Un peu","Pas vraiment","Dort beaucoup"],icon:"🎾"},
  {id:"eats_how",     label:"Rapport à la nourriture",  type:"select", options:["Mange tout de suite","Mange à son rythme","Difficile / capricieux","Très gourmand(e)"],icon:"🍽️"},
  {id:"personality",  label:"Personnalité",             type:"multi",  options:["Timide","Curieux/se","Collant(e)","Dominant(e)","Peureux/se","Bavard(e)","Calme","Aventurier/ère"],icon:"✨"},
  {id:"favorite_things",label:"Ce qu'il/elle adore",  type:"multi",  options:["Les caresses sur la tête","Le ventre","Jouer avec une canne","Les jouets qui bougent","Regarder par la fenêtre","Les hauteurs","Les câlins dans les bras","Ronronner sur les genoux"],icon:"💕"},
  {id:"dislikes",     label:"Ce qu'il/elle n'aime pas",type:"multi", options:["Être pris(e) dans les bras","Les bruits forts","Les inconnus","Être seul(e)","Trop de câlins","Qu'on touche son ventre"],icon:"🚫"},
  {id:"special_behavior",label:"Comportement particulier",type:"text",ph:"Ex: miaule beaucoup...",icon:"📝"},
  {id:"has_litter",   label:"Litière à nettoyer ?",     type:"select", options:["Oui","Non"],icon:"🪣"},
  {id:"has_water",    label:"Eau à changer ?",           type:"select", options:["Oui","Non"],icon:"💧"},
  {id:"has_croquettes",label:"Croquettes à remettre ?", type:"select", options:["Oui","Non"],icon:"🟤"},
  {id:"has_pate",     label:"Pâtée à donner ?",          type:"select", options:["Oui","Non"],icon:"🍖"},
];

function openAnimalModal(idx) {
  editAnimalIdx = idx;
  animalForm = idx !== null ? { ...animals[idx] } : {};
  document.getElementById("modal-animal-title").textContent = idx !== null ? "Modifier l'animal" : "Nouvel animal";
  document.getElementById("animal-modal").classList.remove("hidden");
  renderAnimalForm();
}
function closeAnimalModal() {
  document.getElementById("animal-modal").classList.add("hidden");
  editAnimalIdx = null; animalForm = {};
}
function renderAnimalForm() {
  let html = `<div style="margin-bottom:14px">
    <label class="field-label">🐾 Prénom de l'animal</label>
    <input type="text" placeholder="Ex: Luna, Milo..." value="${(animalForm.name||"").replace(/"/g,"&quot;")}"
      oninput="animalForm.name=this.value" style="width:100%;padding:11px 13px;border-radius:10px;border:2px solid var(--border);font-size:16px;outline:none;font-family:Georgia,serif">
  </div>`;
  ANIMAL_FIELDS.forEach(f => {
    if (f.type === "select") {
      const opts = f.options.map(o => `<button type="button" class="option${animalForm[f.id]===o?" selected":""}" onclick="setAF('${f.id}','${o}',this)">${animalForm[f.id]===o?"✓ ":""}${o}</button>`).join("");
      html += `<div style="margin-bottom:14px"><label class="field-label">${f.icon} ${f.label}</label><div class="options">${opts}</div></div>`;
    } else if (f.type === "multi") {
      const cur = animalForm[f.id] || [];
      const tags = f.options.map(o => `<button type="button" class="tag-btn${cur.includes(o)?" selected":""}" onclick="toggleAF('${f.id}','${o}',this)">${cur.includes(o)?"✓ ":""}${o}</button>`).join("");
      html += `<div style="margin-bottom:14px"><label class="field-label">${f.icon} ${f.label}</label><div class="tags">${tags}</div></div>`;
    } else {
      html += `<div style="margin-bottom:14px"><label class="field-label">${f.icon} ${f.label}</label>
        <input type="text" placeholder="${f.ph||""}" value="${(animalForm[f.id]||"").replace(/"/g,"&quot;")}" oninput="animalForm['${f.id}']=this.value" style="width:100%;padding:11px 13px;border-radius:10px;border:2px solid var(--border);font-size:14px;outline:none;font-family:Georgia,serif">
      </div>`;
    }
  });
  document.getElementById("modal-animal-form").innerHTML = html;
}
function setAF(id, val, btn) {
  animalForm[id] = val;
  btn.closest(".options").querySelectorAll(".option").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
}
function toggleAF(id, val, btn) {
  if (!animalForm[id]) animalForm[id] = [];
  btn.classList.toggle("selected");
  if (btn.classList.contains("selected")) animalForm[id].push(val);
  else animalForm[id] = animalForm[id].filter(v => v !== val);
}
function saveAnimal() {
  if (!animalForm.name?.trim()) { alert("Entre le prénom de l'animal !"); return; }
  if (editAnimalIdx !== null) animals[editAnimalIdx] = { ...animalForm };
  else animals.push({ ...animalForm });
  closeAnimalModal(); renderAnimaux(); updateSubtitle();
}

// ═══ INFOS ═══
const INFO_FIELDS = [
  {id:"owner_name",   label:"Nom du propriétaire", ph:"Ex: Marie Dupont",            icon:"👤"},
  {id:"owner_phone",  label:"Téléphone",            ph:"Ex: 06 12 34 56 78",          icon:"📞"},
  {id:"address",      label:"Adresse",              ph:"Ex: 12 rue des Lilas, Paris", icon:"📍"},
  {id:"access_code",  label:"Code d'accès",        ph:"Ex: B1234",                   icon:"🔑"},
  {id:"vet",          label:"Vétérinaire",           ph:"Ex: Dr Martin, 01 23...",     icon:"🏥"},
  {id:"food",         label:"Nourriture / quantité", ph:"Ex: 1 sachet matin...",       icon:"🍽️"},
  {id:"health_notes", label:"Santé / médicaments",  ph:"Ex: Comprimé le matin...",    icon:"💊"},
  {id:"special_notes",label:"Notes importantes",    ph:"Ex: Ne pas ouvrir...",        icon:"📝"},
];
function renderInfo() {
  document.getElementById("content-info").innerHTML = INFO_FIELDS.map(f => `
    <div style="margin-bottom:14px">
      <label class="field-label">${f.icon} ${f.label}</label>
      <input type="text" placeholder="${f.ph}" value="${(infoForm[f.id]||"").replace(/"/g,"&quot;")}"
        oninput="infoForm['${f.id}']=this.value${f.id==="owner_name"?";document.getElementById('fiche-title').textContent='Fiche — '+(this.value||'?')":""}"
        style="width:100%;padding:11px 13px;border-radius:10px;border:2px solid var(--border);font-size:14px;outline:none;font-family:Georgia,serif">
    </div>`).join("");
}

// ═══ PRESTATIONS ═══
function renderPrestations() {
  let html = prestations.map((p, i) => {
    const { days, total } = calcPrestation(p);
    return `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:bold;font-size:14px">📅 ${fmtDate(p.date_start)} → ${fmtDate(p.date_end)}</div>
          <div style="font-size:12px;color:var(--text-lt);margin-top:3px">${days}j${p.mcer_nom?" · "+p.mcer_nom:""}${total>0?" · "+total+"€":""}${p.payment_status?(p.payment_status==="paye"?" ✅":" ⏳"):""}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-small" onclick="editPrestation(${i})">✏️</button>
          <button class="btn btn-small" style="background:white;border:1px solid var(--border);color:var(--text-lt)" onclick="deletePrestation(${i})">🗑</button>
        </div>
      </div>
    </div>`;
  }).join("");
  html += `<button class="btn btn-outline" onclick="goTo('prestation.html?key=${encodeURIComponent(currentKey)}&new=1')">+ Ajouter une prestation</button>`;
  document.getElementById("content-prestations").innerHTML = html;
}
function editPrestation(i) { goTo(`prestation.html?key=${encodeURIComponent(currentKey)}&idx=${i}`); }
function deletePrestation(i) {
  if (!confirm("Supprimer cette prestation ?")) return;
  prestations.splice(i,1); saveFicheData(); renderPrestations();
}

// ═══ SAUVEGARDE ═══
function saveFicheData() {
  profiles = getProfiles();
  profiles[currentKey] = { ...ownerData, name:infoForm.owner_name||currentKey, info:infoForm, animals, prestations };
  saveProfiles(profiles);
}
function saveFiche() {
  saveFicheData();
  document.getElementById("save-status").textContent = "✓ Fiche sauvegardée !";
  setTimeout(() => { document.getElementById("save-status").textContent = ""; goTo("accueil.html"); }, 800);
}

// ── Init ──
renderAnimaux(); renderInfo(); renderPrestations();
