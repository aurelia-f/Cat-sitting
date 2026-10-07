// reset-password.js
// Page atteinte via le lien envoyé par email (Supabase Auth "password recovery").

import { supabase } from "./supabase-config.js";
import { updatePassword, traduireErreurAuth } from "./auth.js";

let recoveryReady = false;

supabase.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") {
    recoveryReady = true;
  }
});

// Filet de sécurité si l'événement a été émis avant l'ajout du listener ci-dessus
supabase.auth.getSession().then(({ data }) => {
  if (data.session) recoveryReady = true;
});

document.getElementById("confirmReset").addEventListener("click", async () => {
  const pw = document.getElementById("newPasswordInput").value;
  const errorEl = document.getElementById("resetError");
  errorEl.style.display = "none";

  if (!pw || pw.length < 6) {
    errorEl.textContent = "Le mot de passe doit faire au moins 6 caractères.";
    errorEl.style.display = "block";
    return;
  }

  try {
    await updatePassword(pw);
    alert("Mot de passe mis à jour ! Tu peux te reconnecter.");
    goTo("index.html");
  } catch (err) {
    errorEl.textContent = traduireErreurAuth(err.message);
    errorEl.style.display = "block";
  }
});

document.getElementById("backToLoginBtn").addEventListener("click", () => goTo("index.html"));

// Si aucune session de récupération n'est détectée après quelques secondes,
// c'est que le lien est expiré ou déjà utilisé.
setTimeout(() => {
  if (!recoveryReady) {
    document.getElementById("viewForm").style.display = "none";
    document.getElementById("viewInvalid").style.display = "block";
  }
}, 2500);
