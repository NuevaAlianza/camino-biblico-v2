let rpgCiclos = {};
let cicloActual = obtenerSemanaAnio();
let datosCiclo = null;
let progresoRPG = null;
let usuarioActual = null;

const preguntasPorNivel = [5, 4, 3, 3, 3];

const EMOJIS_RPG = [
  { emoji: "😌", hasta: 21 }, // 25-21
  { emoji: "🙂", hasta: 16 }, // 20-16
  { emoji: "😐", hasta: 11 }, // 15-11
  { emoji: "😯", hasta: 6 },  // 10-6
  { emoji: "😱", hasta: 0 }   // 5-0
];
let temporizadorActivo = null;

// ========== TEMPORIZADOR Y SONIDO ==========
function crearTemporizadorPregunta(duracion, onTimeout, onTick, onEmojiChange) {
  let tiempoRestante = duracion;
  let intervalo;
  let emojiActual = "";

  function actualizarTemporizador() {
    const circulo = document.getElementById("timer-circular");
    const radio = 40, circunferencia = 2 * Math.PI * radio;
    const progreso = tiempoRestante / duracion;
    if (circulo) {
      circulo.style.strokeDasharray = `${circunferencia}`;
      circulo.style.strokeDashoffset = `${circunferencia * (1 - progreso)}`;
    }

    const emojiObj = EMOJIS_RPG.find(e => tiempoRestante > e.hasta) || EMOJIS_RPG[EMOJIS_RPG.length - 1];
    if (emojiObj && emojiActual !== emojiObj.emoji) {
      emojiActual = emojiObj.emoji;
      const emojiDiv = document.getElementById("emoji-animado");
      if (emojiDiv) {
        emojiDiv.textContent = emojiActual;
        emojiDiv.className = "emoji-animado" + (emojiActual === "😱" ? " shake" : "");
        if (onEmojiChange) onEmojiChange(emojiActual);
      }
    }
    const texto = document.getElementById("timer-text");
    if (texto) texto.textContent = tiempoRestante + "s";
    if (onTick) onTick(tiempoRestante);
  }

  actualizarTemporizador();

  intervalo = setInterval(() => {
    tiempoRestante--;
    actualizarTemporizador();
    if (tiempoRestante <= 0) {
      clearInterval(intervalo);
      if (onTimeout) onTimeout();
    }
  }, 1000);

  temporizadorActivo = {
    detener: () => clearInterval(intervalo),
    getTiempo: () => tiempoRestante
  };
  return temporizadorActivo;
}

function limpiarTemporizadorPregunta() {
  if (temporizadorActivo && temporizadorActivo.detener) temporizadorActivo.detener();
  temporizadorActivo = null;
}

function reproducirSonido(nombre) {
  try {
    const audio = new Audio("assets/sonidos/" + nombre);
    audio.play();
  } catch (e) {}
}

function sonidoFalloAleatorio() {
  const opciones = ["wrong1.mp3", "wrong2.mp3", "wrong3.mp3", "wrong4.mp3"];
  const i = Math.floor(Math.random() * opciones.length);
  return opciones[i];
}

// ========== INICIO: CARGA DE DATOS ==========
fetch('datos/rpg-preguntas.json')
  .then(res => res.json())
  .then(async data => {
    rpgCiclos = data.ciclos || {};
    datosCiclo = rpgCiclos[cicloActual];
    if (!datosCiclo) {
      mostrarSinCiclo();
      return;
    }
    await mostrarStatsBienvenida();
    inicializarPanelInicio();
    inicializarRPG();
  });

function obtenerSemanaAnio() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return d.getFullYear() + "-S" + Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function mostrarSinCiclo() {
  document.getElementById("menu-rpg").innerHTML = `
    <div class="panel-mensaje">
      <h2>No hay trivia RPG programada para esta semana.</h2>
      <p>¡Vuelve la próxima semana!</p>
    </div>
  `;
  document.getElementById("btn-comenzar").style.display = "none";
  document.getElementById("btn-continuar").style.display = "none";
}

