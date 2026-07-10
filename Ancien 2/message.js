// ═══════════════════════════════════
// MESSAGE.JS
// ═══════════════════════════════════

if (!getCurrentUser()) goTo("index.html");

const params     = new URLSearchParams(window.location.search);
const animalName = params.get("name") || "";
const profiles   = getProfiles();
const profile    = profiles[animalName] || {};

let qForm     = {};
let tasks     = { litter:false, water:false, croquettes:false, pate:false };
let inclTasks = false;

// ── Init ──
document.getElementById("msg-title").textContent = "Message — " + animalName;
document.getElementById("animal-badge").innerHTML = `
  <span style="font-size:24px">${animalEmoji(profile.animal_type)}</span>
  <div style="font-size:13px;color:var(--text-lt)">
    <span style="font-weight:bold;color:var(--text)">${animalName}</span>
    ${profile.is_cuddly ? " · " + profile.is_cuddly : ""}
    ${profile.personality?.length ? " · " + profile.personality.slice(0,2).join(", ") : ""}
  </div>`;

// Entretien selon fiche
const hasTask = profile.has_litter==="Oui"||profile.has_water==="Oui"||profile.has_croquettes==="Oui"||profile.has_pate==="Oui";
if (hasTask) {
  document.getElementById("entretien-section").classList.remove("hidden");
  let checksHtml = "";
  if (profile.has_litter==="Oui")     checksHtml += chkHtml("litter","🪣 Litière nettoyée");
  if (profile.has_water==="Oui")      checksHtml += chkHtml("water","💧 Eau changée");
  if (profile.has_croquettes==="Oui") checksHtml += chkHtml("croquettes","🟤 Croquettes remises");
  if (profile.has_pate==="Oui")       checksHtml += chkHtml("pate","🍖 Pâtée donnée");
  document.getElementById("entretien-checks").innerHTML = checksHtml;
}

function chkHtml(key, label) {
  return `<label class="chk-label">
    <div class="chk-box" id="chk-${key}" onclick="toggleTask('${key}')"></div>
    ${label}
  </label>`;
}

// ── Helpers formulaire ──
function setQ(key, val) { qForm[key] = val; }
function setQPill(btn, key, val) {
  btn.closest(".pills").querySelectorAll(".pill").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  qForm[key] = val;
}
function setQOpt(btn, key, val) {
  btn.closest(".options").querySelectorAll(".option").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  qForm[key] = val;
}
function toggleQ(btn, key, val) {
  if (!qForm[key]) qForm[key] = [];
  btn.classList.toggle("selected");
  if (btn.classList.contains("selected")) qForm[key].push(val);
  else qForm[key] = qForm[key].filter(v => v !== val);
}
function toggleTask(key) {
  tasks[key] = !tasks[key];
  const box = document.getElementById("chk-"+key);
  if (box) box.classList.toggle("checked", tasks[key]);
}
function toggleInclude() {
  inclTasks = !inclTasks;
  document.getElementById("chk-include").classList.toggle("checked", inclTasks);
}
let activeIncident = "";
function setIncident(btn, val) {
  document.querySelectorAll("#incident-opts .option").forEach(b => b.classList.remove("selected"));
  if (activeIncident === val) { activeIncident = ""; }
  else { activeIncident = val; btn.classList.add("selected"); }
  qForm.incident_type = activeIncident;
}

// ── Génération message ──
let _seed = Date.now();
function sr() { _seed = (_seed*1664525+1013904223)&0xffffffff; return ((_seed>>>0)/0xffffffff); }
function pick(arr) { return arr[Math.floor(sr()*arr.length)]; }
function resetSeed() { _seed = Date.now()+Math.floor(Math.random()*999999); }

