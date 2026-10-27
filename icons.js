// Icônes noir et blanc (traits, couleur = celle du texte autour). Remplace tous les emoji.
// Dans le HTML :  <i data-ic="calendar"></i>
// Dans le JS    :  ${ic("calendar")}   (disponible partout, window.ic)
(function () {
  var P = {
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    "arrow-left": '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    "arrow-right": '<path d="M5 12h14M12 5l7 7-7 7"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    "check-circle": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    "x-circle": '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    alert: '<path d="m10.3 3.9-8.4 14.5A2 2 0 0 0 3.6 21.5h16.8a2 2 0 0 0 1.7-3.1L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    alarm: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3"/>',
    bug: '<path d="m8 2 1.9 1.9M14.1 3.9 16 2M9 7.1v-1a3 3 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6zM12 20v-9M6.5 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M21 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14 9l2 2"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
    paw: '<circle cx="5.5" cy="11" r="1.8"/><circle cx="9.5" cy="6" r="1.8"/><circle cx="14.5" cy="6" r="1.8"/><circle cx="18.5" cy="11" r="1.8"/><path d="M12 11.5c-3 0-5.5 3-5.5 5.5 0 1.8 1.4 2.7 3 2.5 1-.1 1.6-.5 2.5-.5s1.5.4 2.5.5c1.6.2 3-.7 3-2.5 0-2.5-2.5-5.5-5.5-5.5z"/>',
    cat: '<path d="M4 3.5 8 7h8l4-3.5V13a8 8 0 0 1-16 0z"/><path d="M9 12.5h.01M15 12.5h.01M11 16l1 .8 1-.8" />',
    dog: '<path d="M8 4h8v8.5a4 4 0 0 1-8 0zM8 6C4 5.5 3 8 3.5 11c.3 1.8 1.5 3 3 3M16 6c4-.5 5 2 4.5 5-.3 1.8-1.5 3-3 3"/><path d="M10 10h.01M14 10h.01M12 13v1.5"/>',
    rabbit: '<path d="M9 9C7.5 6 7.5 2.5 9 2.5S11 6 11 9M15 9c1.5-3 1.5-6.500 0-6.500S13 6 13 9"/><path d="M6 15a6 6 0 0 1 12 0c0 3.500-2.500 6-6 6s-6-2.500-6-6z"/><path d="M10 14h.01M14 14h.01M11 17.500l1 .5 1-.5"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    map: '<path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2zM9 3v16M15 5v16"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16 8-2 6-6 2 2-6z"/>',
    pin: '<path d="M20 10c0 7-8 12-8 12S4 17 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10"/>',
    car: '<path d="M3 17v-5l2-5h14l2 5v5h-3M3 17h3M21 17h-3M10 17h4M3 12h18"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.800 5.800 21l1.200-6.800-5-4.900 6.900-1z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.500"/><path d="M2 21a7 7 0 0 1 14 0"/><circle cx="17" cy="9" r="2.500"/><path d="M17 14a5 5 0 0 1 5 5"/>',
    receipt: '<path d="M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2zM9 7h6M9 11h6M9 15h4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.300-4.300"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    crown: '<path d="m2 18 2-11 5 5 3-8 3 8 5-5 2 11zM3 21h18"/>',
    lifebuoy: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="m4.900 4.900 4.300 4.300M14.800 14.800l4.300 4.300M14.800 9.200l4.300-4.300M4.900 19.100l4.300-4.300"/>',
    euro: '<path d="M18 7a7 7 0 1 0 0 10M4 10h10M4 14h10"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.400 15a1.700 1.700 0 0 0 .3 1.800l.1.100a2 2 0 1 1-2.800 2.800l-.1-.1a1.700 1.700 0 0 0-1.800-.3 1.700 1.700 0 0 0-1 1.500V21a2 2 0 1 1-4 0v-.1a1.700 1.700 0 0 0-1.100-1.500 1.700 1.700 0 0 0-1.800.3l-.1.1a2 2 0 1 1-2.800-2.800l.1-.1a1.700 1.700 0 0 0 .3-1.800 1.700 1.700 0 0 0-1.500-1H3a2 2 0 1 1 0-4h.1a1.700 1.700 0 0 0 1.500-1.100 1.700 1.700 0 0 0-.3-1.800l-.1-.1a2 2 0 1 1 2.800-2.800l.1.1a1.700 1.700 0 0 0 1.800.3H9a1.700 1.700 0 0 0 1-1.500V3a2 2 0 1 1 4 0v.1a1.700 1.700 0 0 0 1 1.500 1.700 1.700 0 0 0 1.800-.3l.1-.1a2 2 0 1 1 2.800 2.800l-.1.1a1.700 1.700 0 0 0-.3 1.800V9a1.700 1.700 0 0 0 1.500 1H21a2 2 0 1 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1z"/>',
    wrench: '<path d="M14.700 6.300a1 1 0 0 0 0 1.400l1.600 1.600a1 1 0 0 0 1.400 0l3.770-3.770a6 6 0 0 1-7.940 7.940l-6.910 6.910a2.120 2.120 0 0 1-3-3l6.910-6.910a6 6 0 0 1 7.940-7.940l-3.760 3.760z"/>',
    pencil: '<path d="M12 20h9M16.500 3.500a2.100 2.100 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/>',
    sparkles: '<path d="m12 3 1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800zM19 15l.8 2.200L22 18l-2.200.8L19 21l-.8-2.200L16 18l2.200-.8z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.700 21a2 2 0 0 1-3.400 0"/>',
    send: '<path d="m22 2-11 11M22 2l-7 20-4-9-9-4z"/>',
    refresh: '<path d="M21 12a9 9 0 0 0-15-6.700L3 8M3 3v5h5M3 12a9 9 0 0 0 15 6.700L21 16M21 21v-5h-5"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    building: '<path d="M4 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18M16 10h2a2 2 0 0 1 2 2v10M2 22h20M8 6h4M8 10h4M8 14h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    dot: '<circle cx="12" cy="12" r="7" fill="currentColor"/>',
    "dot-half": '<circle cx="12" cy="12" r="7"/><path d="M12 5a7 7 0 0 1 0 14z" fill="currentColor"/>',
    "dot-empty": '<circle cx="12" cy="12" r="7"/>',
    merge: '<path d="M6 3v6a6 6 0 0 0 6 6h6M18 15l-3-3M18 15l-3 3M6 21v-6"/>'
  };

  // Emoji d'animaux (utilisé par storage.js)
  function ic(name, size) {
    var body = P[name] || P.paw;
    var s = size ? ' style="width:' + size + ';height:' + size + ';"' : ' style="width:1.15em;height:1.15em;max-width:32px;max-height:32px;"';
    return '<svg class="ic" width="1.15em" height="1.15em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + s + '>' + body + '</svg>';
  }
  window.ic = ic;
  window.IC_NAMES = Object.keys(P);

  function hydrate(root) {
    (root || document).querySelectorAll("i[data-ic]").forEach(function (el) {
      el.innerHTML = ic(el.getAttribute("data-ic"));
      el.classList.add("ic-wrap");
      el.removeAttribute("data-ic");
    });
  }
  window.icHydrate = hydrate;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { hydrate(); });
  else hydrate();
})();
