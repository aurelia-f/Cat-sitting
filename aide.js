/* ============================================
   CAT SITTING — aide.js : centre d'aide / formulaire de bug
   ============================================ */

document.getElementById("backBtn").addEventListener("click", () => goTo("accueil.html"));
document.getElementById("diagBtn").addEventListener("click", () => goTo("diagnostic.html"));

let severity = "";
document.querySelectorAll("#bugSeverity .pill").forEach(p => {
  p.addEventListener("click", () => {
    document.querySelectorAll("#bugSeverity .pill").forEach(x => x.classList.remove("active"));
    p.classList.add("active");
    severity = p.dataset.value;
  });
});

// Réduit l'image (max 1000 px, JPEG) pour qu'elle reste légère
function shrinkImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const max = 1000;
      const ratio = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * ratio);
      c.height = Math.round(img.height * ratio);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => resolve(b), "image/jpeg", 0.75);
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

function feedback(text, ok) {
  const fb = document.getElementById("bugFeedback");
  fb.style.display = "block";
  fb.style.color = ok ? "var(--green, #5a9a6a)" : "var(--red)";
  fb.textContent = text;
}

document.getElementById("sendBugBtn").addEventListener("click", async () => {
  const page = document.getElementById("bugPage").value;
  const done = document.getElementById("bugDone").value.trim();
  const expected = document.getElementById("bugExpected").value.trim();
  if (!page) return feedback("Choisis la page concernée.", false);
  if (!severity) return feedback("Choisis la gravité.", false);
  if (!done && !expected) return feedback("Décris un petit peu ce qui s'est passé.", false);

  const btn = document.getElementById("sendBugBtn");
  btn.disabled = true;
  btn.textContent = "Envoi…";

  let shotUrl = null;
  const file = document.getElementById("bugShot").files[0];
  if (file) {
    const blob = await shrinkImage(file);
    if (blob) shotUrl = await window.uploadBugScreenshot(blob);
  }

  const ok = await window.reportBug({
    kind: "manuel",
    severity,
    page,
    message: `[${page}] ${expected || done}`,
    what_done: done,
    what_expected: expected,
    screenshot_url: shotUrl
  });

  btn.disabled = false;
  btn.textContent = "Envoyer";
  if (ok) {
    feedback("Merci ! Ton message a bien été envoyé !", true);
    ["bugDone", "bugExpected"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("bugShot").value = "";
    document.getElementById("bugPage").value = "";
    document.querySelectorAll("#bugSeverity .pill").forEach(x => x.classList.remove("active"));
    severity = "";
  } else {
    feedback("Envoi impossible pour l'instant (vérifie ta connexion et réessaie).", false);
  }
});
