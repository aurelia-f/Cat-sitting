// Pied de page commun à toutes les pages
// ============================================================
//  NUMÉRO DE VERSION DU SITE : c'est le SEUL endroit à changer.
//  Il est repris automatiquement par le pied de page de toutes les pages,
//  par la mise à jour de l'appli (sw.js) et par les rapports de bug.
// ============================================================
var APP_VERSION = "38";

(function () {
  self.APP_VERSION = APP_VERSION;
  if (typeof document === "undefined") return;   // chargé par sw.js : pas de page à modifier
  function build() {
    if (document.querySelector(".app-footer")) return;
    var ic = typeof window.ic === "function" ? window.ic : function () { return ""; };
    var f = document.createElement("footer");
    f.className = "app-footer";
    f.innerHTML =
      '<div class="app-footer-links">' +
        '<a href="aide.html">' + ic("bug") + ' Aide et bug</a>' +
        '<span>·</span>' +
        '<a href="mailto:aurelia.fournier@gmail.com">' + ic("mail") + ' Contact</a>' +
      '</div>' +
      '<div class="app-footer-small">Pet Sitting · version ' + APP_VERSION + ' · Fait avec soin par Aurélia Fournier</div>';
    (document.querySelector(".app") || document.body).appendChild(f);
  }
  window.APP_VERSION_LABEL = APP_VERSION;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
