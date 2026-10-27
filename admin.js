/* ============================================
   CAT SITTING — admin.js
   Vue d'ensemble : comptes, activité, erreurs et signalements.
   Accès par code (vérifié côté Supabase) : pas besoin d'être connecté(e).
   ============================================ */

await window.hydrateFromSupabase();

const INFO = await window.getMyAdminInfo();           // { role: "owner" | "viewer" | "site", site }
const ROLE = INFO ? INFO.role : null;
const MY_SITE = INFO && INFO.site ? INFO.site : "";
if (!ROLE || sessionStorage.getItem("cs-admin-unlocked") !== "1") {
  goTo("accueil.html");
  await new Promise(() => {});   // on arrête ici : la redirection est en cours
}
const IS_OWNER = ROLE === "owner";

document.getElementById("backBtn").addEventListener("click", () => goTo("accueil.html"));

// Admin "consultation" : on masque tout ce qui touche au CA, aux fiches et aux bugs
if (!IS_OWNER) {
  ["boxFiches", "boxRevMonth", "boxRevTotal", "alertBanner", "bugsSection"].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = "none";
  });
  document.getElementById("boxEmpty").style.display = "";
} else {
  document.getElementById("adminsSection").style.display = "";
  document.getElementById("siteManageSection").style.display = "";
}
if (ROLE === "site" && MY_SITE) {
  const h = document.querySelector(".topbar h1");
  h.innerHTML = `${ic("building")} Admin · ${MY_SITE.replace(/[<>&]/g, "")}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

/* ---------- Dates ---------- */
function relTime(iso) {
  if (!iso) return "jamais";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 2) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d} j`;
  const m = Math.floor(d / 30);
  return m < 12 ? `il y a ${m} mois` : `il y a ${Math.floor(m / 12)} an(s)`;
}
function shortDate(iso) {
  return iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
}
function isoDayFR(s) {
  if (!s) return "?";
  const [y, m, d] = s.split("-");
  return `${d}/${m}`;
}

/* ---------- Stats d'un compte ---------- */
const thisMonthKey = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; })();
const todayISO = fmtISODate(new Date());

function ficheSite(row, p) {
  return (p && p.site) || (Array.isArray(row.sites) && row.sites[0]) || "";
}

function statsForAccount(row, siteFilter) {
  if (row.fiche_count !== undefined && !row.profiles) {   // vue réduite (admin consultation)
    return { ownerCount: Number(row.fiche_count), animalCount: 0, prestationCount: 0, revenue: 0, revenueMonth: 0, fiches: [], keysPending: [] };
  }
  const profiles = row.profiles || {};
  let ownerCount = 0, animalCount = 0, prestationCount = 0, revenue = 0, revenueMonth = 0;
  const fiches = [];
  const keysPending = [];
  Object.values(profiles).forEach(p => {
    if (siteFilter !== undefined && ficheSite(row, p).toLowerCase() !== siteFilter.toLowerCase()) return;
    ownerCount++;
    const animals = (p.animals && p.animals.length > 0) ? p.animals : (p.animals === undefined && p.name ? [p] : []);
    animalCount += animals.length;
    let ficheRevenue = 0;
    const prestas = [];
    (p.prestations || []).forEach(pr => {
      prestationCount++;
      const total = calcPrestation(pr).total;
      revenue += total;
      ficheRevenue += total;
      if (pr.date_start && pr.date_start.slice(0, 7) === thisMonthKey) revenueMonth += total;
      prestas.push({ start: pr.date_start, end: pr.date_end, total });
      if (pr.date_end && pr.date_end < todayISO && !pr.keys_returned) {
        keysPending.push({ owner: p.name || "?", end: pr.date_end });
      }
    });
    prestas.sort((a, b) => (a.start || "").localeCompare(b.start || ""));
    fiches.push({ name: p.name || "Sans nom", animalCount: animals.length, revenue: ficheRevenue, prestas });
  });
  return { ownerCount, animalCount, prestationCount, revenue, revenueMonth, fiches, keysPending };
}

function mcerSummary(row) {
  const t = row.tarifs || {};
  const keys = Object.keys(t);
  if (keys.length === 0) return "Tarifs par défaut";
  return keys.map(k => {
    const v = t[k];
    const prix = v && typeof v === "object" ? (v.prix ?? v.price ?? "") : v;
    return `${escapeHtml(k)} : ${escapeHtml(prix)}€`;
  }).join(" · ");
}

/* ---------- Rendu ---------- */
let accounts = [];
let bugs = [];
let siteFilter = null;          // null = tous ; "" = sans site ; sinon nom du site

