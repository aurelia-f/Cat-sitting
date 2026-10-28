// cloudsync.js
// Pont entre le stockage local (rapide, synchrone) et Supabase (sauvegarde en ligne).
// Le reste de l'app continue à lire/écrire dans localStorage comme avant (via storage.js) ;
// ce fichier hydrate ce cache local depuis Supabase au chargement, et pousse les
// changements vers Supabase en arrière-plan.
//
// Règle de sécurité : tant qu'un changement local n'a pas fini d'être envoyé vers
// Supabase, on ne l'écrase JAMAIS avec les données du serveur (qui seraient alors
// plus vieilles). C'est ce qui évite qu'une navigation vers une autre page n'efface
// une modification qui n'avait pas encore eu le temps de partir.

import { supabase } from "./supabase-config.js";

let syncTimer = null;
let pushInFlight = null;

function localKeys(userId) {
  return {
    profiles: `cs-${userId}-profiles`,
    calevents: `cs-${userId}-calevents`,
    tarifs: `cs-${userId}-tarifs`,
    animalcolors: `cs-${userId}-animalcolors`,
    prefs: `cs-${userId}-prefs`
  };
}

function dirtyKey(userId) {
  return `cs-${userId}-dirty`;
}

async function pushToSupabase() {
  // Si un envoi est déjà en cours, on attend simplement qu'il termine plutôt
  // que d'en démarrer un deuxième en parallèle.
  if (pushInFlight) return pushInFlight;

  pushInFlight = (async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session ? sessionData.session.user : null;
    if (!user) return;

    const keys = localKeys(user.id);
    const prefsNow = JSON.parse(localStorage.getItem(keys.prefs) || "{}");
    const payload = {
      user_id: user.id,
      name: (user.user_metadata && user.user_metadata.name) || user.email,
      email: user.email,
      profiles: JSON.parse(localStorage.getItem(keys.profiles) || "{}"),
      calevents: JSON.parse(localStorage.getItem(keys.calevents) || "{}"),
      tarifs: JSON.parse(localStorage.getItem(keys.tarifs) || "{}"),
      animalcolors: JSON.parse(localStorage.getItem(keys.animalcolors) || "{}"),
      prefs: prefsNow,
      sites: Array.isArray(prefsNow.my_sites) ? prefsNow.my_sites : [],
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("cat_sitting_data").upsert(payload);
    if (error) {
      console.error("Erreur de synchronisation Supabase :", error.message);
      if (window.autoReportError) window.autoReportError("Synchro Supabase : " + error.message, "");
      // On laisse le drapeau "dirty" en place : on retentera au prochain hydrate.
    } else {
      localStorage.setItem(dirtyKey(user.id), "0");
    }
  })();

  try {
    await pushInFlight;
  } finally {
    pushInFlight = null;
  }
}

// Appelée par storage.js à chaque sauvegarde locale. Marque immédiatement les
// données comme "non envoyées" (pour protéger contre l'écrasement), puis
// programme l'envoi réel avec un petit débounce pour éviter de spammer
// Supabase si plusieurs sauvegardes arrivent d'affilée.
window.queueCloudSync = function () {
  const uid = getCurrentUser();
  if (uid) localStorage.setItem(dirtyKey(uid), "1");
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushToSupabase, 800);
};

// Envoie immédiatement (sans débounce) et attend la fin de l'envoi.
// À utiliser juste avant de quitter une page si on veut être sûr à 100%
// que la dernière modification est bien partie.
window.flushCloudSync = async function () {
  clearTimeout(syncTimer);
  await pushToSupabase();
};

