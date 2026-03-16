// =====================================================================
// wordle.js  — Camino Bíblico v2
// Multi-palabra por día: 2 de lun-sáb, 3 los domingos
// Cada palabra se guarda como fila separada en wordle_jugadas
// con el campo palabra_idx (0, 1, 2…)
// =====================================================================

const TZ       = "America/Santo_Domingo";
const MAX_INT  = 6;
const DATA_URL = "datos/wordle-semanas.json";

// ─── Sound Manager ────────────────────────────────────────────────────────────
const SND = {
  _cache: {},
  _muted: localStorage.getItem("cb:muted") === "1",
  play(name, vol = 1) {
    if (this._muted) return;
    try {
      if (!this._cache[name]) {
        const a = new Audio(`./assets/sonidos/${name}.mp3`);
        a.preload = "auto";
        this._cache[name] = a;
      }
      const a = this._cache[name];
      a.currentTime = 0;
      a.volume = vol;
      a.play().catch(() => {});
    } catch(e) {}
  },
  nota(idx) {
    // idx 0-5 → nota_a, nota_b, nota_c según posición
    const notas = ["nota_a","nota_b","nota_a","nota_b","nota_c","nota_c"];
    this.play(notas[Math.min(idx, notas.length - 1)], 0.5);
  }
};

// ─── Esperar Supabase ────────────────────────────────────────────────
function waitForSupabase(ms = 5000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function poll() {
      if (window.supabase) return resolve(window.supabase);
      if (Date.now() - t0 > ms) return reject(new Error("Supabase no cargó. Verifica supabase.js"));
      requestAnimationFrame(poll);
    })();
  });
}

// ─── Fechas (zona RD) ────────────────────────────────────────────────
const hoyDO = () => new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));

function isoDateDO(d) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {});
  return `${p.year}-${p.month}-${p.day}`;
}

// ─── Normalización español ───────────────────────────────────────────
const normalize = s => (s || "")
  .toUpperCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/Á/g,"A").replace(/É/g,"E").replace(/Í/g,"I")
  .replace(/Ó/g,"O").replace(/Ú/g,"U").replace(/Ü/g,"U");

// ─── Refs UI ─────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const gridEl    = $("grid");
const tecladoEl = $("teclado");
const temaEl    = $("tema");
const citaEl    = $("cita");
const xpTotalEl = $("xp-total");
const rachaEl   = $("racha");
const pistaEl   = $("pista-texto");
const btnPista  = $("btn-pista");
const dotsEl    = $("progress-dots");
const wordLabel = $("word-label");
const modal     = $("modal");
const modalFin  = $("modal-fin");

// ─── Estado global ───────────────────────────────────────────────────
let sb, uid, todayISO, semanaISO, tomorrowISO;
let palabrasHoy = [];    // [{palabra, pista, cita, tema}, ...]
let wordIdx     = 0;     // índice de la palabra activa
let xpAcumulado = 0;

// ─── Estado por ronda ────────────────────────────────────────────────
let solucion    = "";
let longitud    = 5;
let intentoIdx  = 0;
let terminado   = false;
let pistasUsadas = 0;
let jugadaId    = null;  // id de la fila activa en wordle_jugadas
let keyState    = {};
let startTime   = Date.now();
const filasRef  = [];

const FILAS_TECLADO = [
  "Q W E R T Y U I O P".split(" "),
  "A S D F G H J K L Ñ".split(" "),
  ["ENTER", ..."Z X C V B N M".split(" "), "BORRAR"]
];

// ─── Auth anónima ────────────────────────────────────────────────────
async function ensureAuth() {
  const { data } = await sb.auth.getUser();
  if (!data?.user) {
    const { error } = await sb.auth.signInAnonymously();
    if (error) console.error("Auth anónima falló:", error);
  }
}