function generateMsg() {
  resetSeed();
  const p    = profile;
  const q    = { ...qForm, anecdote: document.getElementById("anecdote-input").value, incident: [qForm.incident_type, document.getElementById("incident-text").value].filter(Boolean).join(" — ") };
  const t    = inclTasks ? tasks : { litter:false, water:false, croquettes:false, pate:false };
  const name = p.name || "";
  const multi  = p.animal_gender === "Mixte";
  const isFem  = p.animal_gender === "Femelle";
  const lui    = multi?"leur":"lui";
  const il     = multi?"ils":isFem?"elle":"il";
  const a      = multi?"ont":"a";
  const est    = multi?"sont":"est";
  const fe     = isFem&&!multi?"e":"";
  const ne     = isFem&&!multi?"ne":"";
  const lines  = [];
  const type   = q.message_type||"suivi";
  const ate    = q.ate_well;
  const cuddly = p.is_cuddly;
  const comes  = p.comes_to_me;
  const favs   = p.favorite_things||[];
  const acts   = q.today_activity||[];

  lines.push(pick(["Bonjour 😊","Bonjour !","Bonjour,","Coucou !"]));

  if (type==="dernier") {
    lines.push(name?pick([`${name} va très bien, tout s'est super bien passé !`,`Tout s'est parfaitement bien passé avec ${name} !`,`${name} ${a} été adorable${fe} pendant votre absence 🥰`,`${name} ${a} été sage${fe} comme une image 😊`]):pick([`Tout s'est très bien passé pendant votre absence !`,`${il} ${a} été adorable${fe} pendant votre absence 🥰`]));
  } else if (type==="premier") {
    lines.push(name?pick([`${name} va très bien, je viens de passer !`,`Première visite faite, ${name} va très bien 😊`,`${name} ${est} en pleine forme !`]):pick([`Première visite faite, tout va bien !`,`${il} va très bien, je viens de passer 😊`]));
  } else {
    lines.push(name?pick([`${name} va très bien !`,`${name} va très bien, pas d'inquiétude 😊`,`${name} ${est} en pleine forme !`,`Tout va bien pour ${name} !`,`${name} ${est} au top !`]):pick([`Tout va très bien !`,`${il} va très bien !`,`${il} ${est} en pleine forme 😊`]));
  }

  if (cuddly==="Très câlin(e)") lines.push(pick([`Toujours aussi câlin${fe}, c'est un amour 🥰`,`Je ${lui} ai fait plein de câlins 🥰`,`${il} ${est} tellement câlin${fe}, j'adore !`,`${il} m'${a} réclamé des câlins dès que je suis entré${fe} !`]));
  else if (cuddly==="Un peu câlin(e)") lines.push(pick([`${il} ${est} venu${fe} chercher quelques caresses, trop mignon${ne} !`,`Je ${lui} ai fait quelques petites caresses 😊`,`Un peu câlin${fe} aujourd'hui 😊`]));
  else if (cuddly==="Indépendant(e)") lines.push(pick([`${il} fait sa petite vie tranquillement, tout va bien !`,`Toujours aussi indépendant${fe}, mais tout va bien 😊`]));
  else if (cuddly==="Pas trop câlin(e)") lines.push(pick([`${il} n'est pas très câlin${fe} mais ${il} va bien !`,`${il} garde ses distances mais tout va bien 😊`]));

  if (comes==="Oui, tout le temps") lines.push(pick([`${isFem?"Elle":"Il"} ne me lâche pas ! 😄`,`${il} me suit partout, c'est trop drôle !`,`${il} ${est} collé${fe} à moi dès que j'arrive !`]));
  else if (comes==="Parfois") lines.push(pick([`${il} ${est} venu${fe} me dire bonjour 😊`,`${il} ${est} venu${fe} à sa façon, à son rythme 😊`]));
  else if (comes==="Se cache") lines.push(pick([`${il} ${est} un peu timide mais commence à s'habituer à moi 😊`,`${il} se cache un peu mais tout va bien !`]));

  if (ate==="Très bien") lines.push(pick([`${il} ${a} très bien mangé !`,`La gamelle est vide, appétit au top ! 😄`,`${il} ${a} dévoré sa gamelle ! 😄`,`Très bon appétit aujourd'hui !`]));
  else if (ate==="Normal") lines.push(pick([`${il} ${a} bien mangé comme d'habitude 😊`,`Repas normal, tout va bien !`]));
  else if (ate==="Peu") lines.push(pick([`${il} ${a} peu mangé mais ${il} ${a} l'air bien.`,`Pas très faim aujourd'hui, mais rien d'inquiétant !`]));

  if (acts.includes("Ronronné fort")) lines.push(pick([`Gros ronrons aujourd'hui 🐱`,`${il} ${a} ronronné de bonheur 🐱`,`La ronronthérapie était au rendez-vous 🐱`]));
  if (acts.includes("Dormi dans mes bras")) lines.push(pick([`${il} ${est} venu${fe} s'endormir dans mes bras 🥰`,`J'ai servi de coussin, et c'était un honneur 🥰`]));
  if (acts.includes("Joué")) lines.push(pick([`${il} ${a} bien joué, ${il} était en forme !`,`Bonne séance de jeu aujourd'hui 😄`]));
  if (acts.includes("Fait des bisous")) lines.push(pick([`${il} m'${a} fait des petits bisous 🥰`,`${il} ${est} venu${fe} me faire des bisous, j'ai fondu 🥰`]));
  if (acts.includes("Exploré")) lines.push(pick([`${il} ${a} exploré partout, curieux comme toujours !`,`Grande inspection de l'appartement 😄`]));

  if (!acts.includes("Ronronné fort")&&favs.includes("Ronronner sur les genoux")) lines.push(pick([`${il} ${a} ronronné sur mes genoux 🐱`,`Gros ronrons sur les genoux 🐱`]));
  if (!acts.includes("Dormi dans mes bras")&&favs.includes("Les câlins dans les bras")) lines.push(pick([`${il} ${est} resté${fe} dans mes bras un bon moment 🥰`]));
  if (favs.includes("Regarder par la fenêtre")) lines.push(pick([`${il} ${a} passé du temps à regarder par la fenêtre 🐾`,`Grande surveillance depuis la fenêtre 😄`]));

  const tl=[];
  if (t.litter)     tl.push(pick(["J'ai bien nettoyé la litière 🪣","Litière propre ! 🪣"]));
  if (t.water)      tl.push(pick(["J'ai changé l'eau fraîche 💧","Eau fraîche renouvelée 💧"]));
  if (t.croquettes) tl.push(pick(["J'ai remis des croquettes 🟤","Croquettes rechargées 🟤"]));
  if (t.pate)       tl.push(pick(["J'ai donné la pâtée 🍖","Pâtée servie 🍖"]));
  if (tl.length>0) lines.push(tl.join(", ")+" !");

  if (q.incident?.trim()) {
    const inc = q.incident.trim().charAt(0).toLowerCase()+q.incident.trim().slice(1).replace(/\.$/,"");
    lines.push(pick([`Petite info : ${inc}.`,`Je voulais vous signaler que ${inc}.`,`À noter : ${inc}.`]));
  }
  if (q.anecdote?.trim()) {
    let t2 = q.anecdote.trim().charAt(0).toLowerCase()+q.anecdote.trim().slice(1).replace(/\.$/,"");
    lines.push(pick([`Petit moment mignon : ${t2} 🥰`,`Et ${il} ${a} même ${t2}, j'ai craqué 😄`,`Ce qui m'a attendri${fe} aujourd'hui : ${t2} !`,`Pour l'anecdote du jour, ${t2} 😊`,`Et là, ${t2}… trop adorable 🥰`]));
  }

  if (type==="dernier") {
    const keys=q.keys_return;
    if (keys==="boite") lines.push(pick([`J'ai laissé les clés dans la boîte aux lettres !`,`Les clés sont dans la boîte aux lettres !`]));
    else if (keys==="claque") lines.push(pick([`J'ai laissé les clés à l'intérieur et j'ai claqué la porte !`,`Clés à l'intérieur, porte claquée !`]));
    else if (keys==="rdv") lines.push(`On se voit bientôt pour les clés 😊`);
    lines.push(pick([`Merci pour votre confiance, c'était un vrai plaisir ! 🐾`,`C'était un plaisir de ${lui} rendre visite !`,`À bientôt peut-être 🐾`]));
  } else {
    lines.push(pick([`N'hésitez pas si vous avez des questions 😊`,`Je vous tiens au courant !`,`Bonne journée à vous !`,`À tout à l'heure pour la prochaine visite !`]));
  }

  const msg = lines.join("\n");

  // Afficher résultat
  document.getElementById("result-message").textContent = msg;
  document.getElementById("result-section").classList.remove("hidden");
  document.getElementById("result-section").scrollIntoView({ behavior:"smooth" });

  // Infos client
  const info = p.info || {};
  const infoFields = [
    {icon:"👤",label:"Propriétaire",key:"owner_name"},{icon:"📞",label:"Téléphone",key:"owner_phone"},
    {icon:"📍",label:"Adresse",key:"address"},{icon:"🔑",label:"Code",key:"access_code"},
    {icon:"🏥",label:"Véto",key:"vet"},
  ];
  const hasInfo = infoFields.some(f => info[f.key]?.trim());
  if (hasInfo) {
    document.getElementById("info-client").innerHTML = `
      <div class="card" style="margin-top:14px">
        <div class="section-label">📋 Infos client</div>
        ${infoFields.filter(f=>info[f.key]?.trim()).map(f=>`
          <div style="background:var(--bg);border-radius:8px;padding:8px 11px;margin-bottom:6px;border:1px solid var(--border)">
            <div style="font-size:11px;color:var(--text-lt);margin-bottom:2px">${f.icon} ${f.label}</div>
            <div style="font-size:13px;color:var(--text);font-weight:bold">${info[f.key]}</div>
          </div>`).join("")}
      </div>`;
  }

  // Sauvegarder dans l'historique
  const hist = getHistory();
  hist.push({ animalName, date: new Date().toISOString(), message: msg });
  saveHistory(hist);
}

function copyMsg() {
  const msg = document.getElementById("result-message").textContent;
  navigator.clipboard.writeText(msg).then(() => {
    const btn = document.getElementById("copy-btn");
    btn.textContent = "✓ Copié !";
    btn.style.background = "var(--green)";
    setTimeout(() => { btn.textContent = "📋 Copier"; btn.style.background = ""; }, 2000);
  });
}
