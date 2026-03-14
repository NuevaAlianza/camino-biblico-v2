// =============================================================================
// quiz.js — Camino Bíblico v2
// Quiz unificado — Modo Arena con Mundos y Niveles
// Reemplaza: quiz.js, rpg.js, rpg2.js, trivia-flash.js, reto-vs.js,
//            temporada.js, aleatorio.js
// Fuente de datos: Supabase (tablas mundos, niveles, preguntas, progreso_usuario)
// =============================================================================

// ─── Config ──────────────────────────────────────────────────────────────────
const VIDAS_INICIAL = 3;
const MENTOR = {
  neutral  : "🧙",
  happy    : "😄",
  fire     : "🤩",
  sad      : "😔",
  thinking : "🤔",
  victory  : "🎉",
};
const MSGS = {
  happy   : ["¡Correcto! 🎉", "¡Muy bien!", "¡Exacto!", "¡Sigue así!"],
  fire    : ["¡En racha! 🔥", "¡Imparable!", "¡Increíble!"],
  sad     : ["Casi... 📖", "Eso se aprende", "Recuerda este versículo"],
  neutral : ["Piensa bien...", "Tómate tu tiempo", "¿Cuál crees tú?"],
};

// ─── Estado global ────────────────────────────────────────────────────────────
let sb, uid;
let worlds       = [];
let activeWorld  = null;
let activeLevel  = null;
let questions    = [];
let qi           = 0;
let vidas        = VIDAS_INICIAL;
let xp           = 0;
let streak       = 0;
let maxStreak    = 0;
let correctas    = 0;
let answered     = false;
let userProgress = {};   // { nivel_id: { estrellas, completado, xp } }

// ─── Helpers UI ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(`screen-${name}`).classList.add("active");
}
function setLoading(msg, pct) {
  $("loading-msg").textContent = msg;
  $("loading-progress").style.width = pct + "%";
}
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ─── Auth ─────────────────────────────────────────────────────────────────────
function waitForSupabase(ms = 5000) {
  return new Promise((res, rej) => {
    const t0 = Date.now();
    (function poll() {
      if (window.supabase) return res(window.supabase);
      if (Date.now() - t0 > ms) return rej(new Error("Supabase no cargó"));
      requestAnimationFrame(poll);
    })();
  });
}
async function ensureAuth() {
  const { data } = await sb.auth.getUser();
  if (!data?.user) await sb.auth.signInAnonymously();
}

// =============================================================================
// INIT
// =============================================================================
(async function init() {
  showScreen("loading");
  try {
    sb = await waitForSupabase();
  } catch (e) { alert(e.message); return; }

  setLoading("Autenticando...", 15);
  await ensureAuth();
  uid = (await sb.auth.getUser()).data.user.id;

  setLoading("Cargando mundos...", 35);
  await loadWorlds();

  setLoading("Cargando progreso...", 65);
  await loadUserProgress();

  setLoading("¡Listo!", 100);
  setTimeout(() => {
    renderWorldMap();
    showScreen("map");
  }, 300);
})();

// =============================================================================
// CARGA DE DATOS
// =============================================================================
async function loadWorlds() {
  const { data: wData, error: wErr } = await sb
    .from("mundos")
    .select("*, niveles(*)")
    .eq("activo", true)
    .order("orden");

  if (wErr) { console.error("Error cargando mundos:", wErr); worlds = []; return; }
  worlds = wData || [];
}

async function loadUserProgress() {
  const { data } = await sb
    .from("progreso_usuario")
    .select("*")
    .eq("user_id", uid);

  userProgress = {};
  (data || []).forEach(p => {
    userProgress[p.nivel_id] = {
      estrellas : p.estrellas || 0,
      completado: p.completado || false,
      xp        : p.xp || 0,
    };
  });

  // XP total y estrellas totales para el header
  const totalXP    = Object.values(userProgress).reduce((s, p) => s + p.xp, 0);
  const totalStars = Object.values(userProgress).reduce((s, p) => s + p.estrellas, 0);
  $("total-xp").textContent    = totalXP;
  $("total-stars").textContent = totalStars;
}

async function loadLevelQuestions(levelId) {
  const { data, error } = await sb
    .from("preguntas")
    .select("id, pregunta, respuesta_correcta, distractores, categoria, subcategoria, dificultad, puntos")
    .eq("nivel_id", levelId)
    .eq("activo", true)
    .order("orden");

  if (error) { console.error("Error cargando preguntas:", error); return []; }

  // Convertir formato DB real al formato interno
  // DB: respuesta_correcta = texto completo, distractores = "op1|op2|op3"
  return (data || []).map(q => parseQuestion(q)).sort(() => Math.random() - 0.5);
}

