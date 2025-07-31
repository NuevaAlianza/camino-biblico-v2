// =======================
// === MENTORES Y FLUJO ===
// =======================

const MENTORES = [
  {
    id: "san_juan",
    nombre: "San Juan Vianney",
    img: "assets/img/mentor/mentor_cura.png",
    habilidades: [
      "Oración poderosa", "Empatía pastoral", "Consejo certero", "Ánimo inagotable", "Discernimiento espiritual"
    ],
    mensajes_bienvenida: [
      "Confía en el Señor y avanza con alegría.",
      "Recuerda que la oración es tu fuerza.",
      "La paciencia y el amor abren todas las puertas."
    ],
    mensajes_nivel: {
      2: [
        "¡Buen trabajo en el primer nivel! Te espero al otro lado del río. No dejes que la duda te detenga.",
        "Superaste la primera prueba, ¡ánimo! Recuerda, el enemigo intentará confundirte.",
        "Desde aquí puedo verte avanzar. ¡No bajes la guardia en el llano!",
        "En el siguiente nivel habrá más retos, pero cuentas con mi oración.",
        "Recuerda: la perseverancia todo lo alcanza. ¡Te espero adelante!"
      ],
      3: [
        "¡Qué alegría verte llegar! Ahora la subida es mayor, pero también tu experiencia.",
        "Haz llegado lejos, pero falta poco. Mantén la fe.",
        "El cansancio es normal, pero ¡no estás solo! Ánimo.",
        "En la cima, la vista es mejor. Que no te distraigan las voces del miedo.",
        "La paciencia y el amor abren todas las puertas, sigue así."
      ],
      4: [
        "Cada vez más cerca, ¡no te desanimes!",
        "Ahora el camino es más angosto, pero tú eres fuerte.",
        "Si te caes, levántate. Yo estaré esperándote más arriba.",
        "¡Mucho ánimo! Pronto terminarás este reto.",
        "Mantente atento, la tentación es mayor, pero tu fuerza también."
      ],
      5: [
        "¡Último nivel! Yo estaré esperando en la meta para celebrar contigo.",
        "Has llegado lejos. ¡Dios te acompaña hasta el final!",
        "No dudes de tus talentos. ¡Puedes lograrlo!",
        "Doy gracias a Dios por tu esfuerzo. ¡A darlo todo!",
        "Que la esperanza te guíe en este último tramo."
      ]
    },
    mensaje_final: [
      "¡Felicitaciones, lo lograste! Has superado cada desafío con fe.",
      "¡Has llegado a la meta! Recuerda, el camino continúa en la vida real.",
      "Gracias por permitirme ser tu mentor. ¡Dios te bendiga!"
    ]
  },
  // Puedes copiar y adaptar para Santa Teresa, San Pablo, etc.
  // Asegúrate de personalizar sus frases.
];

// ============ Estado ===============
let mentorSeleccionado = null;
let habilidadesAsignadas = [];
let mensajeBienvenida = "";

// ============ Selección Mentor =============
document.addEventListener('DOMContentLoaded', () => {
  renderMentores();
});

