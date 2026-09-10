// auth.js
// Fonctions d'authentification à utiliser depuis login.js / accueil.js etc.

import { auth } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// Crée un nouveau compte (inscription)
export function signUp(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

// Connecte un compte existant
export function logIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Déconnecte l'utilisateur actuel
export function logOut() {
  return signOut(auth);
}

// Appelle callback(user) à chaque changement d'état de connexion
// user === null si personne n'est connecté
export function watchAuthState(callback) {
  onAuthStateChanged(auth, callback);
}

// Traduit les codes d'erreur Firebase en messages compréhensibles
export function traduireErreurAuth(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "Un compte existe déjà avec cet email.";
    case "auth/invalid-email":
      return "Adresse email invalide.";
    case "auth/weak-password":
      return "Le mot de passe doit faire au moins 6 caractères.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email ou mot de passe incorrect.";
    case "auth/too-many-requests":
      return "Trop de tentatives. Réessaie dans quelques minutes.";
    default:
      return "Une erreur est survenue. Réessaie.";
  }
}