// Convierte formato DB → formato interno con opcion_a/b/c/d
// La tabla existente usa: respuesta_correcta=texto, distractores=texto separado por |
function parseQuestion(q) {
  const correct = (q.respuesta_correcta || "").trim();
  const raw     = (q.distractores || "").trim();

  // Detectar separador
  let wrong = [];
  if      (raw.includes("|"))  wrong = raw.split("|");
  else if (raw.includes(";;")) wrong = raw.split(";;");
  else if (raw.includes("\n")) wrong = raw.split("\n");
  else if (raw)                wrong = [raw];
  wrong = wrong.map(s => s.trim()).filter(Boolean);

  // Mezclar opciones
  const pool = [correct, ...wrong.slice(0, 3)].filter(Boolean);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Asignar letras y detectar correcta
  const letras = ["a","b","c","d"];
  const out    = { ...q, referencia: q.subcategoria || q.categoria || "" };
  let   corrLetter = "a";
  pool.slice(0, 4).forEach((opt, i) => {
    out[`opcion_${letras[i]}`] = opt;
    if (opt === correct) corrLetter = letras[i];
  });
  out.respuesta_correcta = corrLetter;
  return out;
}

// =============================================================================
// MAPA DE MUNDOS
// =============================================================================
function renderWorldMap() {
  const container = $("worlds-list");
  container.innerHTML = "";

  if (!worlds.length) {
    container.innerHTML = `<div class="empty-state">
      <div style="font-size:48px">📖</div>
      <p>No hay mundos disponibles todavía.<br>Vuelve pronto.</p>
    </div>`;
    return;
  }

  worlds.forEach((world, wi) => {
    const niveles    = world.niveles || [];
    const completados = niveles.filter(n => userProgress[n.id]?.completado).length;
    const estrellasMundo = niveles.reduce((s, n) => s + (userProgress[n.id]?.estrellas || 0), 0);
    const maxEstrellas   = niveles.length * 3;
    const pct = niveles.length ? (completados / niveles.length) : 0;

    // Desbloquear: primer mundo siempre libre; los demás cuando el anterior está 100%
    const prevWorld      = worlds[wi - 1];
    const prevCompleted  = !prevWorld || (prevWorld.niveles || []).every(n => userProgress[n.id]?.completado);
    const desbloqueado   = world.desbloqueado && prevCompleted;

    const card = document.createElement("div");
    card.className = `world-card${desbloqueado ? "" : " locked"}`;
    card.style.setProperty("--wcolor", world.color || "#22C55E");
    card.innerHTML = `
      <div class="world-icon">${desbloqueado ? (world.emoji || "🌍") : "🔒"}</div>
      <div class="world-info">
        <div class="world-name">Mundo ${world.orden}: ${world.nombre}</div>
        <div class="world-desc">${world.descripcion || ""}</div>
        ${desbloqueado ? `
          <div class="world-bar-wrap">
            <div class="world-bar"><div style="width:${pct*100}%"></div></div>
            <span class="world-bar-label">${completados}/${niveles.length} · ${estrellasMundo}/${maxEstrellas}⭐</span>
          </div>` : `<div class="world-desc locked-msg">Completa el mundo anterior para desbloquear</div>`}
      </div>
      <div class="world-arrow">${desbloqueado ? "›" : ""}</div>
    `;
    if (desbloqueado) card.addEventListener("click", () => openWorld(world));
    container.appendChild(card);
  });
}

// =============================================================================
// MAPA DE NIVELES
// =============================================================================
function openWorld(world) {
  activeWorld = world;
  const header = $("level-header");
  header.style.setProperty("--wcolor", world.color || "#22C55E");
  $("level-world-title").textContent = `${world.emoji || ""} ${world.nombre}`;
  $("level-world-desc").textContent  = world.descripcion || "";

  renderLevels(world.niveles || []);
  showScreen("levels");
}

