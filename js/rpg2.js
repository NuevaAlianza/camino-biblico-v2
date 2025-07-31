// ======== Mentores disponibles ========
const MENTORES = [
  {
    id: "san_juan",
    nombre: "San Juan Vianney",
    img: "assets/img/mentor/mentor_cura.png",
    habilidades: [
      "Oración poderosa", "Empatía pastoral", "Consejo certero", "Ánimo inagotable", "Discernimiento espiritual"
    ],
    mensajesNivel: [
      ["En el primer nivel, observa bien y confía en la gracia.", "Dios siempre guía a quien lo busca.", "Ánimo, hijo/a, la travesía apenas inicia."],
      ["¡Buen avance! Recuerda: la paciencia trae frutos.", "Sigue adelante, aunque parezca difícil.", "Dios está contigo en cada paso."],
      ["La mitad del camino revela los corazones fuertes.", "No olvides el poder de la oración.", "Valiente es quien no teme al error."],
      ["El cuarto nivel exige constancia. Persevera y vencerás.", "El enemigo intentará desanimarte, mantente firme.", "Ya casi logras la meta."],
      ["¡Último nivel! Da lo mejor de ti y confía en el Señor.", "Eres capaz de mucho más de lo que imaginas.", "Que la Palabra ilumine tu camino."]
    ],
    mensajes: [
      "Confía en el Señor y avanza con alegría.",
      "Recuerda que la oración es tu fuerza.",
      "La paciencia y el amor abren todas las puertas."
    ]
  },
  {
    id: "santa_teresa",
    nombre: "Santa Teresa de Ávila",
    img: "assets/img/mentor/santa_teresa.png",
    habilidades: [
      "Mente brillante", "Oración profunda", "Valor ante la adversidad", "Paz interior", "Intuición femenina"
    ],
    mensajesNivel: [
      ["Dios basta. Mantén la calma y lee con atención.", "No te turbes ante los desafíos pequeños.", "La oración silenciosa ayuda en todo."],
      ["Tu alma es valiente. Sigue avanzando.", "Las dificultades son oportunidades de crecer.", "Si caes, levántate con paz."],
      ["Vas en buen camino, la humildad es la clave.", "No te distraigas, mira cada pregunta con amor.", "Sigue adelante, con confianza."],
      ["La perseverancia es tu aliada. Estás cerca de la meta.", "Recuerda: nada te turbe, nada te espante.", "Dios nunca falla a los que esperan."],
      ["Has llegado lejos. Ahora solo falta un poco más.", "El esfuerzo trae grandes recompensas.", "Confía, porque Dios siempre guía."]
    ],
    mensajes: [
      "Nada te turbe, nada te espante.",
      "Dios basta, sigue adelante.",
      "La humildad es la clave del crecimiento."
    ]
  },
  {
    id: "san_pablo",
    nombre: "San Pablo",
    img: "assets/img/mentor/san_pablo.png",
    habilidades: [
      "Valentía", "Sabiduría escritural", "Entusiasmo misionero", "Persuasión", "Fe contagiosa"
    ],
    mensajesNivel: [
      ["Todo lo puedo en Aquel que me fortalece.", "El que persevera, alcanza.", "La fe mueve montañas."],
      ["No te detengas ante la adversidad.", "El premio es para quien lucha hasta el final.", "Valiente es quien sigue a pesar de todo."],
      ["Recuerda tus metas. Sigue adelante.", "El Espíritu te acompaña.", "Fortalece tu fe cada día."],
      ["Has demostrado ser constante. Mantente firme.", "El camino angosto lleva a la gloria.", "Fuerza, hermano/a, ya casi logras la corona."],
      ["Termina la carrera con fe. ¡Tú puedes!", "La victoria es de quienes no se rinden.", "Dios está contigo."]
    ],
    mensajes: [
      "Todo lo puedo en Aquel que me fortalece.",
      "Sé firme en la fe y valiente en las pruebas.",
      "La Palabra es tu espada, úsala con sabiduría."
    ]
  }
];

let mentorSeleccionado = null, habilidadesAsignadas = [], mensajeBienvenida = "";

// ========== Selección de Mentor ==========
document.addEventListener('DOMContentLoaded', () => {
  renderMentores();
});

