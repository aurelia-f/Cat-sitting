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
    const payload = {
      user_id: user.id,
      name: (user.user_metadata && user.user_metadata.name) || user.email,
      email: user.email,
      profiles: JSON.parse(localStorage.getItem(keys.profiles) || "{}"),
      calevents: JSON.parse(localStorage.getItem(keys.calevents) || "{}"),
      tarifs: JSON.parse(localStorage.getItem(keys.tarifs) || "{}"),
      animalcolors: JSON.parse(localStorage.getItem(keys.animalcolors) || "{}"),
      prefs: JSON.parse(localStorage.getItem(keys.prefs) || "{}"),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("cat_sitting_data").upsert(payload);
    if (error) {
      console.error("Erreur de synchronisation Supabase :", error.message);
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

  return user;
};

// Utilisée par la page admin pour lister tous les comptes (nécessite d'être
// soi-même connecté, sinon Supabase refuse la lecture).
window.getAllAccountsFromSupabase = async function () {
  const { data, error } = await supabase.from("cat_sitting_data").select("*");
  if (error) {
    console.error("Erreur de chargement des comptes :", error.message);
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
