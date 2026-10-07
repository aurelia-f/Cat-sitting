// auth.js
// Fonctions d'authentification à utiliser depuis login.js / accueil.js etc.

import { supabase } from "./supabase-config.js";

// Crée un nouveau compte (inscription). Le prénom est stocké dans les métadonnées utilisateur.
export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } }
  });
  if (error) throw error;
  return data;
}

// Connecte un compte existant
export async function logIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Déconnecte l'utilisateur actuel
export async function logOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Retourne l'utilisateur actuellement connecté (ou null)
export async function getSupabaseUser() {
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

// Demande un email de réinitialisation de mot de passe
export async function resetPasswordForEmail(email, redirectTo) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

// Définit un nouveau mot de passe (à utiliser sur la page où Supabase redirige
// après un clic sur le lien de réinitialisation reçu par email)
export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

// Traduit les messages d'erreur Supabase en messages compréhensibles
export function traduireErreurAuth(message) {
  if (!message) return "Une erreur est survenue. Réessaie.";
  if (message.includes("already registered") || message.includes("already exists")) {
    return "Un compte existe déjà avec cet email.";
  }
  if (message.includes("Invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (message.includes("Password should be at least") || message.includes("password")) {
    return "Le mot de passe doit faire au moins 6 caractères.";
  }
  if (message.includes("Unable to validate email") || message.includes("invalid") || message.includes("Invalid email")) {
    return "Adresse email invalide.";
  }
  if (message.includes("rate limit") || message.includes("Too many")) {
    return "Trop de tentatives. Réessaie dans quelques minutes.";
  }
  return "Une erreur est survenue. Réessaie.";
}