// Renderizar selección de mentores
function renderMentores() {
  const container = document.getElementById('mentor-section');
  container.classList.remove('oculto');
  document.getElementById('mensaje-mentor-section').classList.add('oculto');
  document.getElementById('menu-rpg').classList.add('oculto');
  container.innerHTML = `
    <h2>Elige a tu mentor para esta semana</h2>
    <div class="mentores-grid">
      ${MENTORES.map((m, idx) => `
        <div class="mentor-card" data-idx="${idx}">
          <img src="${m.img}" alt="${m.nombre}" class="mentor-img"/>
          <div class="mentor-nombre">${m.nombre}</div>
          <ul class="mentor-habilidades" id="hab-${idx}"></ul>
        </div>
      `).join('')}
    </div>
  `;
  // Habilidades aleatorias
  MENTORES.forEach((mentor, idx) => {
    const habDiv = document.getElementById(`hab-${idx}`);
    habDiv.innerHTML = getHabilidadesAleatorias(mentor.habilidades, 3)
      .map(h => `<li>${h}</li>`).join('');
  });

  document.querySelectorAll('.mentor-card').forEach(card => {
    card.onclick = () => seleccionarMentor(card.dataset.idx);
  });
}

function getHabilidadesAleatorias(habilidades, n = 3) {
  const copia = [...habilidades];
  const elegidas = [];
  while (elegidas.length < n && copia.length > 0) {
    const idx = Math.floor(Math.random() * copia.length);
    elegidas.push(copia.splice(idx, 1)[0]);
  }
  return elegidas;
}

function seleccionarMentor(idx) {
  mentorSeleccionado = MENTORES[idx];
  habilidadesAsignadas = getHabilidadesAleatorias(mentorSeleccionado.habilidades, 3);
  mensajeBienvenida = mentorSeleccionado.mensajes[
    Math.floor(Math.random() * mentorSeleccionado.mensajes.length)
  ];
  mostrarMensajeMentor();
}

function mostrarMensajeMentor() {
  document.getElementById('mentor-section').classList.add('oculto');
  const msgSec = document.getElementById('mensaje-mentor-section');
  msgSec.classList.remove('oculto');
  msgSec.innerHTML = `
    <div class="mentor-bienvenida-card">
      <img src="${mentorSeleccionado.img}" alt="${mentorSeleccionado.nombre}" class="mentor-img-grande"/>
      <h2>${mentorSeleccionado.nombre} será tu guía esta semana</h2>
      <ul>
        ${habilidadesAsignadas.map(h => `<li>✨ ${h}</li>`).join('')}
      </ul>
      <div class="mentor-mensaje">${mensajeBienvenida}</div>
      <button id="btn-iniciar-rpg2">¡Iniciar Trivia RPG!</button>
    </div>
  `;
  document.getElementById('btn-iniciar-rpg2').onclick = async () => {
    msgSec.classList.add('oculto');
    // === Bloqueo semanal ===
    const puedeJugar = await chequearJuegoSemana();
    if (puedeJugar) {
      document.getElementById('menu-rpg').classList.remove('oculto');
      iniciarTriviaRPG2();
    }
  };
}

// =========== CONTROL DE PARTIDA SEMANAL ===========
let cicloActual = obtenerSemanaAnio();