function accountSites(row) {
  return (Array.isArray(row.sites) && row.sites.length) ? row.sites : [""];
}
const siteLabel = s => s || "Sans site";
const siteChips = row => accountSites(row).filter(Boolean).map(s =>
  `<span class="site-chip">${escapeHtml(s)}</span>`).join(" ");

/* Résumé par site : comptes, CA du mois et total (propriétaire) */
function renderSitesSummary() {
  const box = document.getElementById("sitesSummary");
  const names = new Set();
  accounts.forEach(r => accountSites(r).forEach(s => names.add(s)));
  const list = [...names].sort((a, b) => (a || "~").localeCompare(b || "~", "fr"));
  if (list.length === 0 || (list.length === 1 && !IS_OWNER)) { document.getElementById("sitesSection").style.display = "none"; return; }
  document.getElementById("sitesSection").style.display = IS_OWNER ? "" : "none";
  if (!IS_OWNER) return;
  const adminBySite = {};
  (window.__adminList || []).forEach(a => { if (a.role === "site" && a.site) adminBySite[a.site.toLowerCase()] = a.email; });
  let gm = 0, gt = 0, gn = 0;
  const rows = list.map(s => {
    const accs = accounts.filter(r => accountSites(r).some(x => x.toLowerCase() === s.toLowerCase()));
    let rev = 0, revM = 0;
    accs.forEach(r => {
      const st = s ? statsForAccount(r, s) : statsForAccount(r);
      rev += st.revenue; revM += st.revenueMonth;
    });
    gm += revM; gt += rev; gn += accs.length;
    const adm = s ? adminBySite[s.toLowerCase()] : "";
    const active = siteFilter !== null && siteFilter.toLowerCase() === s.toLowerCase();
    return `<div class="card" data-site-pick="${escapeHtml(s)}" style="cursor:pointer; ${active ? "border-color:var(--accent-dk);" : ""}">
      <div class="card-row">
        <div>
          <div class="card-title">${ic("building")} ${escapeHtml(siteLabel(s))}</div>
          <div class="card-sub">${accs.length} compte${accs.length > 1 ? "s" : ""}${adm ? " · admin : " + escapeHtml(adm) : (s ? " · pas d'admin" : "")}</div>
        </div>
        <div style="text-align:right;">
          <div><b>${Math.round(revM)}€</b> <span class="small text-lt">ce mois</span></div>
          <div class="small text-lt">${Math.round(rev)}€ au total</div>
        </div>
      </div>
    </div>`;
  }).join("");
  box.innerHTML = rows + `<div class="flex-between" style="padding:8px 4px;"><b>Total tous sites</b><span><b>${Math.round(gm)}€</b> ce mois · ${Math.round(gt)}€ au total</span></div>`;
  box.querySelectorAll("[data-site-pick]").forEach(el => el.addEventListener("click", () => {
    const s = el.dataset.sitePick;
    siteFilter = (siteFilter !== null && siteFilter.toLowerCase() === s.toLowerCase()) ? null : s;
    renderSitesSummary(); renderAccounts();
  }));
  const info = document.getElementById("siteFilterInfo");
  info.style.display = siteFilter === null ? "none" : "";
  info.textContent = siteFilter === null ? "" : `Comptes affichés ci-dessous : ${siteLabel(siteFilter)} (touche à nouveau le site pour tout afficher)`;
}

