// Pied de page commun à toutes les pages
(function () {
  var VERSION = "37";
  function build() {
    if (document.querySelector(".app-footer")) return;
    var f = document.createElement("footer");
    f.className = "app-footer";
    f.innerHTML =
      '<div class="app-footer-links">' +
        '<a href="aide.html">' + window.ic("bug") + ' Aide et bug</a>' +
        '<span>·</span>' +
        '<a href="mailto:aurelia.fournier@gmail.com">' + window.ic("mail") + ' Contact</a>' +
      '</div>' +
      '<div class="app-footer-small">Petsitting · version ' + VERSION + ' · Fait avec soin par Aurélia Fournier</div>';
    (document.querySelector(".app") || document.body).appendChild(f);
  }
  window.APP_VERSION_LABEL = VERSION;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