async function chequearJuegoSemana() {
  // Si no hay Supabase, deja jugar siempre (modo local)
  if (!window.supabase) {
    document.getElementById("menu-rpg").classList.remove("oculto");
    return true;
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const usuarioActual = sessionData?.session?.user;
  if (!usuarioActual) {
    alert("Debes iniciar sesión para jugar la Trivia RPG.");
    window.location.href = "login.html";
    return false;
  }

  const { data: progresoCiclo } = await supabase
    .from("rpg_progreso")
    .select("*")
    .eq("user_id", usuarioActual.id)
    .eq("ciclo", cicloActual)
    .maybeSingle();

  if (progresoCiclo && progresoCiclo.completado) {
    document.getElementById("mentor-section").classList.add("oculto");
    document.getElementById("mensaje-mentor-section").classList.add("oculto");
    document.getElementById("menu-rpg").classList.add("oculto");
    document.getElementById("juego-rpg").classList.add("oculto");
    document.getElementById("resultados-rpg").classList.remove("oculto");
    document.getElementById("resultados-rpg").innerHTML = `
      <div class="panel-mensaje">
        <h2>¡Ya completaste la Trivia de esta semana!</h2>
        <p>Vuelve la próxima semana para un nuevo reto.<br><br>
        <button onclick="window.location.reload()">Volver al inicio</button>
      </div>
    `;
    return false;
  } else {
    document.getElementById("menu-rpg").classList.remove("oculto");
    return true;
  }
}

// =========== Juego RPG =============
let rpgCiclos = {};
let datosCiclo = null;
let preguntasPorNivel = [5, 4, 3, 3, 3];
let juegoActual = null;

const EMOJIS_RPG = [
  { emoji: "😌", hasta: 21 }, // 25-21
  { emoji: "🙂", hasta: 16 }, // 20-16
  { emoji: "😐", hasta: 11 }, // 15-11
  { emoji: "😯", hasta: 6 },  // 10-6
  { emoji: "😱", hasta: 0 }   // 5-0
];
let temporizadorActivo = null;

function iniciarTriviaRPG2() {
  fetch('datos/rpg-preguntas.json')
    .then(res => res.json())
    .then(data => {
      rpgCiclos = data.ciclos || {};
      datosCiclo = rpgCiclos[cicloActual] || Object.values(rpgCiclos)[0];
      inicializarPanelInicio();
      inicializarRPG();
    });
}

function obtenerSemanaAnio() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return d.getFullYear() + "-S" + Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ========== BLOQUEO SEMANAL UNIVERSAL EN RPG2 ==========

// 1. Detectar usuario y progreso apenas carga la página
document.addEventListener('DOMContentLoaded', async () => {
  await chequearJuegoSemanaUniversal();
});

// 2. Universal check: se ejecuta siempre al cargar
async function chequearJuegoSemanaUniversal() {
  // Si no hay Supabase, modo local (no bloquea)
  if (!window.supabase) {
    renderMentores(); // flujo normal
    return;
  }

  // Obtén sesión
  const { data: sessionData } = await supabase.auth.getSession();
  const usuarioActual = sessionData?.session?.user;
  if (!usuarioActual) {
    alert("Debes iniciar sesión para jugar la Trivia RPG.");
    window.location.href = "login.html";
    return;
  }

  // Obtén ciclo
  let cicloActual = obtenerSemanaAnio();

  // Busca si ya jugó esta semana
  const { data: progresoCiclo } = await supabase
    .from("rpg_progreso")
    .select("*")
    .eq("user_id", usuarioActual.id)
    .eq("ciclo", cicloActual)
    .maybeSingle();

  if (progresoCiclo && progresoCiclo.completado) {
    mostrarPanelBloqueo();
    return;
  }

  // Si no ha jugado, permite seleccionar mentor normalmente
  renderMentores();
}

// 3. Mostrar panel de bloqueo si ya jugó
function mostrarPanelBloqueo() {
  document.getElementById("mentor-section").classList.add("oculto");
  document.getElementById("mensaje-mentor-section").classList.add("oculto");
  document.getElementById("menu-rpg").classList.add("oculto");
  document.getElementById("juego-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.remove("oculto");
  document.getElementById("resultados-rpg").innerHTML = `
    <div class="panel-mensaje">
      <h2>¡Ya completaste la Trivia de esta semana!</h2>
      <p>Vuelve la próxima semana para un nuevo reto.<br><br>
      <button onclick="window.location.reload()">Volver al inicio</button>
    </div>
  `;
}

// 4. Cuando termines el juego y guardes progreso, vuelve a chequear y bloquear
async function terminarAventura(ganoTodo = false) {
  document.getElementById("juego-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.remove("oculto");
  const rango = obtenerRango(juegoActual.nivel, ganoTodo);
  // Guarda progreso
  if (window.supabase) {
    await guardarProgresoRPG2({
      nivel: juegoActual.nivel,
      rango,
      xp: juegoActual.xp,
      completado: true,
    });
  }
  // Refresca el bloqueo (podrías también solo mostrarPanelBloqueo())
  await chequearJuegoSemanaUniversal();
}

function inicializarPanelInicio() {
  document.getElementById("titulo-ciclo").textContent = datosCiclo?.titulo || "Trivia Bíblica RPG";
  document.getElementById("descripcion-ciclo").textContent = datosCiclo?.descripcion || "";
  document.getElementById("mensaje-rpg").textContent =
    `¡${mentorSeleccionado.nombre} te acompaña! Tienes 3 vidas para superar 5 niveles. ¡Suerte!`;
}

function inicializarRPG() {
  document.getElementById("btn-comenzar").style.display = "inline-block";
  document.getElementById("btn-continuar").style.display = "none";
  document.getElementById("juego-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.add("oculto");
  document.getElementById("logros-rpg").classList.add("oculto");

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
}

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
        mostrarMensajeNivelMentor(
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
        <span id="enemigo-emoji" class="enemigo-emoji"></span>
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

    // Mostrar enemigo según vidas
    mostrarEnemigo(juegoActual.vidas);

    limpiarTemporizadorPregunta();
    reproducirSonido("start.mp3");
    crearTemporizadorPregunta(
      25,
      () => {
        juegoActual.vidas--;
        reproducirSonido(sonidoFalloAleatorio());
        mostrarEnemigo(juegoActual.vidas);
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
          reproducirSonido("correcto.mp3");
          juegoActual.xp += juegoActual.nivel * 1;
        } else {
          btn.classList.add("fallo");
          reproducirSonido(sonidoFalloAleatorio());
          juegoActual.vidas--;
          mostrarEnemigo(juegoActual.vidas);
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
              mostrarMensajeNivelMentor(
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

// ========= Emoji enemigo =========
function mostrarEnemigo(vidasRestantes) {
  const enemigoDiv = document.getElementById('enemigo-emoji');
  if (!enemigoDiv) return;
  if (vidasRestantes === 3) enemigoDiv.textContent = "";
  else if (vidasRestantes === 2) enemigoDiv.textContent = "😈";
  else if (vidasRestantes === 1) enemigoDiv.textContent = "😈😈";
  else enemigoDiv.textContent = "👹";
  enemigoDiv.classList.add("shake");
  setTimeout(() => enemigoDiv.classList.remove("shake"), 400);
}

// ========== FINALIZAR ==========
function terminarAventura(ganoTodo = false) {
  document.getElementById("juego-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.remove("oculto");
  const rango = obtenerRango(juegoActual.nivel, ganoTodo);
  document.getElementById("resultados-rpg").innerHTML = `
    <h2>${ganoTodo ? "¡Felicidades, completaste la Trivia!" : "Fin de la aventura"}</h2>
    <p>Tu rango: <b>${rango}</b></p>
    <p>XP ganada: ${juegoActual.xp}</p>
    <div class="msg-epico">⚡️ Has completado el reto semanal. Vuelve la próxima semana para una nueva aventura.</div>
    <button onclick="window.location.reload()">Volver al inicio</button>
  `;
  document.getElementById("btn-comenzar").style.display = "none";
  document.getElementById("btn-continuar").style.display = "none";
  // Guarda progreso Supabase solo si está presente
  if (window.supabase) {
    guardarProgresoRPG2({
      nivel: juegoActual.nivel,
      rango,
      xp: juegoActual.xp,
      completado: true,
    });
  }
}

// ========== Guardar progreso en Supabase ==========
async function guardarProgresoRPG2({ nivel, rango, xp, completado }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const usuarioActual = sessionData?.session?.user;
  if (!usuarioActual) return;
  const meta = usuarioActual.user_metadata || {};
  await supabase.from("rpg_progreso").upsert([{
    user_id: usuarioActual.id,
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
}

// ========== Logros ==========
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

// ========= TEMPORIZADOR Y SONIDO =========
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

function animarAcierto(btn) {
  btn.classList.add("acierto-anim");
  setTimeout(() => btn.classList.remove("acierto-anim"), 500);
}

function mezclarArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function obtenerRango(nivel, ganoTodo) {
  if (ganoTodo) return "Maestro de la Palabra";
  if (nivel === 5) return "Sabio de las Escrituras";
  if (nivel === 4) return "Guerrero de la Fe";
  if (nivel === 3) return "Explorador Bíblico";
  if (nivel === 2) return "Principiante";
  return "Principiante";
}

// ========== Panel de mensaje mentor al pasar nivel ==========
function mostrarMensajeNivelMentor(nivel, vidas, callback) {
  const pool = mentorSeleccionado.mensajesNivel[nivel - 1] || [];
  const mentorMensaje = pool[Math.floor(Math.random() * pool.length)] || "";
  document.getElementById("juego-rpg").innerHTML = `
    <div class="panel-mensaje-nivel">
      <img src="${mentorSeleccionado.img}" alt="${mentorSeleccionado.nombre}" class="mentor-img-nivel"/>
      <h2>${mentorSeleccionado.nombre} te dice:</h2>
      <p class="mentor-mensaje-nivel">${mentorMensaje}</p>
      <p>Has alcanzado el <b>nivel ${nivel}</b>.<br>
      Te quedan <b>${vidas}</b> ${vidas === 1 ? "vida" : "vidas"}.</p>
      <button id="btn-seguir-nivel">Continuar</button>
    </div>
  `;
  document.getElementById("btn-seguir-nivel").onclick = callback;
}