function renderMentores() {
  const container = document.getElementById('mentor-section');
  container.classList.remove('oculto');
  document.getElementById('mensaje-mentor-section').classList.add('oculto');
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
  // Habilidades aleatorias en la vista previa
  MENTORES.forEach((mentor, idx) => {
    const habDiv = document.getElementById(`hab-${idx}`);
    habDiv.innerHTML = getHabilidadesAleatorias(mentor.habilidades, 3)
      .map(h => `<li>${h}</li>`).join('');
  });

  // Selección
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
  mensajeBienvenida = mentorSeleccionado.mensajes_bienvenida[
    Math.floor(Math.random() * mentorSeleccionado.mensajes_bienvenida.length)
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
  document.getElementById('btn-iniciar-rpg2').onclick = () => {
    msgSec.classList.add('oculto');
    document.getElementById('menu-rpg').classList.remove('oculto');
    iniciarTriviaRPG2();
  };
}

// ============ FLUJO DEL JUEGO =============

let rpgCiclos = {};
let cicloActual = obtenerSemanaAnio();
let datosCiclo = null;
let preguntasPorNivel = [5, 4, 3, 3, 3];
let juegoActual = null;

const EMOJIS_RPG = [
  { emoji: "😌", hasta: 21 },
  { emoji: "🙂", hasta: 16 },
  { emoji: "😐", hasta: 11 },
  { emoji: "😯", hasta: 6 },
  { emoji: "😱", hasta: 0 }
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

function mostrarNivel() {
  // Al iniciar un nuevo nivel (excepto nivel 1), mostramos el mentor
  if (juegoActual.nivel > 1) {
    mostrarTransicionMentor(juegoActual.nivel, juegoActual.vidas, mostrarPregunta);
  } else {
    mostrarPregunta();
  }

  function mostrarPregunta() {
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

    mostrarUnaPregunta();

    function mostrarUnaPregunta() {
      const preguntaActual = juegoActual.pregunta || 0;
      const p = juegoActual.preguntasNivel[preguntaActual];

      if (!p) {
        if (juegoActual.nivel >= preguntasPorNivel.length) {
          terminarAventura(true);
        } else {
          juegoActual.nivel++;
          juegoActual.pregunta = 0;
          juegoActual.preguntasNivel = null;
          mostrarNivel();
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
      // (Puedes usar reproducirSonido aquí si quieres)
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
            mostrarUnaPregunta();
          }
        }
      );

      document.querySelectorAll('.rpg-btn-op').forEach(btn => {
        btn.onclick = () => {
          limpiarTemporizadorPregunta();
          const correcta = p.opciones[btn.dataset.i] === p.respuesta;
          if (correcta) {
            btn.classList.add("acierto");
            animarAcierto(btn);
            // Puedes sumar XP aquí si usas XP
            juegoActual.xp = (juegoActual.xp || 0) + juegoActual.nivel;
          } else {
            btn.classList.add("fallo");
            // Puedes poner sonido aquí también
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
              mostrarNivel();
            } else {
              mostrarUnaPregunta();
            }
          }, 700);
        };
      });
    }
  }
}

// ==== Mentor transiciones entre niveles ====
function mostrarTransicionMentor(nivel, vidas, callback) {
  const mensajes = mentorSeleccionado.mensajes_nivel?.[nivel] || [
    "¡Estás avanzando bien! Sigue adelante con fe."
  ];
  const mensajeNivel = mensajes[Math.floor(Math.random() * mensajes.length)];
  const contenedor = document.getElementById('juego-rpg');
  contenedor.innerHTML = `
    <div class="mentor-bienvenida-card" style="margin:2em auto;">
      <img src="${mentorSeleccionado.img}" alt="${mentorSeleccionado.nombre}" class="mentor-img-grande"/>
      <h2>${mentorSeleccionado.nombre} te espera en el nivel ${nivel}</h2>
      <div class="mentor-mensaje">${mensajeNivel}</div>
      <div class="mentor-progreso">Te quedan <b>${vidas}</b> ${vidas === 1 ? 'vida' : 'vidas'}.</div>
      <button id="btn-seguir-nivel">Continuar</button>
    </div>
  `;
  document.getElementById("menu-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.add("oculto");
  document.getElementById("logros-rpg").classList.add("oculto");
  document.getElementById("btn-seguir-nivel").onclick = callback;
}

// ==== Finalización ====
function terminarAventura(ganoTodo = false) {
  document.getElementById("juego-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.remove("oculto");
  const mensajes = mentorSeleccionado.mensaje_final || ["¡Felicidades!"];
  const mensajeFinal = mensajes[Math.floor(Math.random() * mensajes.length)];
  document.getElementById("resultados-rpg").innerHTML = `
    <div class="mentor-bienvenida-card" style="margin:2em auto;">
      <img src="${mentorSeleccionado.img}" alt="${mentorSeleccionado.nombre}" class="mentor-img-grande"/>
      <h2>${mentorSeleccionado.nombre} te felicita</h2>
      <div class="mentor-mensaje">${mensajeFinal}</div>
    </div>
    <h2>${ganoTodo ? "¡Completaste la Trivia!" : "Fin de la aventura"}</h2>
    <p>XP ganada: ${juegoActual.xp}</p>
    <button onclick="window.location.reload()">Volver al inicio</button>
  `;
  document.getElementById("btn-comenzar").style.display = "none";
  document.getElementById("btn-continuar").style.display = "none";
}

// ========= Utilidades =============
function mezclarArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
function limpiarTemporizadorPregunta() {
  if (temporizadorActivo && temporizadorActivo.detener) temporizadorActivo.detener();
  temporizadorActivo = null;
}
function crearTemporizadorPregunta(duracion, onTimeout) {
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
      }
    }
    const texto = document.getElementById("timer-text");
    if (texto) texto.textContent = tiempoRestante + "s";
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
function animarAcierto(btn) {
  btn.classList.add("acierto-anim");
  setTimeout(() => btn.classList.remove("acierto-anim"), 500);
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