// À appeler au tout début de chaque page protégée, avant tout rendu.
// Vérifie la session Supabase. S'il y a des changements locaux pas encore
// envoyés (drapeau "dirty"), on les envoie d'abord et on NE LES ÉCRASE PAS.
// Sinon, on recopie les données du serveur dans le cache local.
window.hydrateFromSupabase = async function () {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session ? sessionData.session.user : null;
  if (!user) return null;

  const name = (user.user_metadata && user.user_metadata.name) || user.email;
  setCurrentUser(user.id, name);

  const isDirty = localStorage.getItem(dirtyKey(user.id)) === "1";
  if (isDirty) {
    // Des changements locaux n'ont pas encore été envoyés : on les envoie
    // maintenant et on garde les données locales telles quelles.
    await pushToSupabase();
    return user;
  }

  const { data, error } = await supabase
    .from("cat_sitting_data")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const keys = localKeys(user.id);

  if (error) {
    console.error("Erreur de chargement Supabase :", error.message);
    if (window.autoReportError) window.autoReportError("Chargement Supabase : " + error.message, "");
  } else if (data) {
    localStorage.setItem(keys.profiles, JSON.stringify(data.profiles || {}));
    localStorage.setItem(keys.calevents, JSON.stringify(data.calevents || {}));
    localStorage.setItem(keys.tarifs, JSON.stringify(data.tarifs || {}));
    localStorage.setItem(keys.animalcolors, JSON.stringify(data.animalcolors || {}));
    localStorage.setItem(keys.prefs, JSON.stringify(data.prefs || {}));
  } else {
    // Première connexion pour ce compte : on crée sa ligne dans Supabase
    await supabase.from("cat_sitting_data").insert({
      user_id: user.id,
      name,
      email: user.email
    });
  }

  // Site choisi à l'inscription (stocké dans les infos du compte) : on le range dans les préférences
  try {
    const meta = user.user_metadata || {};
    const metaSites = Array.isArray(meta.sites) ? meta.sites : (meta.site ? [meta.site] : []);
    const prefsNow = JSON.parse(localStorage.getItem(keys.prefs) || "{}");
    if (metaSites.length && !(Array.isArray(prefsNow.my_sites) && prefsNow.my_sites.length)) {
      const official = [];
      for (const s of metaSites) {
        const o = (await window.registerSite(s)) || s;
        if (!official.some(x => x.toLowerCase() === o.toLowerCase())) official.push(o);
      }
      prefsNow.my_sites = official;
      localStorage.setItem(keys.prefs, JSON.stringify(prefsNow));
      localStorage.setItem(dirtyKey(user.id), "1");
      await pushToSupabase();
    }
  } catch (e) { /* le site pourra être choisi plus tard depuis l'accueil */ }

  return user;
};

// Utilisée par la page admin pour lister tous les comptes (nécessite d'être
// soi-même connecté, sinon Supabase refuse la lecture).
window.getAllAccountsFromSupabase = async function () {
  // Pas besoin d'être connecté : c'est Supabase qui vérifie le code admin.
  const code = sessionStorage.getItem("cs-admin-code") || "";
  const { data, error } = await supabase.rpc("admin_list_accounts", { admin_code: code });
  if (error) {
    console.error("Erreur de chargement des comptes :", error.message);
    window.__adminError = error.message;
    return [];
  }
  return data || [];
};

// Déconnexion réelle (ferme la session Supabase en plus du nettoyage local).
// On s'assure d'abord que tout changement en attente est bien envoyé.
window.logOutSupabase = async function () {
  await window.flushCloudSync();
  await supabase.auth.signOut();
  logoutCurrentUser();
};


/* ---------- Rapports de bugs / erreurs ---------- */
const appVersion = () => "v" + (self.APP_VERSION || "?");
let autoBugCount = 0;
const seenBugs = new Set();

// opts : { message, kind, severity, page, what_done, what_expected, screenshot_url, details }
window.reportBug = async function (opts) {
  try {
    const { data: s } = await supabase.auth.getSession();
    const email = s.session ? s.session.user.email : null;
    const cut = (v, n) => (v == null ? null : String(v).slice(0, n));
    const { error } = await supabase.from("bug_reports").insert({
      kind: opts.kind || "manuel",
      severity: opts.severity || null,
      message: cut(opts.message, 1500),
      page: opts.page || location.pathname.split("/").pop() || "index.html",
      what_done: cut(opts.what_done, 1500),
      what_expected: cut(opts.what_expected, 1500),
      screenshot_url: opts.screenshot_url || null,
      details: cut(opts.details, 3500),
      user_email: email,
      user_agent: navigator.userAgent,
      app_version: appVersion()
    });
    return !error;
  } catch (e) {
    return false;
  }
};

// Capture automatique (max 5 par visite, sans doublons)
function autoReport(msg, details) {
  const key = msg + "|" + location.pathname;
  if (autoBugCount >= 5 || seenBugs.has(key)) return;
  seenBugs.add(key);
  autoBugCount++;
  window.reportBug({ message: msg, kind: "auto", details });
}
window.autoReportError = autoReport;

window.addEventListener("error", (e) => {
  if (!e.message) return;
  autoReport(e.message, `${e.filename}:${e.lineno}:${e.colno}\n${e.error && e.error.stack ? e.error.stack : ""}`);
});
window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason;
  autoReport("Promesse rejetée : " + (r && r.message ? r.message : String(r)), r && r.stack ? r.stack : "");
});

