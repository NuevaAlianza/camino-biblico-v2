/* ===================== CONFIG GLOBAL ===================== */
window.modoPractica = false;

// ====== Definición de mentores ======
const MENTORES = [
  {
    id: "san_juan",
    nombre: "San Juan Vianney",
    img: "assets/img/mentor/mentor_cura.png",
    habilidades: [
      "+5 segundos por pregunta", "Oración poderosa", "Empatía pastoral",
      "+10 segundos por pregunta", "Consejo certero", "Ánimo inagotable",
      "Discernimiento espiritual", "50% de preguntas más fáciles (¡o eso parece!)",
      "Sabiduría inesperada", "Fortaleza en la adversidad",
      "Serenidad bajo presión", "Memoria bíblica"
    ]
  },
  {
    id: "santa_teresa",
    nombre: "Santa Teresa de Ávila",
    img: "assets/img/mentor/mentor_teresa.png",
    habilidades: [
      "Paciencia legendaria", "+7 segundos por pregunta", "Visión espiritual",
      "Alegría contagiosa", "Confianza total", "Mente estratégica",
      "Puedes pedir pista especial", "+2 segundos por pregunta", "Oración profunda",
      "Inspiración a prueba de dudas", "Paz interior", "Valor ante el miedo"
    ]
  },
  {
    id: "san_pablo",
    nombre: "San Pablo",
    img: "assets/img/mentor/mentor_pablo.png",
    habilidades: [
      "+10 segundos por pregunta", "Conversión radical", "Resistencia a la adversidad",
      "Predicador incansable", "Dominio de la Palabra", "+5 segundos por pregunta",
      "Coraje misionero", "Sabiduría para responder rápido", "Motivación constante",
      "Discernimiento de espíritus", "Viajes épicos (¡sin perder el rumbo!)", "Citas bíblicas al instante"
    ]
  }
];

function extraerBonusSegundos(habilidad) {
  const match = habilidad.match(/\+(\d+)\s*seg/i);
  return match ? parseInt(match[1], 10) : 0;
}

/* ===================== VARIABLES GLOBALES ===================== */
let mentorElegido = null;
let habilidadesMentorPartida = [];
let bonusTiempoMentor = 0;

let rpgCiclos = {};
const cicloActual = obtenerSemanaAnio();
let datosCiclo = null;

let usuarioActual = null;
let progresoRPG = null;

const preguntasPorNivel = [5, 4, 3, 3, 3]; // ✅ 5 niveles
const EMOJIS_RPG = [
  { emoji: "😌", hasta: 21 }, { emoji: "🙂", hasta: 16 },
  { emoji: "😐", hasta: 11 }, { emoji: "😯", hasta: 6 },
  { emoji: "😱", hasta: 0 }
];

let temporizadorActivo = null;
let juegoActual = null; // { nivel, vidas, pregunta, preguntasNivel, xp }
let sesionPartidaId = null; // anti-trampa: id de sesión de juego
const rpgChannel = new BroadcastChannel("rpg_lock"); // anti-trampa: evitar multitab
let ocultamientosConsecutivos = 0; // anti-trampa

