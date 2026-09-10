/* ============================================
   CAT SITTING — login.js
   Connexion réelle par email + mot de passe (Firebase Auth)
   ============================================ */

import { logIn, signUp, traduireErreurAuth } from "./auth.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

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
    const cred = await logIn(email, password);
    const name = cred.user.displayName || email;
    setCurrentUser(cred.user.uid, name);
    goTo("accueil.html");
  } catch (err) {
    errorEl.textContent = traduireErreurAuth(err.code);
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

  if (!name || !email || !password) {
    errorEl.textContent = "Merci de remplir tous les champs.";
    errorEl.style.display = "block";
    return;
  }

  try {
    const cred = await signUp(email, password);
    await updateProfile(cred.user, { displayName: name });
    setCurrentUser(cred.user.uid, name);
    goTo("accueil.html");
  } catch (err) {
    errorEl.textContent = traduireErreurAuth(err.code);
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