// ─────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────
(async function init() {
  try { sb = await waitForSupabase(); }
  catch (e) { alert(e.message); return; }

  await ensureAuth();
  uid = (await sb.auth.getUser()).data.user.id;

  // ── Cargar JSON ──
  let cfg;
  try { cfg = await fetch(DATA_URL, { cache: "no-store" }).then(r => r.json()); }
  catch (e) { alert("No se pudo cargar " + DATA_URL); return; }

  const hoy = hoyDO();
  todayISO  = isoDateDO(hoy);

  // tomorrowISO para queries de rango de fecha
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);
  tomorrowISO = isoDateDO(manana);

  // semana_id = domingo de esta semana
  const domingo = new Date(hoy);
  domingo.setDate(hoy.getDate() - hoy.getDay());
  semanaISO = isoDateDO(domingo);

  // ── Resolver palabras del día ──
  // Formato NUEVO: { "2026-03-15": [{palabra,pista,cita,tema},...] }
  // Formato VIEJO: { semanas: [...] }  ← compatibilidad
  if (cfg[todayISO]) {
    palabrasHoy = cfg[todayISO];
  } else if (cfg.semanas) {
    palabrasHoy = resolverDesdeFormatoViejo(cfg.semanas, hoy);
  } else {
    alert("No hay palabras para hoy en el JSON."); return;
  }

  if (!palabrasHoy.length) { alert("Array de palabras vacío para hoy."); return; }

  // ── Racha desde localStorage ──
  const lastDate  = localStorage.getItem("wb:last");
  const prevStreak = parseInt(localStorage.getItem("wb:streak") || "0", 10);
  if (lastDate && lastDate !== todayISO) {
    const diff = (hoy - new Date(lastDate)) / 86400000;
    if (diff > 2) localStorage.setItem("wb:streak", "0");
  }
  rachaEl.textContent = localStorage.getItem("wb:streak") || "0";

  // ── Consultar jugadas de hoy en Supabase ──
  // Usamos LIKE para capturar tanto "2026-03-14" como "2026-03-14T..."
  const { data: jugadas } = await sb
    .from("wordle_jugadas")
    .select("*")
    .eq("user_id", uid)
    .gte("fecha", todayISO)
    .lt("fecha", tomorrowISO);

  const completadas = (jugadas || []).filter(j => j.estado === "terminado");
  xpAcumulado = completadas.reduce((s, j) => s + (j.xp_otorgado || 0), 0);
  xpTotalEl.textContent = `+${xpAcumulado}`;

  // ── Backup en localStorage: marcar día completo ──
  // Si Supabase falla o hay mismatch de fecha, el localStorage protege
  const lsKey = `wb:done:${todayISO}`;
  if (completadas.length >= palabrasHoy.length) {
    localStorage.setItem(lsKey, "1");
  }
  const yaCompletado = localStorage.getItem(lsKey) === "1";

  // ── Buscar primera palabra pendiente ──
  wordIdx = completadas.length;
  if (wordIdx >= palabrasHoy.length || yaCompletado) {
    mostrarFinDelDia(completadas); return;
  }

  // Buscar jugada en curso para esta palabra (si el usuario cerró antes de terminar)
  const enCurso = (jugadas || []).find(
    j => j.palabra_idx === wordIdx && j.estado !== "terminado"
  ) || null;

  await cargarPalabra(wordIdx, enCurso);
})();

// ─────────────────────────────────────────────────────────────────────
// CARGAR PALABRA
// ─────────────────────────────────────────────────────────────────────
async function cargarPalabra(idx, jugadaExistente) {
  // Limpiar estado anterior
  gridEl.innerHTML   = "";
  tecladoEl.innerHTML = "";
  filasRef.length    = 0;
  keyState           = {};
  intentoIdx         = 0;
  terminado          = false;
  pistasUsadas       = 0;
  startTime          = Date.now();
  window.removeEventListener("keydown", onKey);

  pistaEl.textContent = "Pista disponible tras el 4.º intento";
  btnPista.disabled   = true;

  const item = palabrasHoy[idx];
  solucion   = normalize(item.palabra);
  longitud   = solucion.length;

  temaEl.textContent  = item.tema  || "—";
  citaEl.textContent  = "";   // ocultar cita hasta el 4.º intento
  wordLabel.textContent = `Palabra ${idx + 1} de ${palabrasHoy.length}`;
  gridEl.style.setProperty("--n", longitud);

  renderDots(idx);

  // ── Construir grilla ──
  for (let r = 0; r < MAX_INT; r++) {
    const row = document.createElement("div");
    row.className = "row";
    for (let c = 0; c < longitud; c++) {
      const t = document.createElement("div");
      t.className = "tile";
      row.appendChild(t);
    }
    gridEl.appendChild(row);
    filasRef.push(row);
  }

  renderTeclado();

  // ── Crear jugada en Supabase si no existe ──
  if (!jugadaExistente) {
    // Verificar si ya existe usando LIKE para capturar cualquier formato de fecha
    const { data: existe } = await sb.from("wordle_jugadas")
      .select("id")
      .eq("user_id",     uid)
      .gte("fecha",      todayISO)
      .lt("fecha",       tomorrowISO)
      .eq("palabra_idx", idx)
      .maybeSingle();

    if (!existe) {
      const { data: nuevaFila, error: insErr } = await sb.from("wordle_jugadas").insert({
        user_id      : uid,
        fecha        : todayISO,
        palabra_idx  : idx,
        semana_id    : semanaISO,
        palabra      : solucion,
        tema         : item.tema || "",
        cita         : item.cita || "",
        intentos     : 0,
        acierto      : false,
        pistas_usadas: 0,
        tiempo_seg   : 0,
        grid         : [],
        estado       : "en curso",
        xp_otorgado  : 0,
        wrp          : 0
      }).select("id").single();
      if (insErr) console.error("insert wordle_jugadas:", insErr);
      jugadaId = nuevaFila?.id || null;
    } else {
      jugadaId = existe.id;
    }
  } else {
    jugadaId     = jugadaExistente.id;
    intentoIdx   = jugadaExistente.intentos    || 0;
    pistasUsadas = jugadaExistente.pistas_usadas || 0;
    // Restaurar estado de pista según intentos guardados
    if (intentoIdx >= 4 && pistasUsadas === 0) {
      pistaEl.textContent = "💡 Pista disponible";
      btnPista.disabled   = false;
    } else if (pistasUsadas > 0) {
      pistaEl.textContent = `💡 ${item.pista}`;
      btnPista.disabled   = true;
    }
    // Mostrar cita si ya usó 4+ intentos en sesión anterior
    if (intentoIdx >= 4) {
      citaEl.textContent = item.cita || "";
    }
    if (jugadaExistente.grid?.length) restoreFromDB(jugadaExistente);
  }

  // Botón pista
  btnPista.onclick = () => {
    if (btnPista.disabled) return;
    pistasUsadas++;
    pistaEl.textContent = `💡 ${item.pista}`;
    btnPista.disabled   = true;
  };

  window.addEventListener("keydown", onKey);
}