function renderAccounts() {
  const list = document.getElementById("usersList");
  const q = (document.getElementById("searchInput").value || "").trim().toLowerCase();
  const sort = document.getElementById("sortSelect").value;

  let rows = accounts
    .filter(r => siteFilter === null || accountSites(r).some(x => x.toLowerCase() === siteFilter.toLowerCase()))
    .map(r => ({ row: r, stats: (IS_OWNER && siteFilter) ? statsForAccount(r, siteFilter) : statsForAccount(r) }));
  if (q) rows = rows.filter(({ row }) => ((row.name || "") + " " + (row.email || "")).toLowerCase().includes(q));

  const dateVal = iso => (iso ? new Date(iso).getTime() : 0);
  rows.sort((a, b) => {
    if (sort === "signup") return dateVal(b.row.signed_up_at) - dateVal(a.row.signed_up_at);
    if (sort === "fiches") return b.stats.ownerCount - a.stats.ownerCount;
    if (sort === "ca") return b.stats.revenue - a.stats.revenue;
    return dateVal(b.row.last_sign_in_at) - dateVal(a.row.last_sign_in_at);
  });

  if (rows.length === 0) {
    list.innerHTML = `<div class="empty-state">${accounts.length === 0
      ? "Aucun compte visible.<br><small>" + (window.__adminError ? "Erreur : " + escapeHtml(window.__adminError) : "Aucun compte dans la base.") + "</small>"
      : "Aucun résultat"}</div>`;
    return;
  }

  list.innerHTML = rows.map(({ row, stats }, idx) => {
    const displayName = row.name || row.email || row.user_id;
    const notStarted = stats.ownerCount === 0;
    if (!IS_OWNER) {
      return `
      <div class="card">
        <div class="card-title">${escapeHtml(displayName)}
          ${notStarted ? `<span style="background:#F9E3D5; color:#B5532F; font-size:11px; padding:2px 8px; border-radius:10px; margin-left:4px;">${ic("sparkles")} N'a pas démarré</span>` : ""}
        </div>
        <div class="card-sub">${escapeHtml(row.email || "")} ${siteChips(row)}</div>
        <div class="card-sub">${ic("clock")} Dernière connexion : <b>${relTime(row.last_sign_in_at)}</b></div>
        <div class="card-sub">${ic("calendar")} Inscrit(e) le ${shortDate(row.signed_up_at)} (${relTime(row.signed_up_at)})</div>
      </div>`;
    }
    const accBugs = bugs.filter(b => b.user_email && row.email && b.user_email.toLowerCase() === row.email.toLowerCase());
    return `
      <div class="card">
        <div class="card-row">
          <div style="min-width:0;">
            <div class="card-title">${escapeHtml(displayName)}
              ${notStarted ? `<span style="background:#F9E3D5; color:#B5532F; font-size:11px; padding:2px 8px; border-radius:10px; margin-left:4px;">${ic("sparkles")} N'a pas démarré</span>` : ""}
              ${accBugs.length ? `<span style="background:#fde2e2; color:#b33; font-size:11px; padding:2px 8px; border-radius:10px; margin-left:4px;">${ic("bug")} ${accBugs.length}</span>` : ""}
            </div>
            <div class="card-sub">${escapeHtml(row.email || "")} ${siteChips(row)}</div>
            <div class="card-sub">${ic("clock")} Dernière connexion : <b>${relTime(row.last_sign_in_at)}</b></div>
            <div class="card-sub">${ic("calendar")} Inscrit(e) le ${shortDate(row.signed_up_at)} (${relTime(row.signed_up_at)})</div>
            <div class="card-sub">${stats.ownerCount} fiche${stats.ownerCount > 1 ? "s" : ""} · ${stats.animalCount} ${stats.animalCount > 1 ? "animaux" : "animal"} · ${stats.prestationCount} prestation${stats.prestationCount > 1 ? "s" : ""}</div>
            <div class="card-sub">${ic("euro")} ${Math.round(stats.revenueMonth)}€ ce mois · ${Math.round(stats.revenue)}€ depuis le début</div>
          </div>
          <button class="btn btn-sm btn-secondary" data-toggle-detail="${idx}">Voir</button>
        </div>
        <div id="detail-${idx}" style="display:none; margin-top:10px;">
          <div class="divider"></div>
          <div class="small" style="font-weight:bold; margin-bottom:4px;">${ic("list")} Fiches</div>
          ${stats.fiches.length === 0 ? `<div class="small text-lt">Aucune fiche</div>` : stats.fiches.map(f => `
            <div style="padding:4px 0;">
              <div class="flex-between small"><span>${ic("user")} ${escapeHtml(f.name)} · ${f.animalCount} ${f.animalCount > 1 ? "animaux" : "animal"}</span><span>${Math.round(f.revenue)}€</span></div>
              ${f.prestas.map(p => `<div class="small text-lt" style="padding-left:18px;">${isoDayFR(p.start)} → ${isoDayFR(p.end)} · ${Math.round(p.total * 100) / 100}€</div>`).join("")}
            </div>`).join("")}
          <div class="small" style="font-weight:bold; margin:10px 0 4px;">${ic("gear")} Config des tarifs (MCER)</div>
          <div class="small text-lt">${mcerSummary(row)}</div>
          <div class="small" style="font-weight:bold; margin:10px 0 4px;">${ic("key")} Remises de clés en attente</div>
          ${stats.keysPending.length === 0 ? `<div class="small text-lt">Aucune</div>` : stats.keysPending.map(k => `<div class="small text-lt">${escapeHtml(k.owner)} · garde finie le ${isoDayFR(k.end)}</div>`).join("")}
          <div class="small" style="font-weight:bold; margin:10px 0 4px;">${ic("bug")} Erreurs / signalements de ce compte</div>
          ${accBugs.length === 0 ? `<div class="small text-lt">Aucun</div>` : accBugs.slice(0, 5).map(b => `<div class="small text-lt">${new Date(b.created_at).toLocaleDateString("fr-FR")} · ${escapeHtml(b.page || "")} · ${escapeHtml((b.message || "").slice(0, 90))}</div>`).join("")}
        </div>
      </div>`;
  }).join("");

  list.querySelectorAll("[data-toggle-detail]").forEach(btn => {
    btn.addEventListener("click", () => {
      const panel = document.getElementById(`detail-${btn.dataset.toggleDetail}`);
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    });
  });
}

function renderTotals() {
  let fiches = 0, rev = 0, revMonth = 0;
  accounts.forEach(r => { const s = statsForAccount(r); fiches += s.ownerCount; rev += s.revenue; revMonth += s.revenueMonth; });
  document.getElementById("statUsers").textContent = accounts.length;
  document.getElementById("statFichesTotal").textContent = fiches;
  document.getElementById("statRevenueMonth").textContent = `${Math.round(revMonth)}€`;
  document.getElementById("statRevenueTotal").textContent = `${Math.round(rev)}€`;
  document.getElementById("statEmptyAccounts").textContent = accounts.filter(r => statsForAccount(r).ownerCount === 0).length;
}

const KIND = { auto: `${ic("alert")} Erreur auto`, manuel: `${ic("chat")} Signalement`, diagnostic: `${ic("wrench")} Diagnostic` };
const SEV = { bloquant: `${ic("dot")} Bloquant`, genant: `${ic("dot-half")} Gênant`, detail: `${ic("dot-empty")} Détail` };

function renderBugs() {
  const box = document.getElementById("bugsList");
  const unread = bugs.filter(b => !b.is_read).length;
  const blocking = bugs.filter(b => !b.is_read && b.severity === "bloquant").length;

  document.getElementById("bugBadge").innerHTML = unread
    ? `<span style="background:#d33; color:#fff; font-size:12px; padding:2px 8px; border-radius:10px;">${unread}</span>` : "";

  const banner = document.getElementById("alertBanner");
  if (unread) {
    banner.style.display = "block";
    banner.innerHTML = `<div class="card" style="border-color:#d33;">${ic("bell")} <b>${unread} nouveau${unread > 1 ? "x" : ""} signalement${unread > 1 ? "s" : ""}</b>${blocking ? ` dont <b>${blocking} bloquant${blocking > 1 ? "s" : ""}</b>` : ""} — voir « Erreurs &amp; signalements » plus bas.</div>`;
  } else banner.style.display = "none";

  if (bugs.length === 0) {
    box.innerHTML = `<div class="empty-state">${window.__bugError ? "Erreur : " + escapeHtml(window.__bugError) : `Aucune erreur ni signalement ${ic("sparkles")}`}</div>`;
    return;
  }
  box.innerHTML = bugs.map(b => `
    <div class="card" style="${b.is_read ? "" : "border-color:#d33;"}">
      <div class="card-row">
        <div style="min-width:0;">
          <div class="card-title">${KIND[b.kind] || escapeHtml(b.kind)} ${b.severity ? "· " + SEV[b.severity] : ""} ${b.is_read ? "" : ic("sparkles")}</div>
          <div class="card-sub">${escapeHtml(b.page || "")} · ${new Date(b.created_at).toLocaleString("fr-FR")} · ${escapeHtml(b.user_email || "non connecté")}</div>
        </div>
        <button class="btn btn-sm btn-ghost" data-del-bug="${b.id}">${ic("check")} Réglé</button>
      </div>
      ${b.message ? `<div style="margin-top:6px;">${escapeHtml(b.message)}</div>` : ""}
      ${b.what_done ? `<div class="small" style="margin-top:4px;"><b>Il/elle faisait :</b> ${escapeHtml(b.what_done)}</div>` : ""}
      ${b.what_expected ? `<div class="small"><b>Attendu / constaté :</b> ${escapeHtml(b.what_expected)}</div>` : ""}
      ${b.screenshot_url ? `<a href="${escapeHtml(b.screenshot_url)}" target="_blank" rel="noopener"><img src="${escapeHtml(b.screenshot_url)}" alt="capture" style="max-width:100%; max-height:180px; border-radius:8px; margin-top:6px;"></a>` : ""}
      ${b.details ? `<pre class="small" style="white-space:pre-wrap; overflow:auto; max-height:120px; margin-top:6px;">${escapeHtml(b.details)}</pre>` : ""}
      <div class="small text-lt" style="margin-top:4px;">${escapeHtml(b.app_version || "")} · ${escapeHtml((b.user_agent || "").slice(0, 90))}</div>
    </div>`).join("");

  box.querySelectorAll("[data-del-bug]").forEach(btn => btn.addEventListener("click", async () => {
    await window.deleteBugReport(Number(btn.dataset.delBug));
    await loadAll();
  }));
}

async function loadAll() {
  document.getElementById("usersList").innerHTML = `<div class="empty-state">Chargement…</div>`;
  [accounts, bugs] = await Promise.all([
    window.getAllAccountsFromSupabase(),
    IS_OWNER ? window.getBugReportsFromSupabase() : Promise.resolve([])
  ]);
  if (IS_OWNER) { await renderAdmins(); await renderSiteManage(); }
  renderSitesSummary();
  // Recherche / tri : affichés seulement à partir de 15 comptes
  document.getElementById("searchBar").style.display = accounts.length > 15 ? "block" : "none";
  renderTotals();
  renderAccounts();
  renderBugs();
}

/* ---------- Gestion des admins (propriétaire) ---------- */
async function renderAdmins() {
  const list = await window.listAdmins();
  window.__adminList = list;
  document.getElementById("adminsList").innerHTML = list.map(a => `
    <div class="flex-between small" style="padding:5px 0;">
      <span>${a.role === "owner" ? ic("crown") : ic("shield")} ${escapeHtml(a.email)}${a.site ? ` <span class="site-chip">${escapeHtml(a.site)}</span>` : (a.role === "viewer" ? ` <span class="text-lt">tous les comptes</span>` : "")}</span>
      ${a.role === "owner" ? `<span class="text-lt">propriétaire</span>` : `<button class="btn btn-sm btn-ghost" data-rm-admin="${escapeHtml(a.email)}">Retirer</button>`}
    </div>`).join("");
  document.querySelectorAll("[data-rm-admin]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm(`Retirer l'accès admin de ${b.dataset.rmAdmin} ?`)) return;
    await window.removeAdmin(b.dataset.rmAdmin);
    renderAdmins();
  }));
}
function adminMsg(t, ok) {
  const m = document.getElementById("adminsMsg");
  m.style.display = "block"; m.style.color = ok ? "var(--green, #5a9a6a)" : "var(--red)"; m.textContent = t;
}
document.getElementById("addAdminBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("newAdminEmail").value.trim();
  if (!email) return adminMsg("Écris un email.", false);
  const site = document.getElementById("newAdminSite").value.trim();
  const err = await window.addAdmin(email, site);
  if (err) return adminMsg(err, false);
  document.getElementById("newAdminEmail").value = "";
  document.getElementById("newAdminSite").value = "";
  adminMsg("Accès admin donné. La personne verra le bouton cadenas sur son accueil, avec le même code.", true);
  renderAdmins();
});

