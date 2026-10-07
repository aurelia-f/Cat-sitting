/* ============================================
   CAT SITTING — budget.js
   Répartition du budget : par mois, par client, par formule
   ============================================ */

await window.hydrateFromSupabase();
if (!getCurrentUser()) {
  goTo("index.html");
}

document.getElementById("backBtn").addEventListener("click", () => goTo("accueil.html"));

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
  });
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

const MOIS_LONG = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

function monthLabelFromISO(ds) {
  const d = new Date(ds + "T00:00:00");
  return `${MOIS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}
function monthKeyFromISO(ds) {
  const d = new Date(ds + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function renderBarList(container, items, colorVar) {
  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state">Aucune donnée pour l'instant</div>`;
    return;
  }
  const max = Math.max(...items.map(i => i.amount), 1);
  container.innerHTML = items.map(i => {
    const pct = Math.max(4, Math.round((i.amount / max) * 100));
    return `
      <div class="card">
        <div class="flex-between">
          <span class="card-title" style="font-size:14px;">${escapeHtml(i.label)}</span>
          <span class="card-title" style="font-size:14px; color:${colorVar};">${Math.round(i.amount)}€</span>
        </div>
        <div style="background:var(--border); border-radius:6px; height:8px; margin-top:8px; overflow:hidden;">
          <div style="background:${colorVar}; height:100%; width:${pct}%; border-radius:6px;"></div>
        </div>
        <div class="card-sub mt-8">${i.count} mission${i.count > 1 ? "s" : ""}</div>
      </div>
    `;
  }).join("");
}

function render() {
  const all = getAllPrestations();

  const total = all.reduce((sum, p) => sum + calcPrestation(p).total, 0);
  document.getElementById("bTotal").textContent = `${Math.round(total)}€`;
  document.getElementById("bAvg").textContent = all.length > 0 ? `${Math.round(total / all.length)}€` : "0€";

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthTotal = all
    .filter(p => monthKeyFromISO(p.date_start) === currentMonthKey)
    .reduce((sum, p) => sum + calcPrestation(p).total, 0);
  document.getElementById("bMonthTotal").textContent = `${Math.round(monthTotal)}€`;
  document.getElementById("bMonthLabel").textContent = `${MOIS_LONG[now.getMonth()][0].toUpperCase()}${MOIS_LONG[now.getMonth()].slice(1)}`;

  // Par mois
  const byMonth = {};
  all.forEach(p => {
    const key = monthKeyFromISO(p.date_start);
    if (!byMonth[key]) byMonth[key] = { label: monthLabelFromISO(p.date_start), amount: 0, count: 0, key };
    byMonth[key].amount += calcPrestation(p).total;
    byMonth[key].count++;
  });
  const monthItems = Object.values(byMonth).sort((a, b) => b.key.localeCompare(a.key));
  renderBarList(document.getElementById("panel-mois"), monthItems, "var(--blue)");

  // Par client
  const byClient = {};
  all.forEach(p => {
    const key = p.ownerKey;
    if (!byClient[key]) byClient[key] = { label: p.ownerName || key, amount: 0, count: 0 };
    byClient[key].amount += calcPrestation(p).total;
    byClient[key].count++;
  });
  const clientItems = Object.values(byClient).sort((a, b) => b.amount - a.amount);
  renderBarList(document.getElementById("panel-client"), clientItems, "var(--accent-dk)");

  // Par formule
  const byFormule = {};
  all.forEach(p => {
    const key = p.mcer_nom || "Manuel";
    if (!byFormule[key]) byFormule[key] = { label: key, amount: 0, count: 0 };
    byFormule[key].amount += calcPrestation(p).total;
    byFormule[key].count++;
  });
  const formuleItems = Object.values(byFormule).sort((a, b) => b.amount - a.amount);
  renderBarList(document.getElementById("panel-formule"), formuleItems, "var(--green)");
}

render();