/* ===================== HELPERS ===================== */
function obtenerSemanaAnio() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return d.getFullYear() + "-S" + Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
function reproducirSonido(nombre) {
  try { new Audio("assets/sonidos/" + nombre).play(); } catch {}
}
function sonidoFalloAleatorio() {
  const arr = ["wrong1.mp3", "wrong2.mp3", "wrong3.mp3", "wrong4.mp3"];
  return arr[Math.floor(Math.random() * arr.length)];
}
function mezclarArray(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/* ===================== TEMPORIZADOR (con corrección de deriva) ===================== */
function crearTemporizadorPregunta(duracion, onTimeout, onTick, onEmojiChange) {
  const start = Date.now();
  const total = duracion * 1000;
  let stopped = false;
  let emojiActual = "";

  function frame() {
    if (stopped) return;
    const ahora = Date.now();
    let msRest = Math.max(0, total - (ahora - start));
    const tiempoRestante = Math.ceil(msRest / 1000);

    // UI circular
    const circulo = document.getElementById("timer-circular");
    const radio = 40, circ = 2 * Math.PI * radio;
    const progreso = tiempoRestante / duracion;
    if (circulo) {
      circulo.style.strokeDasharray = `${circ}`;
      circulo.style.strokeDashoffset = `${circ * (1 - progreso)}`;
    }

    // Emoji
    const emojiObj = EMOJIS_RPG.find(e => tiempoRestante > e.hasta) || EMOJIS_RPG.at(-1);
    if (emojiObj && emojiActual !== emojiObj.emoji) {
      emojiActual = emojiObj.emoji;
      const emojiDiv = document.getElementById("emoji-animado");
      if (emojiDiv) {
        emojiDiv.textContent = emojiActual;
        emojiDiv.className = "emoji-animado" + (emojiActual === "😱" ? " shake" : "");
      }
      onEmojiChange && onEmojiChange(emojiActual);
    }

    const texto = document.getElementById("timer-text");
    if (texto) texto.textContent = `${tiempoRestante}s`;
    onTick && onTick(tiempoRestante);

    if (msRest <= 0) {
      onTimeout && onTimeout();
    } else {
      requestAnimationFrame(frame);
    }
  }
  requestAnimationFrame(frame);

  temporizadorActivo = {
    detener: () => { stopped = true; },
    getTiempo: () => {
      const elapsed = Date.now() - start;
      return Math.max(0, Math.ceil((total - elapsed) / 1000));
    }
  };
  return temporizadorActivo;
}
function limpiarTemporizadorPregunta() {
  if (temporizadorActivo?.detener) temporizadorActivo.detener();
  temporizadorActivo = null;
}

// ================= SUPABASE: Guardar progreso =================

// Guardado parcial (durante la partida)
async function guardarParcial({ nivelMax, xp, vidasRestantes }) {
  if (window.modoPractica) return; // no guardar en práctica
  const { data: s } = await supabase.auth.getSession();
  const u = s?.session?.user;
  if (!u) return;

  const meta = u.user_metadata || {};
  await supabase.from("rpg_progreso").upsert([{
    user_id: u.id,
    ciclo: cicloActual,
    nivel_max: nivelMax,
    xp,
    rango: null,
    completado: false,
    estado: "en curso",
    vidas_restantes: vidasRestantes,
    session_id: sesionPartidaId,
    fecha_juego: new Date().toISOString(),
    pais: meta.pais || null,
    ciudad: meta.ciudad || null,
    parroquia: meta.parroquia || null
  }], { onConflict: ["user_id", "ciclo"] });  // ✅ Array de columnas
}

// Guardado final (al terminar la partida)
async function guardarFinal({ nivelMax, xp, rango }) {
  if (window.modoPractica) return;
  const { data: s } = await supabase.auth.getSession();
  const u = s?.session?.user;
  if (!u) return;

  const meta = u.user_metadata || {};
  await supabase.from("rpg_progreso").upsert([{
    user_id: u.id,
    ciclo: cicloActual,
    nivel_max: nivelMax,
    xp,
    rango,
    completado: true,
    estado: "terminado",
    vidas_restantes: 0,
    session_id: sesionPartidaId,
    ended_at: new Date().toISOString(),
    fecha_juego: new Date().toISOString(),
    pais: meta.pais || null,
    ciudad: meta.ciudad || null,
    parroquia: meta.parroquia || null
  }], { onConflict: ["user_id", "ciclo"] });  // ✅ Array de columnas
}


/* ===================== ANTITRAMPAS (cliente) ===================== */
// 1) Evitar multitab simultáneo
rpgChannel.onmessage = (ev) => {
  if (ev.data?.type === "handshake") {
    rpgChannel.postMessage({ type: "iam-active", session: sesionPartidaId });
  } else if (ev.data?.type === "start" && ev.data.session !== sesionPartidaId) {
    // Otra pestaña inició: avisar y bloquear esta si estamos jugando
    if (juegoActual && !window.modoPractica) {
      alertaAntiTrampa("Se detectó otra pestaña activa de la Trivia RPG. Esta sesión se cerrará.");
      terminarAventura(false);
    }
  }
};
function anunciarInicioSesion() {
  rpgChannel.postMessage({ type: "handshake" });
  rpgChannel.postMessage({ type: "start", session: sesionPartidaId });
}
// 2) Visibilidad (ocultar pestaña): pausar 1ª vez, penalizar a partir de la 2ª
document.addEventListener("visibilitychange", () => {
  if (!juegoActual || window.modoPractica) return;
  if (document.hidden) {
    ocultamientosConsecutivos++;
    if (ocultamientosConsecutivos === 1) {
      limpiarTemporizadorPregunta();
      toastInfo("Has salido de la pestaña. El tiempo se pausó una vez por seguridad.");
    } else {
      // Penalización leve: pierdes 1 vida
      juegoActual.vidas = Math.max(0, juegoActual.vidas - 1);
      guardarParcial({ nivelMax: juegoActual.nivel, xp: juegoActual.xp, vidasRestantes: juegoActual.vidas });
      toastInfo("Has salido repetidamente de la pestaña. Pierdes una vida por seguridad.");
      if (juegoActual.vidas <= 0) terminarAventura(false);
    }
  } else if (temporizadorActivo == null && juegoActual) {
    // Reanuda con 10s de gracia, pero máximo al tope original
    const extra = Math.min(10, 25 + bonusTiempoMentor);
    crearTemporizadorPregunta(extra,
      () => { juegoActual.vidas--; if (juegoActual.vidas <= 0) terminarAventura(false); else avanzarPregunta(); },
      (t) => { if (t === 5) reproducirSonido("warning.mp3"); }
    );
  }
});
function alertaAntiTrampa(msg) {
  const el = document.createElement("div");
  el.className = "panel-mensaje alerta";
  el.innerHTML = `<h3>⚠ Seguridad</h3><p>${msg}</p>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
function toastInfo(msg) {
  const t = document.createElement("div");
  t.className = "toast-info";
  t.textContent = msg;
  Object.assign(t.style, { position: "fixed", bottom: "16px", left: "50%", transform: "translateX(-50%)",
    background: "#111a", color: "#fff", padding: "8px 14px", borderRadius: "10px", zIndex: 9999 });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/* ===================== UI INICIAL ===================== */
document.addEventListener("DOMContentLoaded", async () => {
  const { data: s } = await supabase.auth.getSession();
  usuarioActual = s?.session?.user;

  if (!usuarioActual) {
    document.getElementById("bienvenida-stats").innerHTML = `
      <div class="panel-mensaje">
        <h2>Por favor, inicia sesión para acceder a la Trivia RPG.</h2>
        <button onclick="window.location.reload()">Recargar sesión</button>
      </div>`;
    ocultarBotonesInicio();
    return;
  }

  const res = await fetch("datos/rpg-preguntas.json");
  const json = await res.json();
  rpgCiclos = json.ciclos || {};
  datosCiclo = rpgCiclos[cicloActual];
  if (!datosCiclo) { mostrarSinCiclo(); return; }

  await prepararPantallaBienvenida();
  document.getElementById("menu-rpg").classList.remove("oculto");
  inicializarRPG();
});

function ocultarBotonesInicio() {
  const b1 = document.getElementById("btn-comenzar");
  const b2 = document.getElementById("btn-continuar");
  if (b1) b1.style.display = "none";
  if (b2) b2.style.display = "none";
}
function mostrarSinCiclo() {
  document.getElementById("menu-rpg").innerHTML = `
    <div class="panel-mensaje">
      <h2>No hay Trivia RPG esta semana.</h2>
      <p>¡Vuelve la próxima semana!</p>
    </div>`;
  ocultarBotonesInicio();
}

async function prepararPantallaBienvenida() {
  progresoRPG = await cargarProgresoRPG();
  const cont = document.getElementById("bienvenida-stats");

  if (progresoRPG?.completado) {
    cont.innerHTML = `
      <div class="panel-bienvenida">
        <div class="rpg-bienvenido">¡Ya completaste la Trivia RPG de esta semana!</div>
        <div>Vuelve la próxima semana para un nuevo reto.<br>
        <small>(Puedes jugar en <b>modo práctica</b>, no sumará XP ni logros.)</small></div>
        <button id="btn-modo-practica" class="btn-secundario">Modo práctica</button>
      </div>`;
    document.getElementById("btn-modo-practica").onclick = () => {
      window.modoPractica = true;
      juegoActual = null; mentorElegido = null;
      bonusTiempoMentor = 0; habilidadesMentorPartida = [];
      mostrarStatsBienvenidaModoPractica();
    };
    return;
  }

  cont.innerHTML = `
    <div class="panel-bienvenida">
      <div class="rpg-bienvenido">¡Bienvenido a la Aventura RPG!</div>
      <div class="rpg-avanza">Elige un mentor que te acompañará en esta travesía.<br>¿Listo para dejar huella?</div>
      <button id="btn-elegir-mentor" class="btn-principal">Elegir Mentor</button>
    </div>`;
  document.getElementById("btn-elegir-mentor").onclick = mostrarSelectorMentor;

  // Panel ciclo (opcional)
  const titulo = document.getElementById("titulo-ciclo");
  const desc = document.getElementById("descripcion-ciclo");
  const msg = document.getElementById("mensaje-rpg");
  if (titulo) titulo.textContent = datosCiclo.titulo || "Trivia Bíblica RPG";
  if (desc) desc.textContent = datosCiclo.descripcion || "";
  if (msg) msg.textContent = "Recuerda: solo tienes 3 vidas. ¡Suerte!";
}
function mostrarStatsBienvenidaModoPractica() {
  document.getElementById("bienvenida-stats").innerHTML = `
    <div class="panel-bienvenida practica">
      <div class="rpg-bienvenido">¡Modo práctica activado!</div>
      <div class="rpg-avanza">Juega para mejorar. Esta partida no suma XP ni logros.</div>
      <button id="btn-elegir-mentor" class="btn-principal">Elegir Mentor</button>
    </div>`;
  document.getElementById("btn-elegir-mentor").onclick = mostrarSelectorMentor;
}

/* ===================== INICIALIZACIÓN DE JUEGO ===================== */
function inicializarRPG() {
  document.getElementById("btn-comenzar").onclick = async () => {
    if (!usuarioActual) { alert("Inicia sesión para jugar."); window.location.reload(); return; }
    // Candado semanal: si hay estado "en curso" de otra sesión, bloquear
    progresoRPG = await cargarProgresoRPG();
    if (progresoRPG?.completado && !window.modoPractica) {
      alertaAntiTrampa("Ya completaste la Trivia RPG de esta semana.");
      return;
    }
    if (progresoRPG?.estado === "en curso" && !window.modoPractica && progresoRPG?.session_id && progresoRPG.session_id !== sesionPartidaId) {
      alertaAntiTrampa("Ya tienes una partida en curso en otra sesión.");
      return;
    }
    // Nueva partida
    sesionPartidaId = uuid();
    anunciarInicioSesion();
    juegoActual = { nivel: 1, vidas: 3, pregunta: 0, preguntasNivel: null, xp: 0 };
    mostrarNivel();
  };

  document.getElementById("btn-continuar").onclick = () => { if (juegoActual) mostrarNivel(); };
  document.getElementById("btn-logros").onclick = () => { mostrarLogros(); };
}

/* ===================== SELECTOR DE MENTOR ===================== */
function mostrarSelectorMentor() {
  if (!usuarioActual) { alert("Tu sesión caducó. Inicia sesión."); window.location.reload(); return; }
  let html = `<div id="modal-mentor" class="modal-mentor"><h2>Elige tu mentor</h2><div class="mentores-lista">`;
  MENTORES.forEach(mentor => {
    const habilidades = mezclarArray(mentor.habilidades).slice(0, 3);
    html += `
      <div class="mentor-card" data-id="${mentor.id}">
        <img src="${mentor.img}" alt="${mentor.nombre}" class="mentor-img"/>
        <h3>${mentor.nombre}</h3>
        <ul>${habilidades.map(h => `<li>${h}</li>`).join("")}</ul>
        <button class="btn-seleccionar-mentor" data-id="${mentor.id}">Elegir</button>
      </div>`;
  });
  html += `</div><button id="cerrar-mentor" class="btn-cerrar">Cancelar</button></div>`;

  const overlay = document.createElement("div");
  overlay.id = "overlay-mentor";
  overlay.style = "position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:1000;display:flex;align-items:center;justify-content:center;";
  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  document.getElementById("cerrar-mentor").onclick = () => document.body.removeChild(overlay);
  overlay.querySelectorAll(".btn-seleccionar-mentor").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      mentorElegido = MENTORES.find(m => m.id === id);
      habilidadesMentorPartida = mezclarArray(mentorElegido.habilidades).slice(0, 3);
      bonusTiempoMentor = habilidadesMentorPartida.reduce((s, h) => s + extraerBonusSegundos(h), 0);
      document.body.removeChild(overlay);
      mostrarPanelInicioConMentor();
    };
  });
}
function mostrarPanelInicioConMentor() {
  document.getElementById("bienvenida-stats").innerHTML = `
    <div class="panel-bienvenida">
      <div class="rpg-bienvenido">¡Tu mentor será:</div>
      <div class="mentor-seleccionado">
        <img src="${mentorElegido.img}" alt="${mentorElegido.nombre}" style="width:90px;height:90px;border-radius:50%;margin:8px 0;">
        <div><strong>${mentorElegido.nombre}</strong></div>
      </div>
      <div class="mentor-frase">${mentorElegidoFraseMotivacional()}</div>
      <button id="btn-iniciar-aventura" class="btn-principal">Iniciar aventura</button>
    </div>`;
  document.getElementById("btn-iniciar-aventura").onclick = () => {
    document.getElementById("menu-rpg").classList.remove("oculto");
    document.getElementById("btn-comenzar").click();
  };
}
function mentorElegidoFraseMotivacional() {
  if (!mentorElegido) return "";
  const frases = {
    san_juan: [
      "¡La oración es tu fuerza secreta!",
      "No temas equivocarte: crece con cada paso.",
      "Dios camina contigo, ¡ánimo!"
    ],
    santa_teresa: [
      "Nada te turbe, nada te espante…",
      "Confía: todo pasa; solo Dios basta.",
      "Cada pregunta es una oportunidad."
    ],
    san_pablo: [
      "Todo lo puedo en Aquel que me fortalece.",
      "Corre la carrera para ganar el premio.",
      "No te rindas: la fe te impulsa."
    ]
  };
  const arr = frases[mentorElegido.id] || ["¡Buena suerte!"];
  return arr[Math.floor(Math.random() * arr.length)];
}
function mentorElegidoFraseNivel() {
  if (!mentorElegido) return "";
  const frases = {
    san_juan: [
      "La paciencia te llevará lejos.",
      "Cada error te hace más sabio.",
      "¡Sigue, la gracia te acompaña!"
    ],
    santa_teresa: [
      "La fe mueve todo, no te detengas.",
      "En cada paso, Dios contigo.",
      "Si caes, levántate con una sonrisa."
    ],
    san_pablo: [
      "Lucha la buena batalla.",
      "Dios obra aun en el cansancio.",
      "¡El premio te espera!"
    ]
  };
  const arr = frases[mentorElegido.id] || ["¡Sigue, eres capaz!"];
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ===================== JUEGO: NIVEL Y PREGUNTA ===================== */
function mostrarNivel() {
  const wrap = document.getElementById("juego-rpg");
  wrap.classList.remove("oculto");
  document.getElementById("menu-rpg")?.classList.add("oculto");
  document.getElementById("resultados-rpg")?.classList.add("oculto");
  document.getElementById("logros-rpg")?.classList.add("oculto");

  const nivel = juegoActual.nivel;
  const nivelKey = String(nivel);
  const totalPreg = preguntasPorNivel[nivel - 1] || 3;

  if (!datosCiclo?.niveles || !Array.isArray(datosCiclo.niveles[nivelKey]) || !datosCiclo.niveles[nivelKey].length) {
    wrap.innerHTML = `
      <div class="panel-mensaje">
        <h2>¡No hay preguntas para el nivel ${nivel}!</h2>
        <p>Verifica el archivo <b>datos/rpg-preguntas.json</b></p>
        <button onclick="window.location.reload()">Volver</button>
      </div>`;
    return;
  }

  if (!juegoActual.preguntasNivel) {
    juegoActual.preguntasNivel = mezclarArray([...datosCiclo.niveles[nivelKey]])
      .slice(0, totalPreg)
      .map(p => ({ ...p, opciones: mezclarArray([...p.opciones]) }));
    juegoActual.pregunta = 0;
  }

  renderPregunta();
}

function renderPregunta() {
  const wrap = document.getElementById("juego-rpg");
  const idx = juegoActual.pregunta || 0;
  const p = juegoActual.preguntasNivel[idx];

  if (!p) {
    // Pasar de nivel o terminar
    if (juegoActual.nivel >= preguntasPorNivel.length) {
      terminarAventura(true);
    } else {
      juegoActual.nivel++;
      juegoActual.pregunta = 0;
      juegoActual.preguntasNivel = null;
      guardarParcial({ nivelMax: juegoActual.nivel - 1, xp: juegoActual.xp, vidasRestantes: juegoActual.vidas });
      mostrarMensajeNivelPersonalizado(juegoActual.nivel, juegoActual.vidas, mostrarNivel);
    }
    return;
  }

  wrap.innerHTML = `
    <div class="temporizador-panel">
      <svg width="90" height="90" class="temporizador-svg">
        <circle cx="45" cy="45" r="40" stroke="#f4a261" stroke-width="7" fill="none" id="timer-circular"></circle>
      </svg>
      <span id="emoji-animado" class="emoji-animado">😌</span>
      <div id="timer-text" class="timer-text">${25 + bonusTiempoMentor}s</div>
    </div>
    <div class="panel-pregunta">
      <div class="rpg-info">
        <span class="rpg-nivel">Nivel: ${juegoActual.nivel}</span>
        <span class="rpg-vidas">${"❤️".repeat(juegoActual.vidas)}</span>
      </div>
      <div class="rpg-pregunta"><b>${p.pregunta}</b></div>
      <div class="rpg-opciones">
        ${p.opciones.map((op, i) => `<button class="rpg-btn-op" data-i="${i}">${op}</button>`).join("")}
      </div>
      <small>Si fallas, pierdes una vida. ¡Suerte!</small>
    </div>`;

  limpiarTemporizadorPregunta();
  reproducirSonido("go.mp3");

  const disableAll = () => {
    document.querySelectorAll(".rpg-btn-op").forEach(b => b.disabled = true);
  };

  crearTemporizadorPregunta(
    25 + bonusTiempoMentor,
    () => { // timeout
      juegoActual.vidas--;
      guardarParcial({ nivelMax: juegoActual.nivel, xp: juegoActual.xp, vidasRestantes: juegoActual.vidas });
      if (juegoActual.vidas <= 0) { terminarAventura(false); }
      else { avanzarPregunta(); }
    },
    (t) => { if (t === 13) reproducirSonido("halfway.mp3"); if (t === 5) reproducirSonido("warning.mp3"); }
  );

  document.querySelectorAll(".rpg-btn-op").forEach(btn => {
    btn.onclick = () => {
      // Antidoble clic
      if (btn.disabled) return;
      disableAll();

      limpiarTemporizadorPregunta();
      const correcta = p.opciones[btn.dataset.i] === p.respuesta;
      if (correcta) {
        btn.classList.add("acierto");
        animarAcierto(btn);
        reproducirSonido("correcto.mp3");
        juegoActual.xp += juegoActual.nivel * 1; // XP por nivel
      } else {
        btn.classList.add("fallo");
        reproducirSonido(sonidoFalloAleatorio());
        juegoActual.vidas--;
        const vidasEl = document.querySelector(".rpg-vidas");
        if (vidasEl) { vidasEl.classList.add("shake"); setTimeout(() => vidasEl.classList.remove("shake"), 400); }
      }
      guardarParcial({ nivelMax: juegoActual.nivel, xp: juegoActual.xp, vidasRestantes: juegoActual.vidas });

      setTimeout(() => {
        if (juegoActual.vidas <= 0) terminarAventura(false);
        else avanzarPregunta();
      }, 700);
    };
  });
}

function avanzarPregunta() {
  juegoActual.pregunta = (juegoActual.pregunta || 0) + 1;
  const num = preguntasPorNivel[juegoActual.nivel - 1] || 3;
  if (juegoActual.pregunta >= num) {
    // Cambiar de nivel o terminar
    if (juegoActual.nivel >= preguntasPorNivel.length) {
      terminarAventura(true);
    } else {
      juegoActual.nivel++;
      juegoActual.pregunta = 0;
      juegoActual.preguntasNivel = null;
      mostrarMensajeNivelPersonalizado(juegoActual.nivel, juegoActual.vidas, mostrarNivel);
    }
  } else {
    renderPregunta();
  }
}

/* ===================== FINALIZAR ===================== */
async function terminarAventura(ganoTodo = false) {
  document.getElementById("juego-rpg")?.classList.add("oculto");
  const panel = document.getElementById("resultados-rpg");
  panel?.classList.remove("oculto");

  if (window.modoPractica) {
    panel.innerHTML = `
      <h2>¡Fin de la práctica!</h2>
      <p>¡Muy bien! Has completado el reto en <b>modo práctica</b>.</p>
      <div class="msg-epico">Esta partida no cuenta para ranking, XP ni logros.</div>
      <button onclick="window.location.reload()">Volver al inicio</button>`;
    ocultarBotonesInicio();
    return;
  }

  if (!usuarioActual) {
    alert("Error: sesión no detectada. Inicia sesión nuevamente.");
    window.location.reload();
    return;
  }

  const rango = obtenerRango(juegoActual.nivel, ganoTodo);
  await guardarFinal({
    nivelMax: ganoTodo ? preguntasPorNivel.length : juegoActual.nivel,
    xp: juegoActual.xp,
    rango
  });

  panel.innerHTML = `
    <h2>${ganoTodo ? "🏆 ¡Felicidades, completaste la Trivia!" : "Fin de la aventura"}</h2>
    <p>Tu rango: <b>${rango}</b></p>
    <p>XP ganada: <b>${juegoActual.xp}</b></p>
    <div class="msg-epico">⚡ Has completado el reto semanal. Vuelve la próxima semana para una nueva aventura.</div>
    <button onclick="window.location.reload()">Volver al inicio</button>
    <button id="btn-compartir-resultado" class="compartir-btn">Compartir resultado</button>`;
  ocultarBotonesInicio();

  setTimeout(() => {
    const btn = document.getElementById("btn-compartir-resultado");
    if (btn) btn.onclick = () => compartirResultadoRPG(rango, juegoActual.xp, ganoTodo);
  }, 50);
}

function obtenerRango(nivel, ganoTodo) {
  if (ganoTodo) return "Maestro de la Palabra";
  if (nivel >= 5) return "Sabio de las Escrituras";
  if (nivel === 4) return "Guerrero de la Fe";
  if (nivel === 3) return "Explorador Bíblico";
  if (nivel === 2) return "Principiante";
  return "Principiante";
}

/* ===================== UI EXTRA ===================== */
const tipsPorNivel = [
  "Lee con atención antes de responder.",
  "Busca pistas en palabras clave.",
  "Descarta primero lo improbable.",
  "Mantén la calma: vas muy bien.",
  "Estás a un paso del rango más alto."
];
function mostrarMensajeNivelPersonalizado(nivel, vidas, callback) {
  const mensajes = [
    "¡Buen comienzo!", "¡Vas avanzando muy bien!",
    "¡Increíble progreso!", "¡Estás entre los mejores!",
    "¡Nivel máximo a la vista!"
  ];
  const msg = mensajes[nivel - 1] || "¡Sigue así!";
  const tip = tipsPorNivel[nivel - 1] || "";

  let mentorHtml = "";
  if (mentorElegido) {
    mentorHtml = `
      <div class="mentor-nivel-panel">
        <img src="${mentorElegido.img}" class="mentor-img-nivel" alt="${mentorElegido.nombre}" />
        <div class="mentor-mensaje-nivel">${mentorElegidoFraseNivel()}</div>
      </div>`;
  }

  document.getElementById("juego-rpg").innerHTML = `
    <div class="panel-mensaje-nivel">
      ${mentorHtml}
      <h2>🎉 ¡Felicidades!</h2>
      <p>${msg}</p>
      <p>Has alcanzado el <b>nivel ${nivel}</b>. Te quedan <b>${vidas}</b> ${vidas === 1 ? "vida" : "vidas"}.</p>
      <div class="tip-box"><strong>Tip:</strong> ${tip}</div>
      <button id="btn-seguir-nivel">Continuar</button>
    </div>`;
  document.getElementById("btn-seguir-nivel").onclick = callback;
}

function animarAcierto(btn) {
  btn.classList.add("acierto-anim");
  setTimeout(() => btn.classList.remove("acierto-anim"), 500);
}

function compartirResultadoRPG(rango, xp, completado) {
  let texto = `¡He jugado la Trivia Bíblica RPG!\nRango: ${rango}\nXP: ${xp}\n¿Te atreves a superarme?`;
  if (completado) texto = "¡Completé la Trivia Bíblica RPG! 🏆\n" + texto;
  if (navigator.share) {
    navigator.share({ title: "Mi resultado en Trivia Bíblica RPG", text: texto, url: window.location.href });
  } else {
    navigator.clipboard.writeText(texto);
    toastInfo("¡Resultado copiado! Pégalo donde quieras.");
  }
}

function mostrarLogros() {
  document.getElementById("menu-rpg")?.classList.add("oculto");
  document.getElementById("juego-rpg")?.classList.add("oculto");
  document.getElementById("resultados-rpg")?.classList.add("oculto");
  const cont = document.getElementById("logros-rpg");
  cont?.classList.remove("oculto");
  cont.innerHTML = `
    <h2>Logros RPG (próximamente)</h2>
    <button onclick="window.location.reload()">Volver</button>`;
}
