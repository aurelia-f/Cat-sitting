/* ============================================
   CAT SITTING — login.js
   Connexion réelle par email + mot de passe (Supabase Auth)
   ============================================ */

import { logIn, signUp, resetPasswordForEmail, traduireErreurAuth } from "./auth.js";

function openModal(id) {
  document.getElementById(id).classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});

/* ---------- Toggle connexion / inscription ---------- */
function showLogin() {
  document.getElementById("viewLogin").style.display = "block";
  document.getElementById("viewSignup").style.display = "none";
}
function showSignup() {
  document.getElementById("viewLogin").style.display = "none";
  document.getElementById("viewSignup").style.display = "block";
}
document.getElementById("goToSignup").addEventListener("click", (e) => {
  e.preventDefault();
  showSignup();
});
document.getElementById("goToLogin").addEventListener("click", (e) => {
  e.preventDefault();
  showLogin();
});

/* ---------- Connexion ---------- */
document.getElementById("confirmLogin").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errorEl = document.getElementById("loginError");
  errorEl.style.display = "none";

  if (!email || !password) {
    errorEl.textContent = "Merci de renseigner ton email et ton mot de passe.";
    errorEl.style.display = "block";
    return;
  }

  try {
    const data = await logIn(email, password);
    const name = data.user.user_metadata?.name || email;
    setCurrentUser(data.user.id, name);
    goTo("accueil.html");
  } catch (err) {
    errorEl.textContent = traduireErreurAuth(err.message);
    errorEl.style.display = "block";
  }
});

/* ---------- Inscription ---------- */
document.getElementById("confirmSignup").addEventListener("click", async () => {
  const name = document.getElementById("newName").value.trim();
  const email = document.getElementById("newEmail").value.trim();
  const password = document.getElementById("newPassword").value;
  const errorEl = document.getElementById("signupError");
  errorEl.style.display = "none";
  errorEl.style.color = "var(--red)";

  if (!name || !email || !password) {
    errorEl.textContent = "Merci de remplir tous les champs.";
    errorEl.style.display = "block";
    return;
  }

  try {
    const data = await signUp(email, password, name);

    // Supabase renvoie un tableau "identities" vide quand l'email est déjà
    // utilisé par un compte confirmé (pour éviter de révéler l'info autrement)
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      errorEl.textContent = "Un compte existe déjà avec cet email. Connecte-toi plutôt.";
      errorEl.style.display = "block";
      showLogin();
      document.getElementById("loginEmail").value = email;
      return;
    }

    if (!data.session) {
      // Compte créé mais confirmation par email requise avant de pouvoir se connecter
      errorEl.style.color = "var(--green)";
      errorEl.textContent = "Compte créé ! Vérifie ta boîte mail et clique sur le lien de confirmation avant de te connecter.";
      errorEl.style.display = "block";
      return;
    }

    setCurrentUser(data.user.id, name);
    goTo("accueil.html");
  } catch (err) {
    errorEl.textContent = traduireErreurAuth(err.message);
    errorEl.style.display = "block";
  }
});

/* ---------- Mot de passe oublié ---------- */
document.getElementById("forgotPasswordLink").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("forgotEmail").value = document.getElementById("loginEmail").value.trim();
  document.getElementById("forgotError").style.display = "none";
  openModal("modalForgotPassword");
});

document.getElementById("confirmForgotPassword").addEventListener("click", async () => {
  const email = document.getElementById("forgotEmail").value.trim();
  const errorEl = document.getElementById("forgotError");
  errorEl.style.display = "none";
  errorEl.style.color = "var(--red)";

  if (!email) {
    errorEl.textContent = "Merci de renseigner ton email.";
    errorEl.style.display = "block";
    return;
  }

  try {
    const redirectTo = new URL("reset-password.html", window.location.href).href;
    await resetPasswordForEmail(email, redirectTo);
    errorEl.style.color = "var(--green)";
    errorEl.textContent = "Email envoyé ! Vérifie ta boîte mail (et tes spams) pour le lien de réinitialisation.";
    errorEl.style.display = "block";
  } catch (err) {
    errorEl.textContent = traduireErreurAuth(err.message);
    errorEl.style.display = "block";
  }
});

/* ---------- Accès admin caché (5 appuis sur la patte + code secret) ---------- */
const ADMIN_CODE = "0808";
let pawTapCount = 0;
let pawTapTimer = null;

document.getElementById("pawTrigger").addEventListener("click", () => {
  pawTapCount++;
  clearTimeout(pawTapTimer);
  pawTapTimer = setTimeout(() => { pawTapCount = 0; }, 2500);
  if (pawTapCount >= 5) {
    pawTapCount = 0;
    document.getElementById("adminCodeInput").value = "";
    document.getElementById("adminCodeError").style.display = "none";
    openModal("modalAdminCode");
  }
});

document.getElementById("confirmAdminCode").addEventListener("click", () => {
  const val = document.getElementById("adminCodeInput").value.trim();
  if (val === ADMIN_CODE) {
    sessionStorage.setItem("cs-admin-unlocked", "1");
    closeModal("modalAdminCode");
    goTo("admin.html");
  } else {
    document.getElementById("adminCodeError").style.display = "block";
  }
});
