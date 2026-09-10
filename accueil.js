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
    return p.name ? [{ name: p.name, animal_type: p.animal_type || [] }] : [];
  };
}

/* Redirection si non connecté */
if (!getCurrentUser()) {
  goTo("index.html");
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  if (confirm("Se déconnecter ?")) {
    logoutCurrentUser();
    goTo("index.html");
  }
});

document.getElementById("calBtn").addEventListener("click", () => goTo("calendrier.html"));
document.getElementById("ajourBtn").addEventListener("click", () => goTo("ajour.html"));

/* ---------- Suppression du compte (uniquement par la personne connectée) ---------- */
const USERS_KEY = "cs-users-v2";

document.getElementById("deleteAccountBtn").addEventListener("click", () => {
  document.getElementById("deleteAccountPassword").value = "";
  document.getElementById("deleteAccountError").style.display = "none";
  document.getElementById("modalDeleteAccount").classList.add("open");
});

document.getElementById("confirmDeleteAccount").addEventListener("click", () => {
  const password = document.getElementById("deleteAccountPassword").value;
  const currentKey = getCurrentUser();
  if (!password || !currentKey) return;

  const users = Storage.get(USERS_KEY) || [];
  const me = users.find(u => u.key === currentKey);
  if (!me) return;

  if (simpleHash(password) !== me.passwordHash) {
    document.getElementById("deleteAccountError").style.display = "block";
    return;
  }

  // Supprime toutes les données de CET utilisateur uniquement
  Storage.remove(userKey("profiles"));
  Storage.remove(userKey("calevents"));
  Storage.remove(userKey("tarifs"));

  const updatedUsers = users.filter(u => u.key !== currentKey);
  Storage.set(USERS_KEY, updatedUsers);

  logoutCurrentUser();
  goTo("index.html");
});

document.getElementById("newProfileBtn").addEventListener("click", () => {
  document.getElementById("ownerNameInput").value = "";
  document.getElementById("modalNewFiche").classList.add("open");
});

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
  const names = pr.animalName || "À définir 🐾";
  return `
    <div class="card tint-${colorTint}">
      <div class="card-row">
        <div>
          <div class="card-title">${animalEmoji(pr.animalTypes)} ${escapeHtml(names)}</div>
          <div class="card-sub">${fmtDate(pr.date_start)} → ${fmtDate(pr.date_end)}</div>
        </div>
        <div class="icon-action" onclick="goTo('fiche.html?key=${encodeURIComponent(pr.ownerKey)}')">›</div>
      </div>
    </div>
  `;
}

function render() {
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
    : `<div class="empty-state">Aucune garde en cours 🐾</div>`;

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
            <div class="card-title">${r.type === "recuperation" ? "🔑 Récupération" : "🔑 Rendu"} — ${nameLabel}</div>
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
  const listFiches = document.getElementById("listFiches");
  listFiches.innerHTML = owners.length
    ? owners.map(key => {
        const profiles = getProfiles();
        const p = profiles[key];
        return `
          <div class="card" onclick="goTo('fiche.html?key=${encodeURIComponent(key)}')" style="cursor:pointer;">
            <div class="card-title">👤 ${escapeHtml(p.name || key)}</div>
            <div class="card-sub">${renderAnimalChips(key)}</div>
          </div>
        `;
      }).join("")
    : `<div class="empty-state">Aucune fiche pour l'instant<br>Créez-en une pour commencer 🐾</div>`;

  // Toutes les prestations
  document.getElementById("countPrestations").textContent = allPrestations.length;
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
                <div class="card-title">${animalEmoji(p.animalTypes)} ${escapeHtml(p.animalName)}</div>
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