// ─── Puntos de progreso ──────────────────────────────────────────────
function renderDots(completadas) {
  dotsEl.innerHTML = "";
  palabrasHoy.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "dot"
      + (i < completadas  ? " done"   : "")
      + (i === completadas ? " active" : "");
    dotsEl.appendChild(d);
  });
}

// ─── Teclado ─────────────────────────────────────────────────────────
function renderTeclado() {
  tecladoEl.innerHTML = "";
  FILAS_TECLADO.forEach(row => {
    const r = document.createElement("div");
    r.className = "krow";
    row.forEach(k => {
      const b = document.createElement("div");
      b.className = "key" + (k === "ENTER" || k === "BORRAR" ? " action" : "");
      b.textContent = k;
      b.addEventListener("click", () => pressKey(k));
      r.appendChild(b);
    });
    tecladoEl.appendChild(r);
  });
  syncKeyColors();
}

function onKey(e) {
  const k = e.key.toUpperCase();
  if (/^[A-ZÑ]$/.test(k)) pressKey(k);
  else if (k === "BACKSPACE") pressKey("BORRAR");
  else if (k === "ENTER")    pressKey("ENTER");
}

function pressKey(k) {
  if (terminado) return;
  const row   = filasRef[intentoIdx];
  if (!row) return;
  const tiles = [...row.children];

  if (k === "ENTER") {
    const word = tiles.map(t => t.textContent.replace(/[✓•×]/g,"").trim()).join("");
    if (word.length !== longitud) { shakeRow(row); return; }
    evaluar(word);
    return;
  }
  if (k === "BORRAR") {
    for (let i = longitud - 1; i >= 0; i--) {
      if (tiles[i].dataset.letter) {
        tiles[i].textContent = "";
        tiles[i].dataset.letter = "";
        tiles[i].classList.remove("filled");
        break;
      }
    }
    return;
  }
  if (/^[A-ZÑ]$/.test(k)) {
    for (let i = 0; i < longitud; i++) {
      if (!tiles[i].dataset.letter) {
        tiles[i].textContent  = k;
        tiles[i].dataset.letter = k;
        tiles[i].classList.add("filled");
        break;
      }
    }
  }
}

function shakeRow(row) {
  row.classList.add("shake");
  row.addEventListener("animationend", () => row.classList.remove("shake"), { once: true });
}

