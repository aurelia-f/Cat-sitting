/* ============================================
   CAT SITTING — admin.js
   Vue d'ensemble de tous les comptes (accès caché)
   Lit désormais directement dans Supabase (nécessite d'être connecté).
   ============================================ */

await window.hydrateFromSupabase();

if (sessionStorage.getItem("cs-admin-unlocked") !== "1") {
  goTo("index.html");
}

document.getElementById("backBtn").addEventListener("click", () => goTo("index.html"));

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function statsForAccount(row) {
  const profiles = row.profiles || {};
  let ownerCount = 0, animalCount = 0, prestationCount = 0, revenue = 0;
  const fiches = [];
  Object.values(profiles).forEach(p => {
    ownerCount++;
    const animals = (p.animals && p.animals.length > 0) ? p.animals : (p.name ? [p] : []);
    animalCount += animals.length;
    let ficheRevenue = 0;
    (p.prestations || []).forEach(pr => {
      prestationCount++;
      const total = calcPrestation(pr).total;
      revenue += total;
      ficheRevenue += total;
    });
    fiches.push({ name: p.name || "Sans nom", animalCount: animals.length, revenue: ficheRevenue });
  });
  return { ownerCount, animalCount, prestationCount, revenue, fiches };
}

async function render() {
  const list = document.getElementById("usersList");
  list.innerHTML = `<div class="empty-state">Chargement…</div>`;

  const accounts = await window.getAllAccountsFromSupabase();

  let totalFiches = 0;
  let totalRevenue = 0;

  if (accounts.length === 0) {
    list.innerHTML = `<div class="empty-state">Aucun compte pour l'instant</div>`;
  } else {
    list.innerHTML = accounts.map((row, idx) => {
      const stats = statsForAccount(row);
      totalFiches += stats.ownerCount;
      totalRevenue += stats.revenue;
      const displayName = row.name || row.email || row.user_id;
      return `
        <div class="card">
          <div class="card-row">
            <div>
              <div class="card-title">${escapeHtml(displayName)}</div>
              <div class="card-sub">${escapeHtml(row.email || "")}</div>
              <div class="card-sub">${stats.ownerCount} fiche${stats.ownerCount > 1 ? "s" : ""} · ${stats.animalCount} animal${stats.animalCount > 1 ? "aux" : ""} · ${stats.prestationCount} prestation${stats.prestationCount > 1 ? "s" : ""}</div>
              <div class="card-sub">💶 ${Math.round(stats.revenue)}€ de CA</div>
            </div>
            <button class="btn btn-sm btn-secondary" data-toggle-detail="${idx}">Voir</button>
          </div>
          <div id="detail-${idx}" style="display:none; margin-top:10px;">
            <div class="divider"></div>
            ${stats.fiches.length === 0
              ? `<div class="small text-lt">Aucune fiche</div>`
              : stats.fiches.map(f => `
                  <div class="flex-between small" style="padding:4px 0;">
                    <span>👤 ${escapeHtml(f.name)} · ${f.animalCount} animal${f.animalCount > 1 ? "aux" : ""}</span>
                    <span>${Math.round(f.revenue)}€</span>
                  </div>
                `).join("")
            }
          </div>
        </div>
      `;
    }).join("");
  }

  document.getElementById("statUsers").textContent = accounts.length;
  document.getElementById("statFichesTotal").textContent = totalFiches;
  document.getElementById("statRevenueTotal").textContent = `${Math.round(totalRevenue)}€`;

  list.querySelectorAll("[data-toggle-detail]").forEach(btn => {
    btn.addEventListener("click", () => {
      const panel = document.getElementById(`detail-${btn.dataset.toggleDetail}`);
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    });
  });
}

render();
