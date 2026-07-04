// ═══════════════════════════════════
// LOGIN.JS — Authentification prénom + date de naissance
// ═══════════════════════════════════

// Structure stockée : { name: "Aurélia", dob: "1995-03-15", key: "aurelia" }
let users = Storage.get("cs-users-v2") || [];
let confirmDelete = null;
let loginTarget = null; // utilisateur en cours de connexion

function hashDob(dob) {
  // Simple hash de la date pour ne pas la stocker en clair
  let h = 0;
  for (let i = 0; i < dob.length; i++) {
    h = ((h << 5) - h) + dob.charCodeAt(i);
    h |= 0;
  }
  return String(Math.abs(h));
}

function userStorageKey(u) {
  return u.key || u.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

function render() {
  const list = document.getElementById("users-list");
  list.innerHTML = "";

  if (users.length > 0) {
    const title = document.createElement("p");
    title.style.cssText = "font-weight:bold;font-size:15px;color:var(--text);margin-bottom:14px;text-align:center";
    title.textContent = "Choisis ton profil";
    list.appendChild(title);

    users.forEach(u => {
      const row = document.createElement("div");
      row.className = "user-row";

      if (confirmDelete === u.key) {
        row.innerHTML = `
          <span style="flex:1;font-weight:bold;font-size:14px;color:var(--text)">Supprimer ${u.name} ?</span>
          <button class="btn btn-danger btn-small" onclick="deleteUser('${u.key}')">Oui</button>
          <button class="btn btn-outline btn-small" onclick="cancelDelete()">Non</button>`;
      } else {
        row.innerHTML = `
          <button class="user-btn" onclick="openLogin('${u.key}')">
            <span style="font-size:28px">🐾</span>
            <span>${u.name}</span>
          </button>
          <button class="del-btn" onclick="askDelete('${u.key}')">🗑</button>`;
      }
      list.appendChild(row);
    });

    const sep = document.createElement("div");
    sep.className = "section-sep";
    sep.innerHTML = "<span style='background:var(--bg);padding:0 10px'>ou</span><hr style='position:absolute;width:100%;top:50%;left:0;border:none;border-top:1px solid var(--border);z-index:-1'>";
    sep.style.position = "relative";
    list.appendChild(sep);

    document.getElementById("new-label").textContent = "Créer un nouveau profil";
  }
}

function openLogin(key) {
  loginTarget = users.find(u => u.key === key);
  document.getElementById("modal-name").textContent = `Bonjour ${loginTarget.name} 👋`;
  document.getElementById("login-dob").value = "";
  document.getElementById("login-error").textContent = "";
  document.getElementById("login-modal").classList.remove("hidden");
  setTimeout(() => document.getElementById("login-dob").focus(), 100);
}

function closeLoginModal() {
  document.getElementById("login-modal").classList.add("hidden");
  loginTarget = null;
}

function login() {
  if (!loginTarget) return;
  const dob = document.getElementById("login-dob").value;
  if (!dob) { document.getElementById("login-error").textContent = "Entre ta date de naissance."; return; }
  if (hashDob(dob) === loginTarget.dobHash) {
    Storage.set("cs-current-user", loginTarget.key);
    Storage.set("cs-current-name", loginTarget.name);
    goTo("accueil.html");
  } else {
    document.getElementById("login-error").textContent = "❌ Date incorrecte, réessaie.";
  }
}

function createAccount() {
  const name = document.getElementById("new-name").value.trim();
  const dob  = document.getElementById("new-dob").value;
  const errEl = document.getElementById("new-error");

  if (!name) { errEl.textContent = "Entre ton prénom."; return; }
  if (!dob)  { errEl.textContent = "Entre ta date de naissance."; return; }

  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString(36);
  const existing = users.find(u => u.name.toLowerCase() === name.toLowerCase());
  if (existing) { errEl.textContent = "Ce prénom existe déjà. Connecte-toi."; return; }

  const newUser = { name, key, dobHash: hashDob(dob) };
  users.push(newUser);
  Storage.set("cs-users-v2", users);

  Storage.set("cs-current-user", key);
  Storage.set("cs-current-name", name);
  goTo("accueil.html");
}

function askDelete(key)  { confirmDelete = key; render(); }
function cancelDelete()  { confirmDelete = null; render(); }
function deleteUser(key) {
  users = users.filter(u => u.key !== key);
  Storage.set("cs-users-v2", users);
  Storage.remove(`cs-${key}-profiles`);
  Storage.remove(`cs-${key}-history`);
  Storage.remove(`cs-${key}-calendar`);
  confirmDelete = null;
  render();
}

// Touche Entrée dans le modal
document.getElementById("login-dob").addEventListener("keydown", e => {
  if (e.key === "Enter") login();
});

// Redirect si déjà connecté
if (getCurrentUser()) goTo("accueil.html");

render();
