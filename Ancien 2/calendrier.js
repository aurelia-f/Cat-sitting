// ═══════════════════════════════════
// CALENDRIER.JS
// ═══════════════════════════════════

if (!getCurrentUser()) goTo("index.html");

const today = new Date();
let calMonth = today.getMonth();
let calYear  = today.getFullYear();
let dragEvt  = null;

function render() {
  document.getElementById("cal-title").textContent = fmtMonthYear(calYear, calMonth);
  const dim   = getDIM(calYear, calMonth);
  const fdom  = getFDOM(calYear, calMonth);
  const calEvts = getCalEvents();
  const grid  = document.getElementById("cal-grid");
  grid.innerHTML = "";

  // Cellules vides avant le 1er
  for (let i = 0; i < fdom; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let day = 1; day <= dim; day++) {
    const ds = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const animals  = getAnimalsByDate(ds);
    const keyRdvs  = getKeyRdvsByDate(ds);
    const evts     = calEvts[ds] || [];
    const isToday  = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();

    const cell = document.createElement("div");
    cell.className = "cal-cell" + (isToday ? " is-today" : "") + (animals.length > 0 ? " has-animals" : "");

    // Numéro du jour
    const num = document.createElement("div");
    num.className = "cal-num";
    num.textContent = day;
    cell.appendChild(num);

    // Pills animaux (prestation ou visite planifiée)
    animals.slice(0, 3).forEach(a => {
      const evt = evts.find(e => e.animalName === a.animalName);
      const pill = document.createElement("div");
      pill.className = "cal-pill " + (evt ? "visite" : "prestation");
      pill.textContent = animalEmoji(a.animalTypes) + " " + (a.animalName.length > 5 ? a.animalName.slice(0,5)+"…" : a.animalName);
      if (evt) {
        const timeLine = document.createElement("div");
        timeLine.style.cssText = "font-size:8px;opacity:0.9;margin-top:1px";
        timeLine.textContent = "⏰ " + evt.time;
        pill.appendChild(timeLine);
        pill.draggable = true;
        pill.addEventListener("dragstart", e => {
          dragEvt = { fromDate: ds, evtData: evt };
          e.stopPropagation();
        });
      }
      cell.appendChild(pill);
    });

    // Pills RDV clés
    keyRdvs.forEach(k => {
      const pill = document.createElement("div");
      pill.className = "cal-pill cle";
      pill.textContent = "🔑" + (k.type === "récup" ? "↓" : "↑") + " " + (k.nom.length > 5 ? k.nom.slice(0,5)+"…" : k.nom);
      if (k.time) {
        const t = document.createElement("div");
        t.style.cssText = "font-size:8px;opacity:0.9;margin-top:1px";
        t.textContent = "⏰ " + k.time;
        pill.appendChild(t);
      }
      cell.appendChild(pill);
    });

    // Click pour planifier
    if (animals.length > 0) {
      cell.addEventListener("click", () => openModal(ds, animals, evts));
    }

    // Drag & drop
    cell.addEventListener("dragover", e => { e.preventDefault(); cell.classList.add("drag-over"); });
    cell.addEventListener("dragleave", () => cell.classList.remove("drag-over"));
    cell.addEventListener("drop", e => {
      e.preventDefault();
      cell.classList.remove("drag-over");
      if (!dragEvt) return;
      const calEvtsU = getCalEvents();
      // Enlever de la source
      if (calEvtsU[dragEvt.fromDate]) {
        calEvtsU[dragEvt.fromDate] = calEvtsU[dragEvt.fromDate].filter(ev => ev.animalName !== dragEvt.evtData.animalName);
        if (!calEvtsU[dragEvt.fromDate].length) delete calEvtsU[dragEvt.fromDate];
      }
      // Ajouter à la cible
      if (!calEvtsU[ds]) calEvtsU[ds] = [];
      calEvtsU[ds] = calEvtsU[ds].filter(ev => ev.animalName !== dragEvt.evtData.animalName);
      calEvtsU[ds].push({ ...dragEvt.evtData });
      saveCalEvents(calEvtsU);
      dragEvt = null;
      render();
    });

    grid.appendChild(cell);
  }
}

function openModal(ds, animals, existingEvts) {
  document.getElementById("modal-date").textContent = "📅 " + fmtDate(ds);
  document.getElementById("modal-overlay").classList.remove("hidden");
  const container = document.getElementById("modal-animals");
  container.innerHTML = "";

  animals.forEach((a, i) => {
    const ex = existingEvts.find(e => e.animalName === a.animalName);
    const div = document.createElement("div");
    div.className = "card card-accent";
    div.style.marginBottom = "10px";
    div.innerHTML = `
      <div style="font-weight:bold;font-size:14px;color:var(--text);margin-bottom:6px">${animalEmoji(a.animalTypes)} ${a.animalName}</div>
      ${a.visitTime ? `<div style="font-size:12px;color:var(--text-lt);margin-bottom:8px">Heure habituelle : ${a.visitTime}</div>` : ""}
      <div style="display:flex;gap:8px;align-items:center">
        <input type="time" id="time-${i}" value="${ex?.time || a.visitTime || ""}"
          style="flex:1;padding:9px 10px;border-radius:9px;border:2px solid var(--border);font-size:15px;outline:none">
        <button class="btn btn-primary btn-small" onclick="saveEvt('${ds}','${a.animalName}',${i})">✓</button>
        ${ex ? `<button class="btn btn-small" style="background:white;border:1px solid var(--border);color:var(--text-lt)" onclick="removeEvt('${ds}','${a.animalName}')">🗑</button>` : ""}
      </div>`;
    container.appendChild(div);
  });
}

function saveEvt(ds, animalName, idx) {
  const time = document.getElementById("time-"+idx).value;
  const calEvtsU = getCalEvents();
  if (!calEvtsU[ds]) calEvtsU[ds] = [];
  calEvtsU[ds] = calEvtsU[ds].filter(e => e.animalName !== animalName);
  calEvtsU[ds].push({ animalName, time });
  saveCalEvents(calEvtsU);
  closeModal();
  render();
}

function removeEvt(ds, animalName) {
  const calEvtsU = getCalEvents();
  if (calEvtsU[ds]) {
    calEvtsU[ds] = calEvtsU[ds].filter(e => e.animalName !== animalName);
    if (!calEvtsU[ds].length) delete calEvtsU[ds];
  }
  saveCalEvents(calEvtsU);
  closeModal();
  render();
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

document.getElementById("btn-prev").onclick = () => {
  if (calMonth === 0) { calMonth = 11; calYear--; } else calMonth--;
  render();
};
document.getElementById("btn-next").onclick = () => {
  if (calMonth === 11) { calMonth = 0; calYear++; } else calMonth++;
  render();
};

render();