// ========== PANEL BIENVENIDA Y STATS ==========
async function mostrarStatsBienvenida() {
  const bienvenida = document.getElementById("bienvenida-stats");
  const { data: sessionData } = await supabase.auth.getSession();
  usuarioActual = sessionData?.session?.user;
  if (!usuarioActual) {
    bienvenida.innerHTML = "";
    return;
  }
  const { data: xpRows } = await supabase
    .from("rpg_progreso")
    .select("xp")
    .eq("user_id", usuarioActual.id);
  const xpTotal = xpRows ? xpRows.reduce((a, b) => a + (b.xp || 0), 0) : 0;
  const parroquia = usuarioActual.user_metadata?.parroquia || null;
  let parroquiaHTML = "";
  if (parroquia) {
    const { data: parroquiaRows } = await supabase
      .from("rpg_progreso")
      .select("user_id, xp")
      .eq("parroquia", parroquia)
      .eq("completado", true);
    const parroquiaMap = {};
    (parroquiaRows || []).forEach(r => {
      if (!parroquiaMap[r.user_id]) parroquiaMap[r.user_id] = 0;
      parroquiaMap[r.user_id] += r.xp || 0;
    });
    const parroquiaArray = Object.entries(parroquiaMap)
      .map(([user_id, xp]) => ({ user_id, xp }))
      .sort((a, b) => b.xp - a.xp);
    const miParroquiaRank = parroquiaArray.findIndex(r => r.user_id === usuarioActual.id) + 1;
    parroquiaHTML = `<div class="rpg-parroquia">⛪ Parroquia: <b>#${miParroquiaRank > 0 ? miParroquiaRank : '-'}</b> de ${parroquiaArray.length} (${parroquia})</div>`;
  } else {
    parroquiaHTML = `<div class="rpg-parroquia">No tienes parroquia registrada.</div>`;
  }
  bienvenida.innerHTML = `
    <div class="panel-bienvenida">
      <div class="rpg-bienvenido">¡Bienvenido!</div>
      <div class="rpg-xp">Hasta hoy has acumulado <b>${xpTotal}</b> XP.</div>
      ${parroquiaHTML}
      <div class="rpg-avanza">¡Veamos si hoy avanzas al #1! 🚀</div>
    </div>
  `;
}

// ========== PROGRESO: CARGAR Y GUARDAR ==========
async function cargarProgresoRPG() {
  if (window.supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    usuarioActual = sessionData?.session?.user;
    const userId = usuarioActual?.id;
    if (!userId) return null;
    const { data } = await supabase
      .from("rpg_progreso")
      .select("*")
      .eq("user_id", userId)
      .eq("ciclo", cicloActual)
      .maybeSingle();  // FIX: evita error 406
    return data;
  }
  // LocalStorage si no logueado
  const p = JSON.parse(localStorage.getItem("rpg_progreso")) || {};
  return p[cicloActual] || null;
}

async function guardarProgresoRPG({ nivel, rango, xp, completado }) {
  if (window.supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    usuarioActual = sessionData?.session?.user;
    const userId = usuarioActual?.id;
    const meta = usuarioActual?.user_metadata || {};
    if (!userId) return;
    await supabase.from("rpg_progreso").upsert([{
      user_id: userId,
      ciclo: cicloActual,
      nivel_max: nivel,
      rango,
      xp,
      completado,
      fecha_juego: new Date().toISOString(),
      pais: meta.pais || null,
      ciudad: meta.ciudad || null,
      parroquia: meta.parroquia || null
    }]);
    return;
  }
  let p = JSON.parse(localStorage.getItem("rpg_progreso")) || {};
  p[cicloActual] = { nivel, rango, xp, completado };
  localStorage.setItem("rpg_progreso", JSON.stringify(p));
}

// ========== RAM ==========
let juegoActual = null;

async function inicializarPanelInicio() {
  document.getElementById("titulo-ciclo").textContent = datosCiclo.titulo || "Trivia Bíblica RPG";
  document.getElementById("descripcion-ciclo").textContent = datosCiclo.descripcion || "";
  document.getElementById("mensaje-rpg").textContent =
    "Recuerda: solo tienes 3 vidas para demostrar tu valía. ¿Listo para el reto?";
}

