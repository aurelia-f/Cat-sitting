/* ============================================
   CAT SITTING — diagnostic.js
   Vérifie connexion, synchro et cohérence des données (lecture seule : ne modifie rien).
   ============================================ */

document.getElementById("backBtn").addEventListener("click", () => goTo("aide.html"));

const results = [];
function add(status, label, detail) { results.push({ status, label, detail: detail || "" }); }

async function check(label, fn) {
  try { await fn(); } catch (e) { add("ko", label, e.message || String(e)); }
}

async function runDiagnostic() {
  results.length = 0;
  const sb = window.__supabaseClient;

  add("info", "Version de l'app", `${navigator.userAgent.slice(0, 80)} · ${navigator.onLine ? "en ligne" : "HORS LIGNE"}`);

  // 1. Réseau + base
  await check("Connexion à Supabase", async () => {
    if (!navigator.onLine) return add("ko", "Connexion Internet", "L'appareil est hors ligne");
    const t0 = performance.now();
    const { data, error } = await sb.auth.getSession();
    if (error) return add("ko", "Session de connexion", error.message);
    if (!data.session) return add("ko", "Session de connexion", "Non connecté(e) — reconnecte-toi");
    add("ok", "Session de connexion", data.session.user.email);

    const { data: row, error: e2 } = await sb.from("cat_sitting_data").select("*").eq("user_id", data.session.user.id).maybeSingle();
    const ms = Math.round(performance.now() - t0);
    if (e2) return add("ko", "Lecture de tes données en ligne", e2.message);
    if (!row) return add("ko", "Lecture de tes données en ligne", "Aucune ligne trouvée pour ce compte");
    add("ok", "Lecture de tes données en ligne", `OK (${ms} ms)`);

    // 2. Synchro : local vs serveur
    const uid = data.session.user.id;
    const dirty = localStorage.getItem(`cs-${uid}-dirty`) === "1";
    if (dirty) add("warn", "Synchronisation", "Des modifications n'ont pas encore été envoyées (réessaie dans quelques secondes)");
    else {
      const local = JSON.parse(localStorage.getItem(`cs-${uid}-profiles`) || "{}");
      const same = JSON.stringify(local) === JSON.stringify(row.profiles || {});
      add(same ? "ok" : "warn", "Synchronisation", same ? "Cet appareil et le serveur sont identiques" : "Différence entre cet appareil et le serveur — ouvre l'accueil pour resynchroniser");
    }
  });

  // 3. Cohérence des données locales
  await check("Cohérence des fiches", async () => {
    const profiles = getProfiles();
    const keys = Object.keys(profiles);
    add("ok", "Fiches", `${keys.length} fiche(s)`);
    const problems = [];
    keys.forEach(k => {
      const p = profiles[k];
      const label = p.name || k;
      if (!p.name) problems.push(`Fiche sans nom (${k})`);
      (p.prestations || []).forEach((pr, i) => {
        const where = `${label} · prestation ${i + 1}`;
        if (!pr.date_start || !pr.date_end) problems.push(`${where} : dates manquantes`);
        else if (pr.date_end < pr.date_start) problems.push(`${where} : date de fin avant la date de début`);
        const t = calcPrestation(pr).total;
        if (!isFinite(t)) problems.push(`${where} : prix invalide`);
        else if (t === 0 && !(pr.key_return_type === "0")) problems.push(`${where} : prix à 0 €`);
      });
      if (!p.info || !p.info.address) problems.push(`${label} : adresse manquante (carte/itinéraire impossibles)`);
    });
    if (problems.length === 0) add("ok", "Données des fiches", "Aucune anomalie");
    else add("warn", "Données des fiches", problems.slice(0, 12).join("\n") + (problems.length > 12 ? `\n… et ${problems.length - 12} autres` : ""));
  });

  // 4. Fonctions de l'app chargées
  await check("Composants", async () => {
    const needed = ["queueCloudSync", "flushCloudSync", "hydrateFromSupabase", "reportBug"];
    const missing = needed.filter(n => typeof window[n] !== "function");
    add(missing.length ? "ko" : "ok", "Composants de l'app", missing.length ? "Manquants : " + missing.join(", ") : "Tous chargés");
  });

  // 5. Service worker
  await check("Mode hors-ligne", async () => {
    if (!("serviceWorker" in navigator)) return add("warn", "Service worker", "Non supporté");
    const regs = await navigator.serviceWorker.getRegistrations();
    add(regs.length ? "ok" : "warn", "Service worker", regs.length ? "Actif" : "Non installé");
  });

  render();
}

const ICON = { ok: ic("check-circle"), warn: ic("dot-half"), ko: ic("dot"), info: ic("info") };
function render() {
  const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  document.getElementById("diagResults").innerHTML = results.map(r => `
    <div class="card">
      <div class="card-title">${ICON[r.status]} ${esc(r.label)}</div>
      ${r.detail ? `<div class="card-sub" style="white-space:pre-wrap;">${esc(r.detail)}</div>` : ""}
    </div>`).join("");
  const bad = results.some(r => r.status === "ko" || r.status === "warn");
  document.getElementById("sendDiagBtn").style.display = bad ? "block" : "none";
}

document.getElementById("runDiagBtn").addEventListener("click", async () => {
  const b = document.getElementById("runDiagBtn");
  b.disabled = true; b.textContent = "Diagnostic en cours…";
  await runDiagnostic();
  b.disabled = false; b.innerHTML = ic("refresh") + " Relancer le diagnostic";
});

document.getElementById("sendDiagBtn").addEventListener("click", async () => {
  const txt = results.map(r => `${r.status.toUpperCase()} ${r.label}: ${r.detail}`).join("\n");
  const ok = await window.reportBug({ kind: "diagnostic", severity: "genant", message: "Résultat de diagnostic", details: txt });
  const btn = document.getElementById("sendDiagBtn");
  btn.textContent = ok ? "Envoyé, merci !" : "Envoi impossible";
  btn.disabled = true;
});
