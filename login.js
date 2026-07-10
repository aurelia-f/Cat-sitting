/* ============================================
   CAT SITTING — login.js
   Connexion : prénom + date de naissance (mot de passe)
   ============================================ */

const USERS_KEY = "cs-users-v2";
let pendingLoginKey = null;

function getUsers() {
  return Storage.get(USERS_KEY) || [];
}
function saveUsers(users) {
  Storage.set(USERS_KEY, users);
}

function openModal(id) {
  document.getElementById(id).classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});

function renderProfileList() {
  const users = getUsers();
  const list = document.getElementById("profileList");
  const empty = document.getElementById("emptyState");
  list.innerHTML = "";

  if (users.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  users.forEach(u => {
    const item = document.createElement("div");
    item.className = "profile-list-item";
    item.innerHTML = `
      <div class="avatar">${(u.name || "?").charAt(0).toUpperCase()}</div>
      <div style="flex:1;">
        <div class="card-title" style="font-size:15px;">${escapeHtml(u.name)}</div>
        <div class="card-sub">Toucher pour se connecter</div>
      </div>
      <div class="icon-action" data-delete-key="${u.key}" title="Supprimer">🗑</div>
      <div style="font-size:18px; color: var(--text-lt);">›</div>
    `;
    item.querySelector("[data-delete-key]").addEventListener("click", (e) => {
      e.stopPropagation();
      openDeleteCodeModal(u.key, u.name);
    });
    item.addEventListener("click", () => {
      pendingLoginKey = u.key;
      document.getElementById("loginTitle").textContent = `Connexion — ${u.name}`;
      document.getElementById("loginDob").value = "";
      document.getElementById("loginError").style.display = "none";
      openModal("modalLogin");
    });
    list.appendChild(item);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

document.getElementById("createProfileBtn").addEventListener("click", () => {
  document.getElementById("newName").value = "";
  document.getElementById("newDob").value = "";
  openModal("modalCreate");
});

document.getElementById("confirmCreate").addEventListener("click", () => {
  const name = document.getElementById("newName").value.trim();
  const dob = document.getElementById("newDob").value;
  if (!name) {
    alert("Merci de renseigner un prénom.");
    return;
  }
  if (!dob) {
    alert("Merci de renseigner une date de naissance.");
    return;
  }
  const users = getUsers();
  if (users.some(u => u.name.toLowerCase() === name.toLowerCase())) {
    alert("Ce prénom est déjà utilisé. Choisissez-en un autre ou connectez-vous.");
    return;
  }
  const key = techKey(name);
  const dobHash = simpleHash(dob);
  users.push({ name, key, dobHash });
  saveUsers(users);
  setCurrentUser(key, name);
  closeModal("modalCreate");
  goTo("accueil.html");
});

document.getElementById("confirmLogin").addEventListener("click", () => {
  const dob = document.getElementById("loginDob").value;
  if (!dob || !pendingLoginKey) return;
  const users = getUsers();
  const u = users.find(u => u.key === pendingLoginKey);
  if (!u) return;
  if (simpleHash(dob) === u.dobHash) {
    setCurrentUser(u.key, u.name);
    closeModal("modalLogin");
    goTo("accueil.html");
  } else {
    document.getElementById("loginError").style.display = "block";
  }
});

/* ---------- Suppression externe par code (0808) ---------- */
const DELETE_MASTER_CODE = "0808";
let pendingDeleteKey = null;

function openDeleteCodeModal(key, name) {
  pendingDeleteKey = key;
  document.getElementById("deleteCodeTitle").textContent = `Supprimer le compte de ${name}`;
  document.getElementById("deleteCodeInput").value = "";
  document.getElementById("deleteCodeError").style.display = "none";
  openModal("modalDeleteCode");
}

document.getElementById("confirmDeleteCode").addEventListener("click", () => {
  const code = document.getElementById("deleteCodeInput").value.trim();
  if (!pendingDeleteKey) return;

  if (code !== DELETE_MASTER_CODE) {
    document.getElementById("deleteCodeError").style.display = "block";
    return;
  }

  // Supprime les données de CE compte uniquement (profiles/calevents/tarifs) + l'entrée utilisateur
  Storage.remove(`cs-${pendingDeleteKey}-profiles`);
  Storage.remove(`cs-${pendingDeleteKey}-calevents`);
  Storage.remove(`cs-${pendingDeleteKey}-tarifs`);

  const users = getUsers().filter(u => u.key !== pendingDeleteKey);
  saveUsers(users);

  if (getCurrentUser() === pendingDeleteKey) {
    logoutCurrentUser();
  }

  pendingDeleteKey = null;
  closeModal("modalDeleteCode");
  renderProfileList();
});

renderProfileList();
