/* ============================================
   CAT SITTING — preferences.js
   ============================================ */

await window.hydrateFromSupabase();
if (!getCurrentUser()) {
  goTo("index.html");
}

document.getElementById("backBtn").addEventListener("click", () => goTo("accueil.html"));

function setupPillGroup(id, currentValue) {
  const group = document.getElementById(id);
  group.querySelectorAll(".pill").forEach(pill => {
    pill.classList.toggle("selected", pill.dataset.value === currentValue);
    pill.addEventListener("click", () => {
      group.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
      pill.classList.add("selected");
    });
  });
}

function getPillGroupValue(id) {
  const group = document.getElementById(id);
  const sel = group.querySelector(".pill.selected");
  return sel ? sel.dataset.value : "no_pref";
}

const prefs = getPrefs();
setupPillGroup("durationPrefGroup", prefs.duration_pref);
setupPillGroup("difficultyPrefGroup", prefs.difficulty_pref);
document.getElementById("startTimeInput").value = prefs.preferred_start_time || "09:00";
document.getElementById("homeAddressInput").value = prefs.home_address || "";

document.getElementById("saveBtn").addEventListener("click", async () => {
  const btn = document.getElementById("saveBtn");
  const homeAddress = document.getElementById("homeAddressInput").value.trim();

  let homeLat = prefs.home_lat;
  let homeLng = prefs.home_lng;

  if (homeAddress && homeAddress !== prefs.home_address) {
    btn.textContent = "📍 Localisation de ton adresse…";
    btn.disabled = true;
    const coords = await geocodeAddress(homeAddress);
    if (coords) {
      homeLat = coords.lat;
      homeLng = coords.lng;
    } else {
      homeLat = null;
      homeLng = null;
      alert("Ton adresse n'a pas pu être localisée — elle est quand même enregistrée, mais n'apparaîtra pas sur les cartes.");
    }
    btn.textContent = "💾 Enregistrer";
    btn.disabled = false;
  } else if (!homeAddress) {
    homeLat = null;
    homeLng = null;
  }

  savePrefs({
    duration_pref: getPillGroupValue("durationPrefGroup"),
    difficulty_pref: getPillGroupValue("difficultyPrefGroup"),
    preferred_start_time: document.getElementById("startTimeInput").value || "09:00",
    home_address: homeAddress,
    home_lat: homeLat,
    home_lng: homeLng
  });
  await window.flushCloudSync();
  goTo("accueil.html");
});