// ─── Evaluación ──────────────────────────────────────────────────────
function evaluar(guessRaw) {
  const guess = normalize(guessRaw);
  const res   = Array(longitud).fill("no");
  const count = {};
  for (const ch of solucion) count[ch] = (count[ch] || 0) + 1;

  // Primero exactas
  for (let i = 0; i < longitud; i++) {
    if (guess[i] === solucion[i]) { res[i] = "ok"; count[guess[i]]--; }
  }
  // Luego presentes
  for (let i = 0; i < longitud; i++) {
    if (res[i] !== "no") continue;
    const ch = guess[i];
    if ((count[ch] || 0) > 0) { res[i] = "mid"; count[ch]--; }
  }

  const tiles = [...filasRef[intentoIdx].children];
  tiles.forEach((tile, i) => {
    setTimeout(() => {
      tile.dataset.letter = "";
      tile.className = `tile ${res[i]} reveal`;
      tile.innerHTML = `${guess[i]}<span class="icon">${
        res[i]==="ok" ? "✓" : res[i]==="mid" ? "•" : "×"
      }</span>`;
      SND.nota(i);  // nota musical por cada tile revelado
    }, i * 80);
  });

  for (let i = 0; i < longitud; i++) {
    keyState[guess[i]] = bestState(keyState[guess[i]], res[i]);
  }
  setTimeout(() => syncKeyColors(), longitud * 80 + 60);

  // Desbloquear pista solo tras el 4.º intento (intentoIdx es 0-based, se evalúa ANTES del ++)
  if (intentoIdx >= 3 && pistasUsadas === 0) {
    pistaEl.textContent = "💡 Pista disponible";
    btnPista.disabled   = false;
  }
  // Mostrar cita bíblica tras el 4.º intento
  if (intentoIdx >= 3) {
    citaEl.textContent = palabrasHoy[wordIdx]?.cita || "";
  }

  const acierto = res.every(x => x === "ok");
  intentoIdx++;

  const delay = longitud * 80 + 160;
  if (acierto || intentoIdx === MAX_INT) {
    setTimeout(() => terminar(acierto), delay);
  } else {
    setTimeout(() => guardarParcial(), 300);
  }
}

function bestState(prev, now) {
  const p = { ok:3, mid:2, no:1, undefined:0 };
  return p[now] > p[prev] ? now : prev;
}

function syncKeyColors() {
  tecladoEl.querySelectorAll(".key").forEach(k => {
    if (k.textContent === "ENTER" || k.textContent === "BORRAR") return;
    const st = keyState[k.textContent];
    k.className = "key" + (st ? ` ${st}` : "");
  });
}

function gridToJSON() {
  const rows = [];
  for (let r = 0; r < intentoIdx; r++) {
    const tiles  = [...filasRef[r].children];
    const guess  = tiles.map(t => t.textContent.replace(/[✓•×]/g,"").slice(0,1)).join("");
    const result = tiles.map(t =>
      t.classList.contains("ok")  ? "ok"  :
      t.classList.contains("mid") ? "mid" : "no"
    );
    rows.push({ guess, result });
  }
  return rows;
}

// ─── Guardar progreso parcial ────────────────────────────────────────
async function guardarParcial() {
  if (!jugadaId) return;
  try {
    await sb.from("wordle_jugadas").update({
      intentos     : intentoIdx,
      pistas_usadas: pistasUsadas,
      tiempo_seg   : Math.round((Date.now() - startTime) / 1000),
      grid         : gridToJSON()
    })
    .eq("id", jugadaId);
  } catch (e) { console.error("guardarParcial:", e); }
}

// ─── Restaurar desde DB ──────────────────────────────────────────────
function restoreFromDB(jugada) {
  (jugada.grid || []).forEach((g, ri) => {
    if (!filasRef[ri]) return;
    const letters = (g.guess || "").split("");
    [...filasRef[ri].children].forEach((tile, ci) => {
      const res = g.result?.[ci] || "no";
      tile.className = `tile ${res}`;
      tile.innerHTML = `${letters[ci] || ""}<span class="icon">${
        res==="ok" ? "✓" : res==="mid" ? "•" : "×"
      }</span>`;
      if (letters[ci]) keyState[letters[ci]] = bestState(keyState[letters[ci]], res);
    });
  });
  syncKeyColors();
}