function renderLevels(niveles) {
  const container = $("levels-list");
  container.innerHTML = "";

  niveles.forEach((nivel, ni) => {
    const prog        = userProgress[nivel.id];
    const completado  = prog?.completado || false;
    const estrellas   = prog?.estrellas  || 0;
    const prevNivel   = niveles[ni - 1];
    const desbloqueado = ni === 0 || userProgress[prevNivel?.id]?.completado;
    const tienePre    = nivel.preguntas_count > 0 || true; // siempre mostrar

    const card = document.createElement("div");
    card.className = `level-card${completado ? " done" : ""}${!desbloqueado ? " locked" : ""}`;
    card.style.setProperty("--wcolor", activeWorld.color || "#22C55E");
    card.innerHTML = `
      <div class="level-icon">${!desbloqueado ? "🔒" : (nivel.emoji || "📖")}</div>
      <div class="level-info">
        <div class="level-name">Nivel ${ni + 1}: ${nivel.nombre}</div>
        <div class="level-meta">${completado ? "Completado ✓" : (desbloqueado ? "Listo para jugar" : "Bloqueado")}</div>
      </div>
      <div class="level-stars">
        ${[1,2,3].map(s => `<span class="star${s <= estrellas ? " lit" : ""}">⭐</span>`).join("")}
      </div>
    `;
    if (desbloqueado) card.addEventListener("click", () => startLevel(nivel));
    container.appendChild(card);
  });
}

// =============================================================================
// JUEGO — INICIO
// =============================================================================
async function startLevel(nivel) {
  activeLevel = nivel;
  showScreen("loading");
  setLoading("Cargando preguntas...", 50);

  questions = await loadLevelQuestions(nivel.id);
  if (!questions.length) {
    alert("Este nivel no tiene preguntas todavía. ¡Pronto estará listo!");
    showScreen("levels");
    return;
  }

  // Resetear estado
  qi        = 0;
  vidas     = VIDAS_INICIAL;
  xp        = 0;
  streak    = 0;
  maxStreak = 0;
  correctas = 0;
  answered  = false;

  setLoading("¡A jugar!", 100);
  setTimeout(() => {
    showScreen("game");
    renderQuestion();
  }, 250);

  // Botón salir
  $("btn-quit").onclick = () => {
    if (confirm("¿Abandonar el nivel? Perderás el progreso de esta partida.")) {
      showScreen("levels");
    }
  };
}

// =============================================================================
// JUEGO — PREGUNTA
// =============================================================================
function renderQuestion() {
  answered = false;
  $("answer-footer").classList.add("hidden");
  $("streak-badge").classList.add("hidden");

  const q   = questions[qi];
  const pct = ((qi) / questions.length) * 100;

  $("game-progress-bar").style.width = pct + "%";
  $("game-q-counter").textContent    = `${qi + 1}/${questions.length}`;
  $("game-xp").textContent           = `${xp} XP`;
  $("q-category").textContent        = q.categoria || activeLevel?.nombre || "";
  $("q-text").textContent            = q.pregunta;

  // Vidas
  $("lives-display").innerHTML = [0,1,2].map(i =>
    `<span class="life${i < vidas ? " active" : ""}">❤️</span>`
  ).join("");

  // Mentor neutral
  setMentor("neutral", "");

  // Construir opciones
  const grid  = $("options-grid");
  grid.innerHTML = "";
  const opts  = [
    { text: q.opcion_a, idx: 0 },
    { text: q.opcion_b, idx: 1 },
    { text: q.opcion_c, idx: 2 },
    { text: q.opcion_d, idx: 3 },
  ].filter(o => o.text); // solo opciones con texto

  // Ajustar grid según cantidad de opciones
  grid.className = `options-grid opts-${opts.length}`;

  const correctIdx = ["a","b","c","d"].indexOf(q.respuesta_correcta?.toLowerCase());

  opts.forEach(({ text, idx }) => {
    const btn = document.createElement("button");
    btn.className  = "opt-btn";
    btn.dataset.idx = idx;
    btn.innerHTML  = `<span class="opt-letter">${["A","B","C","D"][idx]}</span><span class="opt-text">${text}</span>`;
    btn.addEventListener("click", () => pickAnswer(btn, idx, correctIdx, q.referencia));
    grid.appendChild(btn);
  });

  // Animación entrada
  $("question-card").classList.remove("enter");
  requestAnimationFrame(() => $("question-card").classList.add("enter"));
}