/* ---------- Gérer les sites : fusion des doublons (propriétaire) ---------- */
async function renderSiteManage() {
  const sites = await window.adminListSites();
  document.getElementById("adminSiteList").innerHTML = sites.map(s => `<option value="${escapeHtml(s.name)}"></option>`).join("");
  const box = document.getElementById("siteManageList");
  if (sites.length === 0) { box.innerHTML = `<div class="small text-lt">Aucun site pour l'instant.</div>`; return; }
  box.innerHTML = sites.map(s => `
    <div class="flex-between small" style="padding:6px 0; gap:8px;">
      <span>${escapeHtml(s.name)} <span class="text-lt">· ${s.accounts} compte${s.accounts > 1 ? "s" : ""}</span></span>
      <button class="btn btn-sm btn-ghost" data-merge-site="${escapeHtml(s.name)}">Fusionner / renommer</button>
    </div>`).join("");
  box.querySelectorAll("[data-merge-site]").forEach(b => b.addEventListener("click", async () => {
    const from = b.dataset.mergeSite;
    const to = prompt(`Nouveau nom pour « ${from} » (ou nom d'un site existant pour les fusionner) :`, from);
    if (!to || !to.trim() || to.trim() === from) return;
    const err = await window.adminMergeSites(from, to.trim());
    if (err) { alert("Impossible : " + err); return; }
    siteFilter = null;
    await loadAll();
  }));
}

document.getElementById("searchInput").addEventListener("input", renderAccounts);
document.getElementById("sortSelect").addEventListener("change", renderAccounts);
document.getElementById("markReadBtn")?.addEventListener("click", async () => {
  await window.markBugsRead();
  await loadAll();
});

await loadAll();
