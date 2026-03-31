// =====================================================================
// wordle.js  — Camino Bíblico v2
// Multi-palabra por día: 5 de lun-sáb, 7 los domingos
// Modo invitado: ?invitado=1 → usa palabras de ayer, sin login, sin saves
// Pista: disponible solo en el ÚLTIMO intento (intento 6)
// =====================================================================

// ─── localStorage seguro ─────────────────────────────────────────────
const LS = {
  get(k, def = null) {
    try { const v = localStorage.getItem(k); return v !== null ? v : def; }
    catch(e) { return def; }
  },
  set(k, v) { try { localStorage.setItem(k, v); } catch(e) {} },
  del(k)    { try { localStorage.removeItem(k); } catch(e) {} }
};

const TZ       = "America/Santo_Domingo";
const MAX_INT  = 6;
const DATA_URL = "datos/wordle-semanas.json";

// ─── Modo invitado ────────────────────────────────────────────────────
// ?invitado=1 activa modo sin login. Usa palabras de ayer para evitar trampas.
const ES_INVITADO = new URLSearchParams(location.search).get("invitado") === "1";

// ─── Sound Manager ────────────────────────────────────────────────────
const SND = {
  _cache: {},
  _muted: LS.get("cb:muted") === "1",
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
let palabrasHoy = [];
let wordIdx     = 0;
let xpAcumulado = 0;

// ─── Estado por ronda ────────────────────────────────────────────────
let solucion     = "";
let longitud     = 5;
let intentoIdx   = 0;
let terminado    = false;
let pistasUsadas = 0;
let jugadaId     = null;
let keyState     = {};
let startTime    = Date.now();
const filasRef   = [];

const FILAS_TECLADO = [
  "Q W E R T Y U I O P".split(" "),
  "A S D F G H J K L Ñ".split(" "),
  ["ENTER", ..."Z X C V B N M".split(" "), "BORRAR"]
];

// ─── Banner modo invitado ─────────────────────────────────────────────
function mostrarBannerInvitado() {
  if (!ES_INVITADO) return;
  const banner = document.createElement("div");
  banner.style.cssText = `
    background: rgba(168,85,247,0.12);
    border: 1px solid rgba(168,85,247,0.35);
    border-radius: 10px;
    padding: 8px 14px;
    font-size: 12px;
    color: #c084fc;
    text-align: center;
    margin: 8px 0 4px;
  `;
  banner.textContent = "👤 Modo invitado — jugando con las palabras de ayer · El progreso no se guarda";
  const header = document.querySelector(".header") || document.querySelector(".meta-card");
  if (header) header.insertAdjacentElement("afterend", banner);
}

// ─── Auth ─────────────────────────────────────────────────────────────
async function ensureAuth() {
  if (ES_INVITADO) return;   // sin login en modo invitado
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
  mostrarBannerInvitado();

  // En modo invitado no necesitamos Supabase para jugar
  if (!ES_INVITADO) {
    try { sb = await waitForSupabase(); }
    catch (e) { alert(e.message); return; }
    await ensureAuth();
    uid = (await sb.auth.getUser()).data.user.id;
  }

  // ── Cargar JSON ──
  let cfg;
  try { cfg = await fetch(DATA_URL, { cache: "no-store" }).then(r => r.json()); }
  catch (e) { alert("No se pudo cargar " + DATA_URL); return; }

  const hoy = hoyDO();

  // MODO INVITADO: usa las palabras de ayer para evitar trampas
  const fechaJuego = ES_INVITADO
    ? (() => { const a = new Date(hoy); a.setDate(hoy.getDate() - 1); return a; })()
    : hoy;

  todayISO    = isoDateDO(fechaJuego);
  const manana = new Date(fechaJuego);
  manana.setDate(fechaJuego.getDate() + 1);
  tomorrowISO = isoDateDO(manana);

  // semana_id = domingo de la semana del día de juego
  const domingo = new Date(fechaJuego);
  domingo.setDate(fechaJuego.getDate() - fechaJuego.getDay());
  semanaISO = isoDateDO(domingo);

  // ── Resolver palabras ──
  if (cfg[todayISO]) {
    palabrasHoy = cfg[todayISO];
  } else if (cfg.semanas) {
    palabrasHoy = resolverDesdeFormatoViejo(cfg.semanas, fechaJuego);
  } else {
    alert("No hay palabras disponibles en el JSON."); return;
  }

  if (!palabrasHoy.length) { alert("Array de palabras vacío."); return; }

  // ── Racha (solo usuarios registrados) ──
  if (!ES_INVITADO) {
    const lastDate   = LS.get("wb:last");
    const hoyRealISO = isoDateDO(hoy);
    if (lastDate && lastDate !== hoyRealISO) {
      const diff = (hoy - new Date(lastDate)) / 86400000;
      if (diff > 2) LS.set("wb:streak", "0");
    }
    rachaEl.textContent = LS.get("wb:streak") || "0";
  } else {
    rachaEl.textContent = "—";
    xpTotalEl.textContent = "—";
  }

  // ── Modo invitado: siempre empieza desde la primera palabra ──
  if (ES_INVITADO) {
    wordIdx = 0;
    await cargarPalabra(wordIdx, null);
    return;
  }

  // ── Consultar jugadas del día en Supabase ──
  const { data: jugadas } = await sb
    .from("wordle_jugadas")
    .select("*")
    .eq("user_id", uid)
    .gte("fecha", todayISO)
    .lt("fecha", tomorrowISO);

  const completadas = (jugadas || []).filter(j => j.estado === "terminado");
  xpAcumulado = completadas.reduce((s, j) => s + (j.xp_otorgado || 0), 0);
  xpTotalEl.textContent = `+${xpAcumulado}`;

  const lsKey = `wb:done:${todayISO}`;
  if (completadas.length >= palabrasHoy.length) LS.set(lsKey, "1");
  const yaCompletado = LS.get(lsKey) === "1";

  wordIdx = completadas.length;
  if (wordIdx >= palabrasHoy.length || yaCompletado) {
    mostrarFinDelDia(completadas); return;
  }

  const enCurso = (jugadas || []).find(
    j => j.palabra_idx === wordIdx && j.estado !== "terminado"
  ) || null;

  await cargarPalabra(wordIdx, enCurso);
})();

