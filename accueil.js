/* ============================================
   CAT SITTING — accueil.js
   ============================================ */

/* Fallback local au cas où storage.js n'aurait pas chargé ces fonctions */
if (typeof getSortedOwners !== "function") {
  window.getSortedOwners = function () {
    const profiles = getProfiles();
    return Object.keys(profiles).sort((a, b) =>
      (profiles[a].name || a).localeCompare(profiles[b].name || b, "fr")
    );
  };
}
if (typeof getSortedAnimals !== "function") {
  window.getSortedAnimals = function (key) {
    const profiles = getProfiles();
    const p = profiles[key];
    if (!p) return [];
    if (p.animals && p.animals.length > 0) {
      return [...p.animals].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
    }
    return p.animals === undefined && p.name ? [{ name: p.name, animal_type: p.animal_type || [] }] : [];
  };
}

/* Redirection si non connecté */
await window.hydrateFromSupabase();
if (!getCurrentUser()) {
  goTo("index.html");
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  if (confirm("Se déconnecter ?")) {
    await window.logOutSupabase();
    goTo("index.html");
  }
});

document.getElementById("calBtn").addEventListener("click", () => goTo("calendrier.html"));
document.getElementById("ajourBtn").addEventListener("click", () => goTo("ajour.html"));
document.getElementById("statTotalBox").addEventListener("click", () => goTo("budget.html"));

/* ---------- Effacer mes données (le compte de connexion lui-même reste actif) ---------- */
document.getElementById("deleteAccountBtn").addEventListener("click", () => {
  document.getElementById("modalDeleteAccount").classList.add("open");
});

document.getElementById("confirmDeleteAccount").addEventListener("click", async () => {
  const currentKey = getCurrentUser();
  if (!currentKey) return;

  // Vide les fiches/prestations dans Supabase (le compte de connexion, lui, reste actif)
  saveProfiles({});
  saveCalEvents({});
  saveTarifs({});

  await window.logOutSupabase();
  goTo("index.html");
});

document.getElementById("newProfileBtn").addEventListener("click", () => {
  document.getElementById("ownerNameInput").value = "";
  document.getElementById("modalNewFiche").classList.add("open");
});
document.getElementById("importMissionBtn").addEventListener("click", () => goTo("import.html"));
document.getElementById("mapClientsBtn").addEventListener("click", () => goTo("map-clients.html"));
document.getElementById("itineraireBtn").addEventListener("click", () => goTo("itineraire.html"));

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => btn.closest(".modal-overlay").classList.remove("open"));
});

