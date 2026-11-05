(() => {
  const DATA = window.MCU_DATA || [];
  const DOOMSDAY = new Date("2026-12-18T00:00:00");
  const KEY = "mcu-doomsday-tracker:v1";

  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  };
  const state = Object.assign({ watched: {}, order: "chrono", filter: "all", series: false }, load());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

  const $ = (s) => document.querySelector(s);
  const list = $("#list");
  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  const fmtTime = (min) => {
    if (!min) return "0 h";
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
  };
  const released = (it) => new Date(it.release + "T00:00:00") <= new Date();

  const visibleItems = () => DATA.filter((it) => state.series || it.kind === "film" || it.always);
  const ordered = () => {
    const items = visibleItems().slice();
    if (state.order === "release") items.sort((a, b) => a.release.localeCompare(b.release));
    else items.sort((a, b) => a.chrono - b.chrono);
    // Doomsday toujours en dernier : c'est l'objectif
    const i = items.findIndex((x) => x.id === "doomsday");
    if (i > -1) items.push(items.splice(i, 1)[0]);
    return items;
  };

  const playIcon = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';

  function card(it, index, nextId) {
    const done = !!state.watched[it.id];
    const isFinal = it.id === "doomsday";
    const locked = isFinal && !released(it);
    const li = document.createElement("li");
    li.className = "card" + (done ? " done" : "") + (it.id === nextId ? " next" : "") + (isFinal ? " final" : "") + (locked ? " locked" : "");
    const trailer = it.trailer
      ? `https://www.youtube.com/watch?v=${it.trailer}`
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(it.original + " trailer")}`;
    const chips = [
      `<span class="chip era" title="Époque dans l'histoire">⏳ ${it.era}</span>`,
      `<span class="chip">Phase ${it.phase}</span>`,
      `<span class="chip">${fmtDate(it.release)}</span>`,
      it.runtime ? `<span class="chip">${it.kind === "serie" ? "≈ " : ""}${fmtTime(it.runtime)}</span>` : "",
    ].join("");

    li.innerHTML = `
      <div class="poster">
        <span class="num">${isFinal ? "★" : String(index + 1).padStart(2, "0")}</span>
        ${it.kind === "serie" ? '<span class="badge serie">Série</span>' : ""}
        ${!released(it) ? '<span class="badge">Bientôt</span>' : ""}
        ${it.poster ? `<img src="${it.poster}" alt="Affiche de ${it.title}" loading="lazy">` : ""}
        <a class="play" href="${trailer}" target="_blank" rel="noopener">${playIcon} Bande-annonce</a>
      </div>
      <div class="body">
        <p class="title">${it.title}</p>
        ${it.original !== it.title ? `<p class="original">${it.original}</p>` : ""}
        <div class="meta">${chips}</div>
        ${isFinal ? `<p class="soon">${locked ? "L'objectif final. Termine le marathon avant le 18 décembre." : "C'est le moment. Fonce au cinéma."}</p>` : ""}
        <button class="watch" ${locked ? "disabled" : ""}>
          <span class="box">${done ? "✓" : ""}</span>${done ? "Vu" : locked ? "Pas encore sorti" : "Marquer comme vu"}
        </button>
      </div>`;
    li.querySelector(".watch").addEventListener("click", () => {
      if (locked) return;
      if (state.watched[it.id]) delete state.watched[it.id];
      else state.watched[it.id] = Date.now();
      save(); render();
    });
    return li;
  }

  function render() {
    const all = ordered();
    const q = $("#search").value.trim().toLowerCase();
    const trackable = all.filter((x) => x.id !== "doomsday");
    const doneItems = trackable.filter((x) => state.watched[x.id]);
    const todo = trackable.filter((x) => !state.watched[x.id]);
    const next = todo[0];

    // stats
    const pct = trackable.length ? Math.round((doneItems.length / trackable.length) * 100) : 0;
    $("#count").textContent = `${doneItems.length} / ${trackable.length} titres vus`;
    $("#pct").textContent = pct + " %";
    $("#bar").style.width = pct + "%";
    const leftMin = todo.reduce((s, x) => s + (x.runtime || 0), 0);
    $("#left-time").textContent = todo.length ? fmtTime(leftMin) : "Prêt ! 🎉";
    $("#next-up").textContent = next ? next.title : "Doomsday !";

    const daysLeft = Math.max(1, Math.ceil((DOOMSDAY - new Date()) / 86400000));
    $("#pace").textContent = DOOMSDAY > new Date()
      ? (todo.length ? `rythme conseillé : ${(todo.length / daysLeft * 7).toFixed(1).replace(".", ",")} titre(s) / semaine` : "marathon terminé, t'es prêt")
      : "il est sorti !";

    // list
    let items = all.map((it, i) => ({ it, i }));
    if (state.filter === "todo") items = items.filter(({ it }) => !state.watched[it.id]);
    if (state.filter === "done") items = items.filter(({ it }) => state.watched[it.id]);
    if (q) items = items.filter(({ it }) => (it.title + " " + it.original).toLowerCase().includes(q));

    list.replaceChildren(...items.map(({ it, i }) => card(it, i, next && next.id)));
    if (!items.length) list.innerHTML = '<li class="empty">Rien à afficher ici.</li>';

    document.querySelectorAll("[data-order]").forEach((b) => b.classList.toggle("active", b.dataset.order === state.order));
    document.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("active", b.dataset.filter === state.filter));
    $("#series").checked = state.series;
  }

  function tick() {
    let diff = Math.max(0, DOOMSDAY - new Date());
    const d = Math.floor(diff / 86400000); diff -= d * 86400000;
    const h = Math.floor(diff / 3600000); diff -= h * 3600000;
    const m = Math.floor(diff / 60000); diff -= m * 60000;
    const s = Math.floor(diff / 1000);
    $("#cd-d").textContent = d;
    $("#cd-h").textContent = String(h).padStart(2, "0");
    $("#cd-m").textContent = String(m).padStart(2, "0");
    $("#cd-s").textContent = String(s).padStart(2, "0");
  }

  document.querySelectorAll("[data-order]").forEach((b) => b.addEventListener("click", () => { state.order = b.dataset.order; save(); render(); }));
  document.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => { state.filter = b.dataset.filter; save(); render(); }));
  $("#series").addEventListener("change", (e) => { state.series = e.target.checked; save(); render(); });
  $("#search").addEventListener("input", render);
  $("#reset").addEventListener("click", () => {
    if (Object.keys(state.watched).length && !confirm("Effacer toute ta progression ?")) return;
    state.watched = {}; save(); render();
  });

  tick(); setInterval(tick, 1000);
  render();
})();
