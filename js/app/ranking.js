// =====================================================================
// ranking.js  — Camino Bíblico
// Modos: wordle (WRP semana) | quiz (XP quiz semana) | global (XP total)
// =====================================================================

const TZ = "America/Santo_Domingo";

// ─── Supabase ─────────────────────────────────────────────────────────
function waitForSupabase(ms = 5000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function poll() {
      if (window.supabase) return resolve(window.supabase);
      if (Date.now() - t0 > ms) return reject(new Error("Supabase no cargó"));
      requestAnimationFrame(poll);
    })();
  });
}

// ─── Fechas ───────────────────────────────────────────────────────────
const hoyDO = () => new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
function isoDate(d) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(d);
}
function domingoSemana(d) {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

// ─── Refs UI ─────────────────────────────────────────────────────────
const tabs      = [...document.querySelectorAll(".tab")];
const podioEl   = document.getElementById("podio");
const tbodyEl   = document.getElementById("tbody");
const theadEl   = document.getElementById("thead");
const buscarEl  = document.getElementById("buscar");
const toastEl   = document.getElementById("toast");
const youPosEl  = document.getElementById("you-pos");
const youPtsEl  = document.getElementById("you-pts");
const youRachaEl= document.getElementById("you-racha");
const youLblEl  = document.getElementById("you-pts-label");
const modeDescEl= document.getElementById("mode-desc");
const semanaEl  = document.getElementById("semana-txt");
const shareBtn  = document.getElementById("btn-share");

// ─── Estado ───────────────────────────────────────────────────────────
let sb, user;
let mode       = "wordle";
let allRows    = [];
let semanaISO  = "";
let youRow     = null;

const MODOS = {
  wordle: {
    desc  : "Puntos Wordle (WRP) acumulados esta semana",
    cols  : ["#", "Jugador", "WRP", "XP"],
    ptsLbl: "WRP semana",
  },
  quiz: {
    desc  : "Experiencia (XP) ganada en el Quiz esta semana",
    cols  : ["#", "Jugador", "XP Quiz", "Nivel"],
    ptsLbl: "XP Quiz sem.",
  },
  global: {
    desc  : "XP total acumulado en todos los modos",
    cols  : ["#", "Jugador", "XP Total", "Nivel"],
    ptsLbl: "XP global",
  },
};

const MEDALS = ["🥇","🥈","🥉"];

// ─── INIT ─────────────────────────────────────────────────────────────
(async function init() {
  try { sb = await waitForSupabase(); } catch(e) { alert(e.message); return; }

  // Auth
  const { data: g } = await sb.auth.getUser();
  user = g?.user || null;
  if (!user) {
    const { data: a } = await sb.auth.signInAnonymously();
    user = a?.user || null;
  }

  // Semana
  const hoy = hoyDO();
  const dom  = domingoSemana(hoy);
  semanaISO  = isoDate(dom);

  // Formato legible: "Semana del 30 mar al 5 abr"
  const fin = new Date(dom); fin.setDate(dom.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString("es-DO", { day:"numeric", month:"short", timeZone: TZ });
  semanaEl.textContent = `Semana del ${fmt(dom)} al ${fmt(fin)}`;

  // Racha desde localStorage
  youRachaEl.textContent = localStorage.getItem("wb:streak") || "0";

  // Tabs
  tabs.forEach(t => t.addEventListener("click", () => {
    tabs.forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    mode = t.dataset.mode;
    cargar();
  }));

  // Búsqueda local
  buscarEl.addEventListener("input", () => renderTabla(filtrar()));

  // Compartir
  shareBtn.addEventListener("click", compartir);

  cargar();
})();

// ─── CARGAR DATOS ─────────────────────────────────────────────────────
async function cargar() {
  modeDescEl.textContent = MODOS[mode].desc;
  mostrarSkeleton();

  try {
    if (mode === "wordle") {
      await cargarWordle();
    } else if (mode === "quiz") {
      await cargarQuiz();
    } else {
      await cargarGlobal();
    }
  } catch(e) {
    console.error(e);
    tbodyEl.innerHTML = `<div class="empty-msg">⚠️ No se pudo cargar el ranking.<br><small>${e.message}</small></div>`;
    toast("Error al cargar ranking");
  }
}

// ─── MODO WORDLE ──────────────────────────────────────────────────────
async function cargarWordle() {
  // Consultar wordle_jugadas de esta semana agrupado por usuario
  const { data, error } = await sb
    .from("wordle_jugadas")
    .select("user_id, xp_otorgado, wrp, intentos, acierto")
    .eq("semana_id", semanaISO)
    .eq("estado", "terminado");

  if (error) throw error;

  // Agrupar por user_id
  const mapa = {};
  for (const j of (data || [])) {
    if (!mapa[j.user_id]) mapa[j.user_id] = { user_id: j.user_id, wrp: 0, xp: 0, aciertos: 0, jugadas: 0 };
    mapa[j.user_id].wrp      += j.wrp        || 0;
    mapa[j.user_id].xp       += j.xp_otorgado|| 0;
    mapa[j.user_id].aciertos += j.acierto ? 1 : 0;
    mapa[j.user_id].jugadas  += 1;
  }

  // Obtener nombres desde resumen_ranking
  const uids = Object.keys(mapa);
  let nombres = {};
  if (uids.length) {
    const { data: perfiles } = await sb
      .from("resumen_ranking")
      .select("user_id, nombre, nivel")
      .in("user_id", uids);
    (perfiles || []).forEach(p => { nombres[p.user_id] = { nombre: p.nombre, nivel: p.nivel }; });
  }

  // Construir filas y ordenar por WRP
  allRows = Object.values(mapa)
    .map(r => ({
      ...r,
      nombre: nombres[r.user_id]?.nombre || "Jugador",
      nivel : nombres[r.user_id]?.nivel  || 1,
      pts   : r.wrp,
      pts2  : r.xp,
      pts2lbl: "XP",
    }))
    .sort((a, b) => b.pts - a.pts)
    .map((r, i) => ({ ...r, pos: i + 1 }));

  youRow = allRows.find(r => r.user_id === user?.id) || null;
  renderYou("WRP");
  renderCabecera(["#", "Jugador", "WRP", "XP"]);
  renderPodio();
  renderTabla(allRows);
}

// ─── MODO QUIZ ────────────────────────────────────────────────────────
async function cargarQuiz() {
  // XP de quiz se guarda en resumen_ranking con xp_global
  // Aquí tomamos progreso de la semana desde quiz_resultados si existe,
  // o fallback desde resumen_ranking
  let rows = [];

  try {
    // Intentar tabla quiz_resultados (si existe)
    const { data, error } = await sb
      .from("quiz_resultados")
      .select("user_id, xp, created_at")
      .gte("created_at", semanaISO + "T00:00:00")
      .order("xp", { ascending: false });

    if (!error && data?.length) {
      // Agrupar por usuario
      const mapa = {};
      for (const r of data) {
        if (!mapa[r.user_id]) mapa[r.user_id] = { user_id: r.user_id, xp: 0, partidas: 0 };
        mapa[r.user_id].xp      += r.xp || 0;
        mapa[r.user_id].partidas += 1;
      }
      const uids = Object.keys(mapa);
      let nombres = {};
      if (uids.length) {
        const { data: perfiles } = await sb
          .from("resumen_ranking")
          .select("user_id, nombre, nivel")
          .in("user_id", uids);
        (perfiles || []).forEach(p => { nombres[p.user_id] = { nombre: p.nombre, nivel: p.nivel }; });
      }
      rows = Object.values(mapa)
        .map(r => ({
          ...r,
          nombre : nombres[r.user_id]?.nombre || "Jugador",
          nivel  : nombres[r.user_id]?.nivel  || 1,
          pts    : r.xp,
          pts2   : r.partidas,
          pts2lbl: "partidas",
        }))
        .sort((a, b) => b.pts - a.pts)
        .map((r, i) => ({ ...r, pos: i + 1 }));
    }
  } catch(_) {}

  // Fallback: si no hay tabla quiz_resultados, usar xp_global de resumen_ranking
  if (!rows.length) {
    const { data: perfiles, error } = await sb
      .from("resumen_ranking")
      .select("user_id, nombre, nivel, xp_global")
      .order("xp_global", { ascending: false })
      .limit(100);
    if (error) throw error;
    rows = (perfiles || []).map((r, i) => ({
      user_id: r.user_id,
      nombre : r.nombre || "Jugador",
      nivel  : r.nivel || 1,
      pts    : r.xp_global || 0,
      pts2   : r.nivel || 1,
      pts2lbl: "nivel",
      pos    : i + 1,
    }));
  }

  allRows = rows;
  youRow  = allRows.find(r => r.user_id === user?.id) || null;
  renderYou("XP Quiz");
  renderCabecera(["#", "Jugador", "XP Quiz", "Nivel"]);
  renderPodio();
  renderTabla(allRows);
}

// ─── MODO GLOBAL ──────────────────────────────────────────────────────
async function cargarGlobal() {
  const { data, error } = await sb
    .from("resumen_ranking")
    .select("user_id, nombre, nivel, xp_global")
    .order("xp_global", { ascending: false })
    .limit(200);

  if (error) throw error;

  allRows = (data || []).map((r, i) => ({
    user_id: r.user_id,
    nombre : r.nombre || "Jugador",
    nivel  : r.nivel  || 1,
    pts    : r.xp_global || 0,
    pts2   : r.nivel  || 1,
    pts2lbl: "nivel",
    pos    : i + 1,
  }));

  youRow = allRows.find(r => r.user_id === user?.id) || null;
  renderYou("XP Total");
  renderCabecera(["#", "Jugador", "XP Total", "Nivel"]);
  renderPodio();
  renderTabla(allRows);
}

// ─── RENDER YOU ───────────────────────────────────────────────────────
function renderYou(label) {
  youLblEl.textContent = label;
  if (!youRow) {
    youPosEl.textContent = "—";
    youPtsEl.textContent = "—";
    return;
  }
  youPosEl.textContent = `#${youRow.pos}`;
  youPtsEl.textContent = (youRow.pts || 0).toLocaleString();
}

// ─── RENDER PÓDIUM ────────────────────────────────────────────────────
function renderPodio() {
  const top3 = allRows.slice(0, 3);
  if (!top3.length) { podioEl.innerHTML = ""; return; }

  // Orden visual: 2 - 1 - 3
  const orden = [top3[1], top3[0], top3[2]].filter(Boolean);

  podioEl.innerHTML = orden.map(r => {
    const medal = MEDALS[r.pos - 1] || `#${r.pos}`;
    const cls   = `pos-${r.pos}`;
    return `
      <div class="podio-item ${cls}">
        <div class="podio-rank">${medal}</div>
        <div class="podio-medal">${["🥇","🥈","🥉"][r.pos-1]||""}</div>
        <div class="podio-name">${esc(r.nombre)}</div>
        <div class="podio-pts">${(r.pts||0).toLocaleString()}</div>
        <div class="podio-label">${MODOS[mode].ptsLbl}</div>
      </div>`;
  }).join("");
}

// ─── RENDER CABECERA ──────────────────────────────────────────────────
function renderCabecera(cols) {
  theadEl.innerHTML = cols.map((c, i) =>
    `<div${i===0||i>=2?' class="center"':''}>${c}</div>`
  ).join("");
}

// ─── FILTRAR ──────────────────────────────────────────────────────────
function filtrar() {
  const q = buscarEl.value.trim().toLowerCase();
  return q ? allRows.filter(r => (r.nombre||"").toLowerCase().includes(q)) : allRows;
}

// ─── RENDER TABLA ─────────────────────────────────────────────────────
function renderTabla(rows) {
  if (!rows.length) {
    tbodyEl.innerHTML = `<div class="empty-msg">Sin datos para este filtro.</div>`;
    return;
  }

  tbodyEl.innerHTML = rows.map(r => {
    const isYou  = user && r.user_id === user.id;
    const posCls = r.pos===1?"gold":r.pos===2?"silver":r.pos===3?"bronze":"";
    const rowCls = [
      "t-row",
      isYou    ? "is-you" : "",
      r.pos===1 ? "top-1" : r.pos===2 ? "top-2" : r.pos===3 ? "top-3" : ""
    ].filter(Boolean).join(" ");

    const pts2 = (r.pts2 ?? "—").toLocaleString ? (r.pts2||0).toLocaleString() : r.pts2;

    return `
      <div class="${rowCls}">
        <div class="t-pos ${posCls}">${MEDALS[r.pos-1]||"#"+r.pos}</div>
        <div>
          <div class="t-name">${esc(r.nombre)}${isYou?'<span class="t-you-tag">Tú</span>':''}</div>
          <div class="t-sub">Nivel ${r.nivel||1}</div>
        </div>
        <div class="t-num hi">${(r.pts||0).toLocaleString()}</div>
        <div class="t-num med">${pts2}</div>
      </div>`;
  }).join("");
}

// ─── SKELETON ─────────────────────────────────────────────────────────
function mostrarSkeleton() {
  podioEl.innerHTML = "";
  renderCabecera(MODOS[mode].cols);
  tbodyEl.innerHTML = Array.from({length:8}).map(() => `
    <div class="skel-row">
      <div class="skel" style="width:28px;height:12px;margin:0 auto;"></div>
      <div>
        <div class="skel" style="width:120px;height:10px;margin-bottom:5px;"></div>
        <div class="skel" style="width:70px;height:8px;"></div>
      </div>
      <div class="skel" style="width:36px;height:12px;margin:0 auto;"></div>
      <div class="skel" style="width:36px;height:12px;margin:0 auto;"></div>
    </div>`).join("");
}

// ─── COMPARTIR ────────────────────────────────────────────────────────
function compartir() {
  const pos   = youRow ? `#${youRow.pos}` : "Sin posición";
  const pts   = youRow ? (youRow.pts||0).toLocaleString() : "0";
  const label = MODOS[mode].ptsLbl;
  const nombre= youRow?.nombre || "Jugador";
  const modos = { wordle:"🔤 Wordle", quiz:"⚔️ Quiz Bíblico", global:"🌟 Global" };
  const total = allRows.length;

  const texto =
    `📖 *Camino Bíblico* — Ranking\n` +
    `${modos[mode]}\n\n` +
    `${nombre} está en la posición *${pos}* de ${total} jugadores\n` +
    `${label}: *${pts}*\n\n` +
    `¿Puedes superarme? 👇\n` +
    `${location.origin}${location.pathname.replace("ranking.html","")}ranking.html`;

  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
}

// ─── HELPERS ──────────────────────────────────────────────────────────
function esc(s) {
  return (s || "").replace(/[&<>"']/g, m =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":'&#39;' }[m])
  );
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2500);
}