document.getElementById("confirmNewFiche").addEventListener("click", () => {
  const name = document.getElementById("ownerNameInput").value.trim();
  if (!name) {
    alert("Merci de renseigner le nom du propriétaire.");
    return;
  }
  goTo(`fiche.html?new=1&owner=${encodeURIComponent(name)}`);
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function cuddlyShort(level) {
  if (!level) return "";
  if (level.startsWith("Très")) return "très câlin";
  if (level.startsWith("Un peu")) return "un peu câlin";
  if (level.startsWith("Pas trop")) return "peu câlin";
  return "indépendant";
}

function renderAnimalChips(key) {
  const animals = getSortedAnimals(key);
  if (animals.length === 0) return `<span class="text-lt small">Aucun animal ajouté</span>`;
  return animals.map(a => `${animalEmoji(a.animal_type)} ${escapeHtml(a.name || "Sans nom")}`).join(" · ");
}

function renderGardeCard(pr, colorTint) {
  const names = pr.animalName || "À définir";
  return `
    <div class="card tint-${colorTint}">
      <div class="card-row">
        <div>
          <div class="card-title">${pr.animalPhoto ? `<img src="${pr.animalPhoto}" alt="" style="width:26px;height:26px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:4px;">` : animalEmoji(pr.animalTypes)} ${escapeHtml(names)}</div>
          <div class="card-sub">${fmtDate(pr.date_start)} → ${fmtDate(pr.date_end)}</div>
        </div>
        <div class="icon-action" onclick="goTo('fiche.html?key=${encodeURIComponent(pr.ownerKey)}')">›</div>
      </div>
    </div>
  `;
}

/* ---------- Multi-sites : barre de choix du site ---------- */
function renderSiteBar() {
  const bar = document.getElementById("siteBar");
  const sites = getMySites();
  const active = getActiveSite();
  let html = "";
  if (sites.length) {
    html += `<div class="site-tabs">` +
      sites.map(s => `<button class="site-tab ${s === active ? "active" : ""}" data-site="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("") +
      (sites.length >= 2 ? `<button class="site-tab ${active === ALL_SITES ? "active" : ""}" data-site="${ALL_SITES}">Tous</button>` : "") +
      `</div>`;
  }
  if (!sites.length) html += `<a href="#" id="addSiteLink" class="small">${ic("plus")} Choisir mon site</a>`;
  bar.innerHTML = html;
  bar.classList.toggle("site-bar-side", sites.length > 0);
  document.querySelector(".app").classList.toggle("with-sites", sites.length > 0);
  bar.querySelectorAll(".site-tab").forEach(b => b.addEventListener("click", () => { setActiveSite(b.dataset.site); render(); }));
  const addLink = document.getElementById("addSiteLink");
  if (addLink) addLink.addEventListener("click", (e) => { e.preventDefault(); openSiteModal(false); });
}

async function openSiteModal(first) {
  document.getElementById("siteInput").value = "";
  document.getElementById("siteError").style.display = "none";
  document.getElementById("siteModalText").textContent = first
    ? "Pour quel site de petsitting travailles-tu ? Choisis-le dans la liste, ou écris son nom s'il n'y est pas encore : il sera proposé aux autres."
    : "Pour quel autre site travailles-tu aussi ? Tes fiches resteront séparées par site, mais le calendrier montre tout.";
  document.getElementById("modalSite").classList.add("open");
  const list = await window.listSites();
  document.getElementById("siteListAccueil").innerHTML = list
    .map(n => `<option value="${String(n).replace(/"/g, "&quot;")}"></option>`).join("");
}
document.querySelectorAll('[data-close="modalSite"]').forEach(b =>
  b.addEventListener("click", () => document.getElementById("modalSite").classList.remove("open")));
document.getElementById("skipSiteBtn").addEventListener("click", () => {
  localStorage.setItem(userKey("siteskipped"), "1");
  document.getElementById("modalSite").classList.remove("open");
});
document.getElementById("confirmSiteBtn").addEventListener("click", async () => {
  const name = document.getElementById("siteInput").value.trim();
  const err = document.getElementById("siteError");
  if (!name) { err.textContent = "Écris le nom de ton site."; err.style.display = "block"; return; }
  const btn = document.getElementById("confirmSiteBtn");
  btn.disabled = true;
  const official = (await window.registerSite(name)) || name;
  const sites = getMySites();
  const wasEmpty = sites.length === 0;
  if (!sites.some(s => s.toLowerCase() === official.toLowerCase())) sites.push(official);
  saveMySites(sites);
  if (wasEmpty) assignLegacyProfilesToSite(official);
  setActiveSite(official);
  await window.flushCloudSync();
  btn.disabled = false;
  document.getElementById("modalSite").classList.remove("open");
  render();
});

const siteChipFor = (name) =>
  (getActiveSite() === ALL_SITES && name) ? `<span class="site-chip">${escapeHtml(name)}</span>` : "";

/* ---------- Bonjour + menu Compte ---------- */
function renderHello() {
  const full = (getCurrentUserName() || "").trim();
  const first = full.includes("@") ? full.split("@")[0] : full.split(/\s+/)[0];
  document.getElementById("hello").textContent = first ? `Bonjour ${first}` : "Bonjour";
}
document.getElementById("accountBtn").addEventListener("click", async () => {
  const sites = getMySites();
  const email = (await window.__supabaseClient.auth.getSession()).data.session?.user?.email || "";
  document.getElementById("accountInfo").innerHTML =
    `<b>${escapeHtml(getCurrentUserName())}</b><br>${escapeHtml(email)}` +
    (sites.length ? `<br>${ic("building")} ${sites.map(escapeHtml).join(" · ")}` : "");
  document.getElementById("modalAccount").classList.add("open");
});
async function refreshPushLabel() {
  const st = await window.pushStatus();
  const label = document.getElementById("pushLabel");
  label.textContent = st === "on" ? "Rappels activés (toucher pour couper)" : "Activer les rappels sur ce téléphone";
  document.getElementById("pushBtn").style.display = st === "unsupported" ? "none" : "";
}
document.getElementById("accountBtn").addEventListener("click", refreshPushLabel);
document.getElementById("pushBtn").addEventListener("click", async () => {
  const msg = document.getElementById("pushMsg");
  msg.style.display = "block";
  if ((await window.pushStatus()) === "on") {
    await window.disablePush();
    msg.textContent = "Rappels coupés sur ce téléphone.";
  } else {
    const err = await window.enablePush();
    msg.textContent = err || "Rappels activés : tu recevras une notification la veille des départs et des clés.";
  }
  refreshPushLabel();
});
document.getElementById("accPrefsBtn").addEventListener("click", () => goTo("preferences.html"));
document.getElementById("tutoBtn").addEventListener("click", () => {
  document.getElementById("modalAccount").classList.remove("open");
  if (window.startTuto) window.startTuto();
});
document.getElementById("accSiteBtn").addEventListener("click", () => {
  document.getElementById("modalAccount").classList.remove("open");
  openSiteModal(false);
});

function renderReminders() {
  const box = document.getElementById("reminders");
  const list = getReminders();
  if (list.length === 0) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="reminder-box">
    <div class="rem-title">${ic("bell")} À ne pas oublier</div>
    ${list.slice(0, 8).map(r => `<div class="rem-line" style="cursor:pointer;" onclick="goTo('fiche.html?key=${encodeURIComponent(r.key)}')">${ic(r.icon)} ${escapeHtml(r.text)}</div>`).join("")}
  </div>`;
}

function render() {
  renderReminders();
  renderHello();
  renderSiteBar();
  document.getElementById("app-user") && (document.getElementById("app-user").textContent = getCurrentUserName());

  const owners = getSortedOwners();
  const allPrestations = getAllPrestations();
  const enCours = getGardesEnCours();
  const avenir = getGardesAvenir();
  const clesARegler = getClesARegler();
  const rdvs = getNextKeyRdvs();

  // Stats
  const total = allPrestations.reduce((sum, p) => sum + calcPrestation(p).total, 0);
  document.getElementById("statTotal").textContent = `${Math.round(total)}€`;
  document.getElementById("statAvenir").textContent = avenir.length;
  document.getElementById("statFiches").textContent = owners.length;

  // Gardes en cours
  document.getElementById("countEnCours").textContent = enCours.length;
  const listEnCours = document.getElementById("listEnCours");
  listEnCours.innerHTML = enCours.length
    ? enCours.map(p => renderGardeCard(p, "orange")).join("")
    : `<div class="empty-state">Aucune garde en cours ${ic("paw")}</div>`;

  // Gardes à venir
  document.getElementById("countAvenir").textContent = avenir.length;
  const listAvenir = document.getElementById("listAvenir");
  listAvenir.innerHTML = avenir.length
    ? avenir.map(p => renderGardeCard(p, "blue")).join("")
    : `<div class="empty-state">Aucune garde prévue pour le moment</div>`;

  // Clés à régler (warning)
  const secCles = document.getElementById("secCles");
  if (clesARegler.length > 0) {
    secCles.style.display = "block";
    document.getElementById("countCles").textContent = clesARegler.length;
    document.getElementById("listCles").innerHTML = clesARegler.map(p => {
      const animals = getSortedAnimals(p.ownerKey);
      const nameLabel = animals.length >= 2
        ? `<u>${escapeHtml((getProfiles()[p.ownerKey] || {}).name || p.ownerKey)}</u>`
        : escapeHtml(p.animalName);
      return `
      <div class="card tint-red">
        <div class="card-row">
          <div>
            <div class="card-title">${animalEmoji(p.animalTypes)} ${nameLabel}</div>
            <div class="card-sub">Garde terminée le ${fmtShort(p.date_end)} · clés non rendues</div>
          </div>
          <div class="icon-action" onclick="goTo('fiche.html?key=${encodeURIComponent(p.ownerKey)}')">›</div>
        </div>
      </div>
    `;
    }).join("");
  } else {
    secCles.style.display = "none";
  }

  // Prochains RDV clés
  document.getElementById("countRdv").textContent = rdvs.length;
  const listRdv = document.getElementById("listRdv");
  listRdv.innerHTML = rdvs.length
    ? rdvs.map(r => {
        const animals = getSortedAnimals(r.ownerKey);
        const nameLabel = animals.length >= 2
          ? `<u>${escapeHtml((getProfiles()[r.ownerKey] || {}).name || r.ownerKey)}</u>`
          : escapeHtml(r.animalName);
        return `
      <div class="card tint-purple">
        <div class="card-row">
          <div>
            <div class="card-title">${ic("key")} ${r.type === "recuperation" ? "Récupération" : "Rendu"} — ${nameLabel}</div>
            <div class="card-sub">${fmtDate(r.date)} ${r.time ? "à " + r.time : ""} ${r.place ? "· " + escapeHtml(r.place) : ""}</div>
          </div>
          <div class="icon-action" onclick="goTo('fiche.html?key=${encodeURIComponent(r.ownerKey)}')">›</div>
        </div>
      </div>
    `;
      }).join("")
    : `<div class="empty-state">Aucun RDV clés à venir</div>`;

  // Mes fiches
  document.getElementById("countFiches").textContent = owners.length;
  document.getElementById("tabCountFiches").textContent = owners.length;
  const listFiches = document.getElementById("listFiches");
  listFiches.innerHTML = owners.length
    ? owners.map(key => {
        const profiles = getProfiles();
        const p = profiles[key];
        return `
          <div class="card" onclick="goTo('fiche.html?key=${encodeURIComponent(key)}')" style="cursor:pointer;">
            <div class="card-title">${ic("user")} ${escapeHtml(p.name || key)} ${siteChipFor(siteOfProfile(p))}</div>
            <div class="card-sub">${renderAnimalChips(key)}</div>
          </div>
        `;
      }).join("")
    : `<div class="empty-state">Aucune fiche pour l'instant<br>Créez-en une pour commencer ${ic("paw")}</div>`;

  // Toutes les prestations
  document.getElementById("countPrestations").textContent = allPrestations.length;
  document.getElementById("tabCountPrestas").textContent = allPrestations.length;
  const listPrestations = document.getElementById("listPrestations");
  listPrestations.innerHTML = allPrestations.length
    ? allPrestations.map(p => {
        const calc = calcPrestation(p);
        const paidBadge = p.payment_status === "paye"
          ? `<span class="badge badge-green">Payé</span>`
          : `<span class="badge badge-red">En attente</span>`;
        return `
          <div class="card tint-green">
            <div class="card-row">
              <div>
                <div class="card-title">${animalEmoji(p.animalTypes)} ${escapeHtml(p.animalName)} ${siteChipFor(p.site)}</div>
                <div class="card-sub">${fmtShort(p.date_start)} → ${fmtShort(p.date_end)} · ${calc.total}€</div>
              </div>
              ${paidBadge}
            </div>
          </div>
        `;
      }).join("")
    : `<div class="empty-state">Aucune prestation enregistrée</div>`;
}

render();
if (getMySites().length === 0 && localStorage.getItem(userKey("siteskipped")) !== "1") openSiteModal(true);

/* ---------- Centre d'aide ---------- */
/* ---------- Onglets Accueil / Fiches / Prestations ---------- */
function showHomeTab(name) {
  document.querySelectorAll(".home-tab").forEach(b => b.classList.toggle("active", b.dataset.hometab === name));
  document.querySelectorAll(".home-panel").forEach(p => p.classList.toggle("active", p.id === "panel-" + name));
  try { sessionStorage.setItem("cs-hometab", name); } catch (e) {}
}
document.querySelectorAll(".home-tab").forEach(b => b.addEventListener("click", () => showHomeTab(b.dataset.hometab)));
try { showHomeTab(sessionStorage.getItem("cs-hometab") || "home"); } catch (e) {}
document.getElementById("newProfileBtn2").addEventListener("click", () => document.getElementById("newProfileBtn").click());


/* ---------- Accès admin : visible seulement pour les comptes autorisés ---------- */
(async () => {
  const role = await window.getMyAdminRole();
  if (!role) return;
  const btn = document.getElementById("adminBtn");
  btn.style.display = "";
  btn.addEventListener("click", () => {
    document.getElementById("adminCodeInput").value = "";
    document.getElementById("adminCodeError").style.display = "none";
    document.getElementById("modalAdminCode").classList.add("open");
  });
})();
document.querySelectorAll('[data-close="modalAdminCode"]').forEach(b =>
  b.addEventListener("click", () => document.getElementById("modalAdminCode").classList.remove("open")));
document.getElementById("confirmAdminCode").addEventListener("click", async () => {
  const code = document.getElementById("adminCodeInput").value.trim();
  const err = document.getElementById("adminCodeError");
  const problem = await window.checkAdminCode(code);
  if (problem) {
    err.textContent = problem.includes("incorrect") ? "Code incorrect." : problem;
    err.style.display = "block";
    return;
  }
  sessionStorage.setItem("cs-admin-unlocked", "1");
  sessionStorage.setItem("cs-admin-code", code);
  goTo("admin.html");
});

/* Tuto de bienvenue : se lance tout seul la première fois */
if (window.maybeStartTuto) window.maybeStartTuto();
else window.addEventListener("load", () => window.maybeStartTuto && window.maybeStartTuto());