// ─────────────────────────────────────────────────────────────────────
// TERMINAR UNA PALABRA
// ─────────────────────────────────────────────────────────────────────
async function terminar(acierto) {
  terminado = true;
  window.removeEventListener("keydown", onKey);

  // ── Sonido de resultado ──
  if (acierto) {
    SND.play(intentoIdx <= 2 ? "resultado_alto" : "resultado_medio", 0.9);
  } else {
    SND.play("resultado_bajo", 0.8);
  }

  // ── Calcular XP ──
  let xp = 0;
  if (acierto) {
    xp = 10;
    if (intentoIdx <= 2) xp += 8;       // muy rápido
    else if (intentoIdx <= 3) xp += 5;  // rápido
    else if (intentoIdx <= 4) xp += 2;  // normal
    if (pistasUsadas === 0) xp += 3;    // sin pista
  }
  const wrp = xp * 4;

  xpAcumulado += xp;
  xpTotalEl.textContent = `+${xpAcumulado}`;

  // ── Racha ──
  const streak = parseInt(localStorage.getItem("wb:streak") || "0", 10);
  const newStreak = acierto ? streak + 1 : 0;
  localStorage.setItem("wb:streak", String(newStreak));
  localStorage.setItem("wb:last",   todayISO);
  rachaEl.textContent = String(newStreak);

  // ── Guardar en Supabase ──
  try {
    await sb.from("wordle_jugadas").update({
      intentos     : intentoIdx,
      acierto,
      pistas_usadas: pistasUsadas,
      tiempo_seg   : Math.round((Date.now() - startTime) / 1000),
      grid         : gridToJSON(),
      xp_otorgado  : xp,
      wrp,
      estado       : "terminado"
    })
    .eq("id", jugadaId);
  } catch (e) { console.error("terminar:", e); }

  // ── Modal ──
  const esUltima = wordIdx >= palabrasHoy.length - 1;

  $("modal-emoji").textContent = acierto
    ? (intentoIdx <= 2 ? "🔥" : "🎉") : "📖";

  $("modal-title").textContent = acierto
    ? (intentoIdx <= 2 ? "¡Increíble!" : intentoIdx <= 3 ? "¡Excelente!" : "¡Correcto!")
    : `Respuesta: ${palabrasHoy[wordIdx].palabra}`;

  $("modal-body").textContent = acierto
    ? `Resolviste en ${intentoIdx} ${intentoIdx === 1 ? "intento" : "intentos"}.${pistasUsadas ? "" : " Sin pista 🏅"}`
    : `La palabra era "${palabrasHoy[wordIdx].palabra}". ¡Mañana va mejor!`;

  $("m-xp").textContent       = `+${xp}`;
  $("m-intentos").textContent = intentoIdx;
  $("m-racha").textContent    = newStreak;

  const btn = $("modal-btn");
  if (esUltima) {
    // Marcar día completo en localStorage como backup
    localStorage.setItem(`wb:done:${todayISO}`, "1");
    btn.textContent = "Ver resumen del día 🏆";
    btn.onclick = () => {
      modal.classList.add("hidden");
      mostrarFinDelDia(null);
    };
  } else {
    btn.textContent = `Siguiente palabra (${wordIdx + 2}/${palabrasHoy.length}) →`;
    btn.onclick = async () => {
      modal.classList.add("hidden");
      wordIdx++;
      await cargarPalabra(wordIdx, null);
    };
  }

  modal.classList.remove("hidden");
}

// ─── Fin del día ─────────────────────────────────────────────────────
function mostrarFinDelDia(jugadas) {
  const xpFinal = jugadas
    ? jugadas.reduce((s, j) => s + (j.xp_otorgado || 0), 0)
    : xpAcumulado;
  $("fin-body").textContent =
    `Completaste las ${palabrasHoy.length} palabras de hoy. ` +
    `Total XP ganado: +${xpFinal} 🎖️`;
  modalFin.classList.remove("hidden");
}

// ─────────────────────────────────────────────────────────────────────
// COMPATIBILIDAD CON FORMATO ANTERIOR
// ─────────────────────────────────────────────────────────────────────
function resolverDesdeFormatoViejo(semanas, hoy) {
  const dow = hoy.getDay(); // 0=dom
  const domFecha = new Date(hoy);
  domFecha.setDate(domFecha.getDate() - dow);
  domFecha.setHours(0,0,0,0);
  const domISO = isoDateDO(domFecha);

  const semana = semanas.find(s => s.domingo === domISO)
    || [...semanas]
        .filter(s => s.domingo <= domISO)
        .sort((a,b) => b.domingo.localeCompare(a.domingo))[0]
    || semanas[0];

  const item = semana.dias?.find(d => d.dow === dow) || semana.dias?.[0];
  if (!item) return [];

  const base = [{ palabra: item.palabra, pista: item.pista, cita: item.cita, tema: semana.tema }];

  // Si es domingo y hay extras en el viejo formato
  if (dow === 0 && semana.domingoExtra?.length) {
    return [...base, ...semana.domingoExtra.map(e => ({
      palabra: e.palabra, pista: e.pista, cita: e.cita, tema: semana.tema
    }))];
  }
  return base;
}