function pickAnswer(btn, chosen, correct, ref) {
  if (answered) return;
  answered = true;

  const isCorrect = chosen === correct;
  const allBtns   = $("options-grid").querySelectorAll(".opt-btn");

  // Colorear opciones
  allBtns.forEach(b => {
    const i = parseInt(b.dataset.idx);
    if (i === correct) {
      b.classList.add("correct");
    } else if (i === chosen && !isCorrect) {
      b.classList.add("wrong");
    } else {
      b.classList.add("dim");
    }
    b.disabled = true;
  });

  // XP y racha
  if (isCorrect) {
    correctas++;
    streak++;
    if (streak > maxStreak) maxStreak = streak;
    const bonus = streak >= 3 ? 20 : streak >= 2 ? 15 : 10;
    xp += bonus;

    const mentorState = streak >= 3 ? "fire" : "happy";
    setMentor(mentorState, rand(MSGS[mentorState]));

    if (streak >= 2) {
      $("streak-badge").classList.remove("hidden");
      $("streak-num").textContent = streak;
    }
  } else {
    vidas--;
    streak = 0;
    setMentor("sad", rand(MSGS.sad));
    $("lives-display").querySelectorAll(".life").forEach((l, i) => {
      if (i >= vidas) l.classList.add("lost");
    });
  }

  $("game-xp").textContent = `${xp} XP`;

  // Footer con referencia
  $("ref-line").textContent  = ref ? `📖 ${ref}` : "";
  $("answer-footer").classList.remove("hidden");

  const isLast = qi >= questions.length - 1;
  const noLives = vidas <= 0;

  $("btn-next").textContent = (isLast || noLives)
    ? "Ver resultado 🏆"
    : "Siguiente →";

  $("btn-next").onclick = () => {
    if (isLast || noLives) {
      finishLevel();
    } else {
      qi++;
      renderQuestion();
    }
  };
}

function setMentor(state, msg) {
  $("mentor-emoji").textContent = MENTOR[state] || "🧙";
  $("mentor-msg").textContent   = msg || "";
}

// =============================================================================
// JUEGO — FINALIZAR NIVEL
// =============================================================================
async function finishLevel() {
  const total     = questions.length;
  const estrellas = calcEstrellas(correctas, total, vidas);
  const prevProg  = userProgress[activeLevel.id];
  const bestEst   = Math.max(estrellas, prevProg?.estrellas || 0);

  // Guardar en Supabase
  try {
    await sb.from("progreso_usuario").upsert({
      user_id   : uid,
      nivel_id  : activeLevel.id,
      mundo_id  : activeWorld.id,
      estrellas : bestEst,
      completado: estrellas > 0,
      xp        : Math.max(xp, prevProg?.xp || 0),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,nivel_id" });
  } catch (e) { console.error("Error guardando progreso:", e); }

  // Actualizar cache local
  userProgress[activeLevel.id] = { estrellas: bestEst, completado: estrellas > 0, xp };

  // Modal resultado
  const emoji    = ["😔","📖","👍","🏆"][estrellas];
  const titulo   = ["Sin estrellas","¡Bien!","¡Excelente!","¡Perfecto!"][estrellas];
  const cuerpo   = estrellas === 0
    ? `Respondiste ${correctas} de ${total}. ¡Intenta de nuevo!`
    : `Respondiste ${correctas} de ${total} correctas.${vidas > 0 ? "" : " Sin vidas restantes."}`;

  $("res-emoji").textContent   = emoji;
  $("res-title").textContent   = titulo;
  $("res-body").textContent    = cuerpo;
  $("r-xp").textContent        = xp;
  $("r-correct").textContent   = `${correctas}/${total}`;
  $("r-streak").textContent    = maxStreak;

  // Estrellas
  $("res-stars").innerHTML = [1,2,3].map(s =>
    `<span class="res-star${s <= estrellas ? " lit" : ""}" 
     style="animation-delay:${(s-1)*0.15}s">⭐</span>`
  ).join("");

  $("btn-retry").onclick   = () => {
    $("modal-result").classList.add("hidden");
    startLevel(activeLevel);
  };
  $("btn-continue").onclick = () => {
    $("modal-result").classList.add("hidden");
    // Actualizar UI del mapa
    loadUserProgress().then(() => {
      renderLevels(activeWorld.niveles || []);
      renderWorldMap();
      showScreen("levels");
    });
  };

  $("modal-result").classList.remove("hidden");
}

function calcEstrellas(correctas, total, vidas) {
  const pct = correctas / total;
  if (pct < 0.5) return 0;
  if (pct < 0.7) return 1;
  if (pct < 0.9 || vidas === 0) return 2;
  return 3;
}
