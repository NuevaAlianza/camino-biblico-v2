// =============================================================================
// junior.js — Camino Bíblico v2 · Versión Junior (5–10 años)
// - 3 opciones por pregunta
// - Sin tiempo, sin penalización
// - Confetti al acertar
// - Banco propio en Supabase (tabla: preguntas_junior)
// =============================================================================

const CONFETTI_COLORS = ["#38BDF8","#F59E0B","#22C55E","#A855F7","#FF6B6B","#FFD700"];

let sb, uid;
let worlds    = [];
let activeWorld = null;
let questions = [];
let qi        = 0;
let score     = 0;
let answered  = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(`screen-${name}`).classList.add("active");
}

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
  try { sb = await waitForSupabase(); }
  catch (e) { alert(e.message); return; }

  $("jr-bar-fill").style.width = "20%";
  await ensureAuth();
  uid = (await sb.auth.getUser()).data.user.id;
  $("jr-bar-fill").style.width = "50%";

  // Cargar mundos junior (tabla: mundos_junior o campo is_junior en mundos)
  const { data: wData } = await sb
    .from("mundos_junior")
    .select("*")
    .eq("activo", true)
    .order("orden");

  worlds = wData || [];
  $("jr-bar-fill").style.width = "100%";

  setTimeout(() => {
    renderWorldMenu();
    showScreen("map");
  }, 300);
})();

// =============================================================================
// MENÚ DE MUNDOS
// =============================================================================
function renderWorldMenu() {
  const container = $("jr-worlds");
  container.innerHTML = "";

  if (!worlds.length) {
    container.innerHTML = `
      <div class="jr-empty">
        <div>🌈</div>
        <p>¡Próximamente habrá historias nuevas!</p>
      </div>`;
    return;
  }

  worlds.forEach(w => {
    const card = document.createElement("div");
    card.className = "jr-world-card";
    card.style.setProperty("--jcolor", w.color || "#38BDF8");
    card.innerHTML = `
      <div class="jr-world-emoji">${w.emoji || "📖"}</div>
      <div class="jr-world-name">${w.nombre}</div>
      <div class="jr-world-q">${w.total_preguntas || "?"} preguntas</div>
    `;
    card.addEventListener("click", () => startWorld(w));
    container.appendChild(card);
  });
}

// =============================================================================
// INICIO DE MUNDO
// =============================================================================
async function startWorld(world) {
  activeWorld = world;

  showScreen("loading");
  $("jr-bar-fill").style.width = "0%";

  // Cargar preguntas del mundo
  const { data, error } = await sb
    .from("preguntas_junior")
    .select("*")
    .eq("mundo_junior_id", world.id)
    .eq("activo", true);

  if (error || !data?.length) {
    alert("¡Este mundo todavía no tiene preguntas! Vuelve pronto.");
    renderWorldMenu();
    showScreen("map");
    return;
  }

  // Mezclar y limitar a 10
  questions = data.sort(() => Math.random() - 0.5).slice(0, 10);
  qi        = 0;
  score     = 0;
  answered  = false;

  $("jr-bar-fill").style.width = "100%";
  setTimeout(() => {
    showScreen("game");
    renderQuestion();
  }, 250);

  $("jr-quit").onclick = () => {
    if (confirm("¿Quieres salir del juego?")) {
      renderWorldMenu();
      showScreen("map");
    }
  };
}