// Liste / actions pour l'admin
window.getBugReportsFromSupabase = async function () {
  const code = sessionStorage.getItem("cs-admin-code") || "";
  const { data, error } = await supabase.rpc("admin_list_bugs", { admin_code: code });
  if (error) { console.error("Erreur bugs :", error.message); window.__bugError = error.message; return []; }
  return data || [];
};
window.deleteBugReport = async function (id) {
  const code = sessionStorage.getItem("cs-admin-code") || "";
  await supabase.rpc("admin_delete_bug", { admin_code: code, bug_id: id });
};
window.markBugsRead = async function () {
  const code = sessionStorage.getItem("cs-admin-code") || "";
  await supabase.rpc("admin_mark_bugs_read", { admin_code: code });
};

// Envoi d'une capture d'écran (déjà réduite) ; renvoie l'URL publique ou null
window.uploadBugScreenshot = async function (blob) {
  try {
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
    const { error } = await supabase.storage.from("bug-screenshots").upload(name, blob, { contentType: "image/jpeg" });
    if (error) return null;
    return supabase.storage.from("bug-screenshots").getPublicUrl(name).data.publicUrl;
  } catch (e) { return null; }
};

// Pour la page Diagnostic
window.__supabaseClient = supabase;

/* ---------- Accès admin (compte autorisé + code) ---------- */
window.getMyAdminRole = async function () {
  const info = await window.getMyAdminInfo();
  return info ? info.role : null;       // "owner", "viewer", "site" ou null
};
window.getMyAdminInfo = async function () {
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return null;
  const { data, error } = await supabase.rpc("my_admin_info");
  if (!error && data) return data;       // { role, site }
  if (error) console.warn("my_admin_info :", error.message);
  // Repli : ancienne fonction (au cas où le SQL multi-sites n'est pas passé)
  const old = await supabase.rpc("my_admin_role");
  return old.error || !old.data ? null : { role: old.data, site: null };
};

/* ---------- Sites (multi-sites) ---------- */
// Liste des sites déjà connus (suggestions à l'inscription) : accessible sans être connecté
window.listSites = async function () {
  try {
    const { data, error } = await supabase.rpc("list_sites");
    return error ? [] : (data || []);
  } catch (e) { return []; }
};
// Ajoute un site à la liste commune (renvoie le nom officiel sans doublon)
window.registerSite = async function (name) {
  const { data, error } = await supabase.rpc("register_site", { site_name: name });
  return error ? null : data;
};
window.adminListSites = async function () {
  const code = sessionStorage.getItem("cs-admin-code") || "";
  const { data, error } = await supabase.rpc("admin_list_sites", { admin_code: code });
  return error ? [] : (data || []);
};
window.adminMergeSites = async function (from, to) {
  const code = sessionStorage.getItem("cs-admin-code") || "";
  const { error } = await supabase.rpc("admin_merge_sites", { admin_code: code, from_name: from, to_name: to });
  return error ? error.message : null;
};
window.checkAdminCode = async function (code) {
  const { error } = await supabase.rpc("admin_list_accounts", { admin_code: code });
  return error ? error.message : null;  // null = code accepté
};
window.listAdmins = async function () {
  const code = sessionStorage.getItem("cs-admin-code") || "";
  const { data, error } = await supabase.rpc("admin_list_admins", { admin_code: code });
  return error ? [] : (data || []);
};
window.addAdmin = async function (email, site) {
  const code = sessionStorage.getItem("cs-admin-code") || "";
  const { error } = await supabase.rpc("admin_add_admin", { admin_code: code, target_email: email, target_site: site || null });
  return error ? error.message : null;
};
window.removeAdmin = async function (email) {
  const code = sessionStorage.getItem("cs-admin-code") || "";
  const { error } = await supabase.rpc("admin_remove_admin", { admin_code: code, target_email: email });
  return error ? error.message : null;
};

/* ---------- Notifications push (rappels) ---------- */
const VAPID_PUBLIC_KEY = "BNdBl0MDrAAY5toQjmLny3xespbRlzDIlA8yUx051WmwVw6j7Y3g5MsgLqiKLgeewSTh7JQFNoN80ChEwE8pqX0";

function b64ToUint8(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// "unsupported" | "denied" | "on" | "off"
window.pushStatus = async function () {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub && Notification.permission === "granted" ? "on" : "off";
};

window.enablePush = async function () {
  try {
    if ((await window.pushStatus()) === "unsupported") return "Ce navigateur ne gère pas les notifications. Sur iPhone : ajoute d'abord l'app à l'écran d'accueil.";
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return "Notifications refusées : autorise-les dans les réglages du navigateur.";
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID_PUBLIC_KEY) });
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return "Connecte-toi d'abord.";
    const json = sub.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert({
      endpoint: json.endpoint, user_id: s.session.user.id, sub: json
    });
    return error ? "Enregistrement impossible : " + error.message : null;
  } catch (e) {
    return "Erreur : " + (e && e.message ? e.message : e);
  }
};

window.disablePush = async function () {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch (e) { /* rien */ }
};
