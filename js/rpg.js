let preguntasRPG = {};
let progresoRPG = null;
let cicloActual = obtenerSemanaAnio();

// --- Carga preguntas ---
fetch('datos/rpg-preguntas.json')
  .then(res => res.json())
  .then(data => {
    preguntasRPG = data.niveles || {};
    inicializarRPG();
  });

function obtenerSemanaAnio() {
  const d = new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 4 - (d.getDay()||7));
  const yearStart = new Date(d.getFullYear(),0,1);
  return d.getFullYear() + "-S" + Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

// --- Guardar/cargar progreso ---
function cargarProgreso() {
  const p = JSON.parse(localStorage.getItem("rpg_progreso")) || {};
  return p[cicloActual] || null;
}
function guardarProgreso(prog) {
  let p = JSON.parse(localStorage.getItem("rpg_progreso")) || {};
  p[cicloActual] = prog;
  localStorage.setItem("rpg_progreso", JSON.stringify(p));
}

function inicializarRPG() {
  progresoRPG = cargarProgreso();
  document.getElementById("btn-comenzar").style.display = progresoRPG ? "none" : "inline-block";
  document.getElementById("btn-continuar").style.display = progresoRPG ? "inline-block" : "none";
  document.getElementById("juego-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.add("oculto");
  document.getElementById("logros-rpg").classList.add("oculto");
}

// --- Empieza nueva partida ---
document.getElementById("btn-comenzar").onclick = () => {
  progresoRPG = {
    nivel: 1,
    vidas: 3,
    pregunta: 0,
    preguntasNivel: null, // <-- NUEVO, para persistencia real
    completado: false,
    rango: "",
    xp: 0
  };
  guardarProgreso(progresoRPG);
  jugarNivel();
};
document.getElementById("btn-continuar").onclick = () => {
  jugarNivel();
};
document.getElementById("btn-logros").onclick = () => {
  mostrarLogros();
};

// --- Lógica de preguntas y avance ---
function jugarNivel() {
  const juego = document.getElementById("juego-rpg");
  juego.classList.remove("oculto");
  document.getElementById("menu-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.add("oculto");
  document.getElementById("logros-rpg").classList.add("oculto");

  const nivel = progresoRPG.nivel;

  // Guardar el array de preguntas en el progreso SOLO la primera vez en cada nivel
  if (!progresoRPG.preguntasNivel || progresoRPG.preguntasNivel.length !== 5) {
    progresoRPG.preguntasNivel = mezclarArray([...preguntasRPG[nivel]]).slice(0, 5);
    progresoRPG.pregunta = 0; // Siempre empieza en la 0 al entrar a nivel nuevo
    guardarProgreso(progresoRPG);
  }
  mostrarPregunta();

  function mostrarPregunta() {
    const preguntaActual = progresoRPG.pregunta || 0;
    const p = progresoRPG.preguntasNivel[preguntaActual];

    juego.innerHTML = `
      <div class="panel-pregunta">
        <div class="rpg-info">
          <span class="rpg-nivel">Nivel: ${nivel}</span>
          <span class="rpg-vidas">${"❤️".repeat(progresoRPG.vidas)}</span>
        </div>
        <div class="rpg-pregunta"><b>${p.pregunta}</b></div>
        <div class="rpg-opciones">
          ${p.opciones.map((op, i) => `<button class="rpg-btn-op" data-i="${i}">${op}</button>`).join("")}
        </div>
        <small>Si fallas, pierdes una vida. ¡Suerte!</small>
      </div>
    `;

    document.querySelectorAll('.rpg-btn-op').forEach(btn => {
      btn.onclick = () => {
        const correcta = p.opciones[btn.dataset.i] === p.respuesta;
        if (correcta) {
          btn.classList.add("acierto");
          progresoRPG.xp += nivel * 10;
        } else {
          btn.classList.add("fallo");
          progresoRPG.vidas--;
          const vidasEl = document.querySelector('.rpg-vidas');
          if (vidasEl) {
            vidasEl.classList.add("shake");
            setTimeout(() => vidasEl.classList.remove("shake"), 400);
          }
        }
        setTimeout(() => {
          progresoRPG.pregunta = preguntaActual + 1;
          guardarProgreso(progresoRPG);
          if (progresoRPG.vidas <= 0) {
            terminarAventura();
          } else if (progresoRPG.pregunta >= 5) {
            progresoRPG.nivel++;
            progresoRPG.pregunta = 0;
            progresoRPG.preguntasNivel = null; // Al avanzar de nivel, se genera nuevo set
            guardarProgreso(progresoRPG);
            if (progresoRPG.nivel > 5) {
              terminarAventura(true);
            } else {
              mostrarMensajeNivel(`¡Avanzas al nivel ${progresoRPG.nivel}!`, jugarNivel);
            }
          } else {
            mostrarPregunta();
          }
        }, 700);
      };
    });
  }
}

function mostrarMensajeNivel(msg, cb) {
  const juego = document.getElementById("juego-rpg");
  juego.innerHTML = `
    <div class="panel-mensaje">
      <h2>${msg}</h2>
      <button id="btn-seguir-nivel">Continuar</button>
    </div>
  `;
  document.getElementById("btn-seguir-nivel").onclick = cb;
}

function terminarAventura(ganoTodo = false) {
  document.getElementById("juego-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.remove("oculto");
  const rango = obtenerRango(progresoRPG.nivel, ganoTodo);
  progresoRPG.rango = rango;
  progresoRPG.completado = true;
  guardarProgreso(progresoRPG);
  document.getElementById("resultados-rpg").innerHTML = `
    <h2>${ganoTodo ? "¡Felicidades, completaste la Trivia!" : "Fin de la aventura"}</h2>
    <p>Tu rango: <b>${rango}</b></p>
    <p>XP ganada: ${progresoRPG.xp}</p>
    <button onclick="window.location.reload()">Volver al inicio</button>
  `;
  document.getElementById("btn-comenzar").style.display = "none";
  document.getElementById("btn-continuar").style.display = "none";
}

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