// ─────────────────────────────────────────────────────────────────────
// CARGAR PALABRA
// ─────────────────────────────────────────────────────────────────────
async function cargarPalabra(idx, jugadaExistente) {
  gridEl.innerHTML    = "";
  tecladoEl.innerHTML = "";
  filasRef.length     = 0;
  keyState            = {};
  intentoIdx          = 0;
  terminado           = false;
  pistasUsadas        = 0;
  startTime           = Date.now();
  window.removeEventListener("keydown", onKey);

  pistaEl.textContent = "💡 Pista disponible en el último intento";
  btnPista.disabled   = true;

  const item = palabrasHoy[idx];
  solucion   = normalize(item.palabra);
  longitud   = solucion.length;

  temaEl.textContent    = item.tema || "—";
  citaEl.textContent    = "";  // se revela en el último intento
  wordLabel.textContent = `Palabra ${idx + 1} de ${palabrasHoy.length}`;
  gridEl.style.setProperty("--n", longitud);

  renderDots(idx);

  // Construir grilla
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

  // ── Modo invitado: no crea jugada en DB ──
  if (ES_INVITADO) {
    jugadaId = null;
    window.addEventListener("keydown", onKey);
    return;
  }

  // ── Crear/recuperar jugada en Supabase ──
  if (!jugadaExistente) {
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

    // Restaurar estado de pista: disponible SOLO si ya hizo 5 intentos (para el 6to)
    if (intentoIdx >= 5 && pistasUsadas === 0) {
      pistaEl.textContent = "💡 Pista disponible — último intento";
      btnPista.disabled   = false;
    } else if (pistasUsadas > 0) {
      pistaEl.textContent = `💡 ${item.pista}`;
      btnPista.disabled   = true;
    }
    // Mostrar cita si ya estaba en el último intento
    if (intentoIdx >= 5) {
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
        tiles[i].textContent    = k;
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

  for (let i = 0; i < longitud; i++) {
    if (guess[i] === solucion[i]) { res[i] = "ok"; count[guess[i]]--; }
  }
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
      SND.nota(i);
    }, i * 80);
  });

  for (let i = 0; i < longitud; i++) {
    keyState[guess[i]] = bestState(keyState[guess[i]], res[i]);
  }
  setTimeout(() => syncKeyColors(), longitud * 80 + 60);

  // ── Pista: se desbloquea SOLO antes del ÚLTIMO intento (intento 5, índice 4) ──
  // intentoIdx es 0-based y se evalúa ANTES del ++
  // intentoIdx === 4 → acabamos de evaluar el 5.º intento → falta el 6.º (último)
  if (intentoIdx === 4 && pistasUsadas === 0) {
    pistaEl.textContent = "💡 Pista disponible — último intento";
    btnPista.disabled   = false;
  }

  // Mostrar cita bíblica también en el último intento
  if (intentoIdx === 4) {
    citaEl.textContent = palabrasHoy[wordIdx]?.cita || "";
  }

  const acierto = res.every(x => x === "ok");
  intentoIdx++;

  const delay = longitud * 80 + 160;
  if (acierto || intentoIdx === MAX_INT) {
    setTimeout(() => terminar(acierto), delay);
  } else {
    if (!ES_INVITADO) setTimeout(() => guardarParcial(), 300);
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
  if (!jugadaId || ES_INVITADO) return;
  try {
    await sb.from("wordle_jugadas").update({
      intentos     : intentoIdx,
      pistas_usadas: pistasUsadas,
      tiempo_seg   : Math.round((Date.now() - startTime) / 1000),
      grid         : gridToJSON()
    }).eq("id", jugadaId);
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

  if (acierto) {
    SND.play(intentoIdx <= 2 ? "resultado_alto" : "resultado_medio", 0.9);
  } else {
    SND.play("resultado_bajo", 0.8);
  }

  // ── XP (no se guarda en modo invitado pero sí se muestra) ──
  let xp = 0;
  if (acierto) {
    xp = 10;
    if (intentoIdx <= 2)      xp += 8;
    else if (intentoIdx <= 3) xp += 5;
    else if (intentoIdx <= 4) xp += 2;
    if (pistasUsadas === 0)   xp += 3;
  }
  const wrp = xp * 4;

  xpAcumulado += xp;
  if (!ES_INVITADO) xpTotalEl.textContent = `+${xpAcumulado}`;

  // ── Racha (solo usuarios registrados) ──
  let newStreak = 0;
  if (!ES_INVITADO) {
    const streak = parseInt(LS.get("wb:streak") || "0", 10);
    newStreak = acierto ? streak + 1 : 0;
    LS.set("wb:streak", String(newStreak));
    LS.set("wb:last",   isoDateDO(hoyDO()));
    rachaEl.textContent = String(newStreak);
  }

  // ── Guardar en Supabase (solo registrados) ──
  if (!ES_INVITADO) {
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
      }).eq("id", jugadaId);
    } catch (e) { console.error("terminar:", e); }
  }

  // ── Modal ──
  const esUltima = wordIdx >= palabrasHoy.length - 1;

  $("modal-emoji").textContent = acierto
    ? (intentoIdx <= 2 ? "🔥" : "🎉") : "📖";

  $("modal-title").textContent = acierto
    ? (intentoIdx <= 2 ? "¡Increíble!" : intentoIdx <= 3 ? "¡Excelente!" : "¡Correcto!")
    : `Respuesta: ${palabrasHoy[wordIdx].palabra}`;

  $("modal-body").textContent = ES_INVITADO
    ? (acierto
        ? `¡Resolviste en ${intentoIdx} intento${intentoIdx===1?'':'s'}! (Modo invitado)`
        : `La palabra era "${palabrasHoy[wordIdx].palabra}". Inicia sesión para guardar tu progreso.`)
    : (acierto
        ? `Resolviste en ${intentoIdx} ${intentoIdx===1?"intento":"intentos"}.${pistasUsadas?"":' Sin pista 🏅'}`
        : `La palabra era "${palabrasHoy[wordIdx].palabra}". ¡Mañana va mejor!`);

  $("m-xp").textContent       = `+${xp}`;
  $("m-intentos").textContent = intentoIdx;
  $("m-racha").textContent    = ES_INVITADO ? "—" : newStreak;

  const btn = $("modal-btn");
  if (esUltima) {
    if (!ES_INVITADO) LS.set(`wb:done:${todayISO}`, "1");
    btn.textContent = ES_INVITADO ? "¡Gracias por jugar! 🙏" : "Ver resumen del día 🏆";
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

  const totalPalabras = palabrasHoy.length;

  if (ES_INVITADO) {
    $("fin-body").textContent =
      `Completaste las ${totalPalabras} palabras. ¡Inicia sesión para guardar tu progreso y competir en el ranking!`;
  } else {
    $("fin-body").textContent =
      `Completaste las ${totalPalabras} palabras de hoy. Total XP ganado: +${xpFinal} 🎖️`;
  }
  modalFin.classList.remove("hidden");
}

