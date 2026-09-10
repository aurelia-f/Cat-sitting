/* ============================================
   CAT SITTING — admin.js
   Vue d'ensemble de tous les comptes (accès caché)
   ============================================ */

if (sessionStorage.getItem("cs-admin-unlocked") !== "1") {
  goTo("index.html");
}

document.getElementById("backBtn").addEventListener("click", () => goTo("index.html"));

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function statsForUser(key) {
  const profiles = Storage.get(`cs-${key}-profiles`) || {};
  let ownerCount = 0, animalCount = 0, prestationCount = 0, revenue = 0;
  Object.values(profiles).forEach(p => {
    ownerCount++;
    const animals = (p.animals && p.animals.length > 0) ? p.animals : (p.name ? [p] : []);
    animalCount += animals.length;
    (p.prestations || []).forEach(pr => {
      prestationCount++;
      revenue += calcPrestation(pr).total;
    });
  });
  return { ownerCount, animalCount, prestationCount, revenue };
}

function render() {
  const users = Storage.get("cs-users-v2") || [];

  let totalFiches = 0;
  let totalRevenue = 0;

  const list = document.getElementById("usersList");

  if (users.length === 0) {
    list.innerHTML = `<div class="empty-state">Aucun compte pour l'instant</div>`;
  } else {
    list.innerHTML = users.map(u => {
      const stats = statsForUser(u.key);
      totalFiches += stats.ownerCount;
      totalRevenue += stats.revenue;
      return `
        <div class="card">
          <div class="card-row">
            <div>
              <div class="card-title">${escapeHtml(u.name)}</div>
              <div class="card-sub">${stats.ownerCount} fiche${stats.ownerCount > 1 ? "s" : ""} · ${stats.animalCount} animal${stats.animalCount > 1 ? "aux" : ""} · ${stats.prestationCount} prestation${stats.prestationCount > 1 ? "s" : ""}</div>
              <div class="card-sub">💶 ${Math.round(stats.revenue)}€ de CA</div>
            </div>
            <button class="btn btn-sm btn-secondary" data-view-as="${u.key}" data-view-name="${escapeHtml(u.name)}">Voir</button>
          </div>
        </div>
      `;
    }).join("");
  }

  document.getElementById("statUsers").textContent = users.length;
  document.getElementById("statFichesTotal").textContent = totalFiches;
  document.getElementById("statRevenueTotal").textContent = `${Math.round(totalRevenue)}€`;

  list.querySelectorAll("[data-view-as]").forEach(btn => {
    btn.addEventListener("click", () => {
      setCurrentUser(btn.dataset.viewAs, btn.dataset.viewName);
      goTo("accueil.html");
    });
  });
}

render();
