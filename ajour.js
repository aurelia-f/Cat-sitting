/* ============================================
   CAT SITTING — ajour.js
   Rattrapage : paiements en attente + clés non rendues
   ============================================ */

if (!getCurrentUser()) {
  goTo("index.html");
}

document.getElementById("backBtn").addEventListener("click", () => goTo("accueil.html"));

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function setPaymentStatus(ownerKey, idx, status) {
  const profiles = getProfiles();
  const p = profiles[ownerKey];
  if (!p || !p.prestations || !p.prestations[idx]) return;
  p.prestations[idx].payment_status = status;
  saveProfiles(profiles);
  render();
}

function setKeysReturned(ownerKey, idx, value) {
  const profiles = getProfiles();
  const p = profiles[ownerKey];
  if (!p || !p.prestations || !p.prestations[idx]) return;
  p.prestations[idx].keys_returned = value;
  saveProfiles(profiles);
  render();
}

function render() {
  const all = getAllPrestations();
  const pending = all
    .filter(p => p.payment_status !== "paye" || !p.keys_returned)
    .sort((a, b) => new Date(a.date_end) - new Date(b.date_end));

  const list = document.getElementById("pendingList");

  if (pending.length === 0) {
    list.innerHTML = `<div class="empty-state">🎉 Tout est à jour ! Aucun paiement en attente, aucune clé à rendre.</div>`;
    return;
  }

  list.innerHTML = pending.map(p => {
    const paymentDone = p.payment_status === "paye";
    const keysDone = !!p.keys_returned;

    const paymentRow = paymentDone
      ? `<div class="flex-between"><span class="small">💶 Paiement</span><span class="badge badge-green">✓ Payé</span></div>`
      : `<div class="flex-between">
           <span class="small">💶 Paiement</span>
           <div class="flex gap-8">
             <div class="icon-action" style="color:var(--green);" data-pay-ok="1" data-owner="${escapeHtml(p.ownerKey)}" data-idx="${p.idx}" title="J'ai été payé(e)">✓</div>
             <div class="icon-action" style="color:var(--red);" data-pay-no="1" data-owner="${escapeHtml(p.ownerKey)}" data-idx="${p.idx}" title="Pas encore payé(e)">✗</div>
           </div>
         </div>`;

    const keysRow = keysDone
      ? `<div class="flex-between mt-8"><span class="small">🔑 Clés</span><span class="badge badge-green">✓ Rendues</span></div>`
      : `<div class="flex-between mt-8">
           <span class="small">🔑 Clés</span>
           <div class="flex gap-8">
             <div class="icon-action" style="color:var(--green);" data-keys-ok="1" data-owner="${escapeHtml(p.ownerKey)}" data-idx="${p.idx}" title="J'ai rendu les clés">✓</div>
             <div class="icon-action" style="color:var(--purple);" data-keys-plan="1" data-owner="${escapeHtml(p.ownerKey)}" data-idx="${p.idx}" title="Programmer un rendu de clé">→</div>
           </div>
         </div>`;

    return `
      <div class="card">
        <div class="card-title">${animalEmoji(p.animalTypes)} ${escapeHtml(p.animalName)} <span class="text-lt small">· ${escapeHtml(p.ownerName)}</span></div>
        <div class="card-sub">${fmtShort(p.date_start)} → ${fmtShort(p.date_end)}</div>
        <div class="divider"></div>
        ${paymentRow}
        ${keysRow}
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-pay-ok]").forEach(btn => {
    btn.addEventListener("click", () => setPaymentStatus(btn.dataset.owner, parseInt(btn.dataset.idx), "paye"));
  });
  list.querySelectorAll("[data-pay-no]").forEach(btn => {
    btn.addEventListener("click", () => setPaymentStatus(btn.dataset.owner, parseInt(btn.dataset.idx), "attente"));
  });
  list.querySelectorAll("[data-keys-ok]").forEach(btn => {
    btn.addEventListener("click", () => setKeysReturned(btn.dataset.owner, parseInt(btn.dataset.idx), true));
  });
  list.querySelectorAll("[data-keys-plan]").forEach(btn => {
    btn.addEventListener("click", () => {
      goTo(`prestation.html?key=${encodeURIComponent(btn.dataset.owner)}&idx=${btn.dataset.idx}`);
    });
  });
}

render();