// =============================================================================
// PREGUNTA
// =============================================================================
function renderQuestion() {
  answered = false;
  $("jr-next-wrap").classList.add("hidden");

  const q   = questions[qi];
  const pct = (qi / questions.length) * 100;

  // Dots de progreso
  const dots = $("jr-dots");
  dots.innerHTML = "";
  questions.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = `jr-dot${i < qi ? " done" : i === qi ? " active" : ""}`;
    dots.appendChild(d);
  });

  $("jr-score").textContent  = score;
  $("jr-q-emoji").textContent = q.emoji_tema || "📖";
  $("jr-q-text").textContent  = q.pregunta;

  // Animación entrada
  const qbox = document.querySelector(".jr-question-box");
  qbox.classList.remove("pop");
  requestAnimationFrame(() => qbox.classList.add("pop"));

  // Opciones (máx 3)
  const opts = [
    { text: q.opcion_a, idx: 0 },
    { text: q.opcion_b, idx: 1 },
    { text: q.opcion_c, idx: 2 },
  ].filter(o => o.text);

  const correctIdx = ["a","b","c"].indexOf(q.respuesta_correcta?.toLowerCase());
  const container  = $("jr-options");
  container.innerHTML = "";
  container.className = `jr-options opts${opts.length}`;

  opts.forEach(({ text, idx }) => {
    const btn = document.createElement("button");
    btn.className = "jr-opt";
    btn.textContent = text;
    btn.addEventListener("click", () => pickAnswer(btn, idx, correctIdx, q.referencia_simple));
    container.appendChild(btn);
  });
}

function pickAnswer(btn, chosen, correct, ref) {
  if (answered) return;
  answered = true;

  const allBtns = $("jr-options").querySelectorAll(".jr-opt");
  const isRight = chosen === correct;

  allBtns.forEach((b, i) => {
    b.disabled = true;
    if (i === correct)            b.classList.add("correct");
    else if (i === chosen && !isRight) b.classList.add("wrong");
    else                          b.classList.add("dim");
  });

  if (isRight) {
    score++;
    $("jr-score").textContent = score;
    launchConfetti();
    // Pulsar emoji
    const em = $("jr-q-emoji");
    em.classList.remove("bounce");
    requestAnimationFrame(() => em.classList.add("bounce"));
  }

  // Footer
  $("jr-ref").textContent = ref ? `📖 ${ref}` : "";
  $("jr-next-wrap").classList.remove("hidden");

  const isLast = qi >= questions.length - 1;
  const btn_next = $("jr-next-btn");
  btn_next.textContent = isLast ? "¡Ver mi resultado! 🌟" : "¡Siguiente! 🚀";
  btn_next.onclick = () => {
    if (isLast) showResult();
    else { qi++; renderQuestion(); }
  };
}

// =============================================================================
// CONFETTI
// =============================================================================
function launchConfetti() {
  const container = $("jr-confetti");
  container.innerHTML = "";
  for (let i = 0; i < 18; i++) {
    const c = document.createElement("div");
    c.className = "jr-piece";
    c.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};
      width: ${6 + Math.random() * 8}px;
      height: ${6 + Math.random() * 8}px;
      border-radius: ${Math.random() > .5 ? "50%" : "2px"};
      animation-duration: ${0.8 + Math.random() * 0.6}s;
      animation-delay: ${Math.random() * 0.2}s;
    `;
    container.appendChild(c);
  }
  setTimeout(() => container.innerHTML = "", 1600);
}

// =============================================================================
// RESULTADO FINAL
// =============================================================================
function showResult() {
  const total = questions.length;
  const pct   = score / total;
  const emoji = pct >= 0.8 ? "🏆" : pct >= 0.5 ? "🎉" : "📖";
  const title = pct >= 0.8 ? "¡Eres genial!" : pct >= 0.5 ? "¡Muy bien!" : "¡Sigue intentando!";
  const body  = `Acertaste ${score} de ${total} preguntas.`;

  $("jr-end-emoji").textContent = emoji;
  $("jr-end-title").textContent = title;
  $("jr-end-body").textContent  = body;

  // Estrellas
  const stars = pct >= 0.8 ? 3 : pct >= 0.5 ? 2 : 1;
  $("jr-end-stars").innerHTML = [1,2,3].map(s =>
    `<span class="jr-res-star${s <= stars ? " lit" : ""}" style="animation-delay:${(s-1)*.2}s">⭐</span>`
  ).join("");

  $("jr-btn-replay").onclick = () => startWorld(activeWorld);
  $("jr-btn-menu").onclick   = () => { renderWorldMenu(); showScreen("map"); };

  showScreen("end");
  if (pct >= 0.8) {
    // Gran celebración al final
    for (let i = 0; i < 3; i++) setTimeout(launchConfetti, i * 400);
  }
}