// ─────────────────────────────────────────────────────────────────────
// COMPATIBILIDAD CON FORMATO ANTERIOR
// Nuevo formato esperado del JSON:
// {
//   "2026-03-16": [{palabra,pista,cita,tema}, ...],  ← 5 items lun-sáb
//   "2026-03-22": [{...}, ...],                      ← 7 items domingo
// }
// ─────────────────────────────────────────────────────────────────────
function resolverDesdeFormatoViejo(semanas, fecha) {
  const dow = fecha.getDay(); // 0=dom
  const domFecha = new Date(fecha);
  domFecha.setDate(domFecha.getDate() - dow);
  domFecha.setHours(0,0,0,0);
  const domISO = isoDateDO(domFecha);

  const semana = semanas.find(s => s.domingo === domISO)
    || [...semanas]
        .filter(s => s.domingo <= domISO)
        .sort((a,b) => b.domingo.localeCompare(a.domingo))[0]
    || semanas[0];

  // Si la semana tiene array palabras_dia (nuevo formato embebido en semana vieja)
  if (semana.palabras_dia?.[dow]) {
    return semana.palabras_dia[dow];
  }

  // Formato original simple: un objeto por día
  const item = semana.dias?.find(d => d.dow === dow) || semana.dias?.[0];
  if (!item) return [];

  const base = [{ palabra: item.palabra, pista: item.pista, cita: item.cita, tema: semana.tema }];

  if (dow === 0 && semana.domingoExtra?.length) {
    return [...base, ...semana.domingoExtra.map(e => ({
      palabra: e.palabra, pista: e.pista, cita: e.cita, tema: semana.tema
    }))];
  }
  return base;
}