async function inicializarRPG() {
  progresoRPG = await cargarProgresoRPG();
  if (progresoRPG && progresoRPG.completado) {
    document.getElementById("btn-comenzar").style.display = "none";
    document.getElementById("btn-continuar").style.display = "none";
    document.getElementById("juego-rpg").classList.add("oculto");
    document.getElementById("resultados-rpg").classList.add("oculto");
    document.getElementById("logros-rpg").classList.add("oculto");
    document.getElementById("menu-rpg").insertAdjacentHTML("beforeend",
      `<div class="panel-mensaje" style="margin-top:1em;">
        <strong>¡Ya completaste la Trivia de esta semana!</strong>
        <br>Vuelve la próxima semana para un nuevo reto.
      </div>`);
    return;
  }
  document.getElementById("btn-comenzar").style.display = juegoActual ? "none" : "inline-block";
  document.getElementById("btn-continuar").style.display = juegoActual ? "inline-block" : "none";
  document.getElementById("juego-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.add("oculto");
  document.getElementById("logros-rpg").classList.add("oculto");
}

// ========== BOTONES ==========
document.getElementById("btn-comenzar").onclick = () => {
  juegoActual = {
    nivel: 1,
    vidas: 3,
    pregunta: 0,
    preguntasNivel: null,
    xp: 0
  };
  mostrarNivel();
};
document.getElementById("btn-continuar").onclick = () => {
  mostrarNivel();
};
document.getElementById("btn-logros").onclick = () => {
  mostrarLogros();
};

// ========== JUEGO: MOSTRAR NIVEL Y PREGUNTA ==========
function mostrarNivel() {
  const juego = document.getElementById("juego-rpg");
  juego.classList.remove("oculto");
  document.getElementById("menu-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.add("oculto");
  document.getElementById("logros-rpg").classList.add("oculto");

  const nivel = juegoActual.nivel;
  const nivelKey = nivel.toString();
  const numPreguntas = preguntasPorNivel[nivel - 1] || 3;

  if (!datosCiclo.niveles || !Array.isArray(datosCiclo.niveles[nivelKey])) {
    juego.innerHTML = `<div class="panel-mensaje">
      <h2>¡No hay preguntas para el nivel ${nivel}!</h2>
      <p>Verifica tu archivo <b>rpg-preguntas.json</b></p>
      <button onclick="window.location.reload()">Volver</button>
    </div>`;
    return;
  }

  function shuffleOpciones(p) {
    let arr = [...p.opciones];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  if (!juegoActual.preguntasNivel || juegoActual.preguntasNivel.length !== numPreguntas) {
    juegoActual.preguntasNivel = mezclarArray([...datosCiclo.niveles[nivelKey]]).slice(0, numPreguntas).map(p => ({
      ...p,
      opciones: shuffleOpciones(p)
    }));
    juegoActual.pregunta = 0;
  }

  mostrarPregunta();

  function mostrarPregunta() {
    const preguntaActual = juegoActual.pregunta || 0;
    const p = juegoActual.preguntasNivel[preguntaActual];

    if (!p) {
      if (juegoActual.nivel >= preguntasPorNivel.length) {
        terminarAventura(true);
      } else {
        juegoActual.nivel++;
        juegoActual.pregunta = 0;
        juegoActual.preguntasNivel = null;
        mostrarMensajeNivelPersonalizado(
          juegoActual.nivel,
          juegoActual.vidas,
          mostrarNivel
        );
      }
      return;
    }

    juego.innerHTML = `
      <div class="temporizador-panel">
        <svg width="90" height="90" class="temporizador-svg">
          <circle cx="45" cy="45" r="40" stroke="#f4a261" stroke-width="7" fill="none" id="timer-circular"/>
        </svg>
        <span id="emoji-animado" class="emoji-animado">😌</span>
        <div id="timer-text" class="timer-text">25s</div>
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
      </div>
    `;

    limpiarTemporizadorPregunta();
    reproducirSonido("start.mp3");
    crearTemporizadorPregunta(
      25,
      () => {
        juegoActual.vidas--;
        if (juegoActual.vidas <= 0) {
          terminarAventura();
        } else {
          const vidasEl = document.querySelector('.rpg-vidas');
          if (vidasEl) {
            vidasEl.classList.add("shake");
            setTimeout(() => vidasEl.classList.remove("shake"), 400);
          }
          juegoActual.pregunta++;
          mostrarPregunta();
        }
      },
      (tiempoRestante) => {
        if (tiempoRestante === 13) reproducirSonido("halfway.mp3");
        if (tiempoRestante === 5) reproducirSonido("warning.mp3");
      }
    );

    document.querySelectorAll('.rpg-btn-op').forEach(btn => {
      btn.onclick = () => {
        limpiarTemporizadorPregunta();
        const correcta = p.opciones[btn.dataset.i] === p.respuesta;
        if (correcta) {
          btn.classList.add("acierto");
          animarAcierto(btn);
          reproducirSonido("correct.mp3");
          juegoActual.xp += juegoActual.nivel * 1;
        } else {
          btn.classList.add("fallo");
          reproducirSonido(sonidoFalloAleatorio());
          juegoActual.vidas--;
          const vidasEl = document.querySelector('.rpg-vidas');
          if (vidasEl) {
            vidasEl.classList.add("shake");
            setTimeout(() => vidasEl.classList.remove("shake"), 400);
          }
        }
        setTimeout(() => {
          juegoActual.pregunta = preguntaActual + 1;
          if (juegoActual.vidas <= 0) {
            terminarAventura();
          } else if (juegoActual.pregunta >= numPreguntas) {
            juegoActual.nivel++;
            juegoActual.pregunta = 0;
            juegoActual.preguntasNivel = null;
            if (juegoActual.nivel > preguntasPorNivel.length) {
              terminarAventura(true);
            } else {
              mostrarMensajeNivelPersonalizado(
                juegoActual.nivel,
                juegoActual.vidas,
                mostrarNivel
              );
            }
          } else {
            mostrarPregunta();
          }
        }, 700);
      };
    });
  }
}

// ========== FINALIZAR ==========
async function terminarAventura(ganoTodo = false) {
  document.getElementById("juego-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.remove("oculto");
  const rango = obtenerRango(juegoActual.nivel, ganoTodo);
  await guardarProgresoRPG({
    nivel: juegoActual.nivel,
    rango,
    xp: juegoActual.xp,
    completado: true,
  });
  document.getElementById("resultados-rpg").innerHTML = `
    <h2>${ganoTodo ? "¡Felicidades, completaste la Trivia!" : "Fin de la aventura"}</h2>
    <p>Tu rango: <b>${rango}</b></p>
    <p>XP ganada: ${juegoActual.xp}</p>
    <div class="msg-epico">⚡️ Has completado el reto semanal. Vuelve la próxima semana para una nueva aventura.</div>
    <button onclick="window.location.reload()">Volver al inicio</button>
    <button id="btn-compartir-resultado" class="compartir-btn">Compartir resultado</button>
  `;
  document.getElementById("btn-comenzar").style.display = "none";
  document.getElementById("btn-continuar").style.display = "none";
  setTimeout(() => {
    const btn = document.getElementById("btn-compartir-resultado");
    if (btn) btn.onclick = () => compartirResultadoRPG(rango, juegoActual.xp, ganoTodo);
  }, 50);
}

// ========== OTROS ==========
function obtenerRango(nivel, ganoTodo) {
  if (ganoTodo) return "Maestro de la Palabra";
  if (nivel === 5) return "Sabio de las Escrituras";
  if (nivel === 4) return "Guerrero de la Fe";
  if (nivel === 3) return "Explorador Bíblico";
  if (nivel === 2) return "Principiante";
  return "Principiante";
}

function mezclarArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function mostrarLogros() {
  document.getElementById("menu-rpg").classList.add("oculto");
  document.getElementById("juego-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.add("oculto");
  document.getElementById("logros-rpg").classList.remove("oculto");
  document.getElementById("logros-rpg").innerHTML = `
    <h2>Logros RPG (próximamente)</h2>
    <button onclick="window.location.reload()">Volver</button>
  `;
}

// Mensaje personalizado
const tipsPorNivel = [
  "Recuerda leer con atención las opciones antes de responder.",
  "Algunas preguntas tienen pistas en los detalles de la pregunta.",
  "Si tienes dudas, descarta primero las opciones más improbables.",
  "¡Vas muy bien! Mantén la calma y sigue adelante.",
  "¡Estás a un paso del rango más alto! Confía en tu intuición."
];
function mostrarMensajeNivelPersonalizado(nivel, vidas, callback) {
  const mensajes = [
    "¡Buen comienzo!",
    "¡Vas avanzando muy bien!",
    "¡Increíble progreso!",
    "¡Estás entre los mejores!",
    "¡Nivel máximo alcanzado, eres un crack!"
  ];
  const msg = mensajes[nivel-1] || "¡Sigue así!";
  const tip = tipsPorNivel[nivel-1] || "";

  document.getElementById("juego-rpg").innerHTML = `
    <div class="panel-mensaje-nivel">
      <h2>🎉 ¡Felicidades!</h2>
      <p>${msg}</p>
      <p>Has alcanzado el <b>nivel ${nivel}</b>.<br>
      Te quedan <b>${vidas}</b> ${vidas === 1 ? "vida" : "vidas"}.</p>
      <div class="tip-box">
        <strong>Tip para este nivel:</strong><br>${tip}
      </div>
      <button id="btn-seguir-nivel">Continuar</button>
    </div>
  `;
  document.getElementById("btn-seguir-nivel").onclick = callback;
}

function animarAcierto(btn) {
  btn.classList.add("acierto-anim");
  setTimeout(() => btn.classList.remove("acierto-anim"), 500);
}

function compartirResultadoRPG(rango, xp, completado) {
  let mensaje = `¡He jugado la Trivia Bíblica RPG!\nObtuve el rango: ${rango}\nXP ganada: ${xp}\n¿Te atreves a superarme?`;
  if (completado) mensaje = "¡Completé la Trivia Bíblica RPG! 🏆\n" + mensaje;

  if (navigator.share) {
    navigator.share({
      title: 'Mi resultado en Trivia Bíblica RPG',
      text: mensaje,
      url: window.location.href
    });
  } else {
    navigator.clipboard.writeText(mensaje);
    alert("¡Resultado copiado! Puedes pegarlo en WhatsApp, Telegram o donde quieras.");
  }
}

