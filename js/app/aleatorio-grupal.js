// js/app/aleatorio-grupal.js

// Variables globales para modo grupal
let preguntasData = []; // Se cargará desde JSON igual que en modo solitario

// Equipos: colores y puntajes iniciales, se configuran dinámicamente según cantidad de equipos
let equipos = [];

// Control de rondas y preguntas
let rondaActual = 1;
const totalRondas = 3;
const preguntasPorRonda = 5; // Preguntas por equipo en cada ronda

let preguntasGrupal = []; // Preguntas filtradas y mezcladas para el juego grupal
let preguntasUsadas = new Set(); // Para evitar repetir preguntas
let indiceEquipoTurno = 0; // Equipo que responde actualmente
let indicePreguntaRonda = 0; // Pregunta actual dentro de la ronda

// Turno para selección de ventaja (antes de ronda)
let turnoSeleccion = 0;

// Paleta colores para equipos (hasta 4 equipos)
const coloresEquipos = ["#2196f3", "#e53935", "#e91e63", "#4caf50"];

// --- Funciones auxiliares ---

// Mezclar array (Fisher–Yates)
function mezclarArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Asigna segundos extra según casilla 1-9 en 3x3
function calcularTiempoExtra(casilla) {
  // Ejemplo: casilla 1 da 15 seg, 2 da 8 seg, 3 da 5 seg, resto 0 seg
  switch (parseInt(casilla, 10)) {
    case 1: return 15;
    case 2: return 8;
    case 3: return 5;
    default: return 0;
  }
}

// --- Inicio de juego grupal ---
function iniciarJuegoGrupal(categoriasSeleccionadas, cantidadEquipos) {
  // Inicializa equipos con colores y puntaje 0
  equipos = [];
  for (let i = 0; i < cantidadEquipos; i++) {
    equipos.push({
      id: i + 1,
      color: coloresEquipos[i],
      puntaje: 0,
      tiempoExtra: 0
    });
  }

  // Filtrar preguntas por categorías y mezclarlas
  preguntasGrupal = mezclarArray(
    preguntasData.filter(p => categoriasSeleccionadas.includes(p.categoria))
  );
  preguntasUsadas.clear();

  rondaActual = 1;
  indiceEquipoTurno = 0;
  indicePreguntaRonda = 0;
  turnoSeleccion = 0;

  mostrarTableroVentajaParaRonda();
}

// --- Muestra tablero 3x3 para seleccionar ventaja ---
function mostrarTableroVentajaParaRonda() {
  const contenedor = document.getElementById("config-grupal");
  let html = `
    <h2>Ronda ${rondaActual} - Ventajas de tiempo</h2>
    <p>Equipos eligen casilla para ventaja de tiempo, en orden.</p>
    <div id="tablero-ventaja" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-width: 300px; margin: 1em auto;">
  `;
  for (let i = 1; i <= 9; i++) {
    html += `<button class="casilla" data-casilla="${i}" style="padding: 20px; font-weight: bold; border-radius: 8px;">${i}</button>`;
  }
  html += `</div>`;
  html += `<div id="info-seleccion" style="margin-top: 1em; font-weight: bold; text-align: center;"></div>`;

  contenedor.innerHTML = html;

  iniciarTurnosSeleccionVentaja();
}

// --- Controla turnos para que cada equipo elija ventaja ---
function iniciarTurnosSeleccionVentaja() {
  const info = document.getElementById("info-seleccion");
  info.textContent = `Turno del equipo ${equipos[turnoSeleccion].id} (color: ${equipos[turnoSeleccion].color})`;

  const casillas = document.querySelectorAll("#tablero-ventaja .casilla");
  casillas.forEach(btn => {
    btn.disabled = false;
    btn.style.background = "";
    btn.onclick = () => {
      if (turnoSeleccion >= equipos.length) return;

      equipos[turnoSeleccion].tiempoExtra = calcularTiempoExtra(btn.dataset.casilla);
      btn.style.background = equipos[turnoSeleccion].color;
      btn.disabled = true;

      turnoSeleccion++;
      if (turnoSeleccion < equipos.length) {
        info.textContent = `Turno del equipo ${equipos[turnoSeleccion].id} (color: ${equipos[turnoSeleccion].color})`;
      } else {
        info.textContent = `Selección completada. Comenzando ronda ${rondaActual}...`;
        setTimeout(() => {
          comenzarRonda();
        }, 1500);
      }
    };
  });
}

// --- Inicia la ronda: turno primer equipo, primer pregunta ---
function comenzarRonda() {
  indiceEquipoTurno = 0;
  indicePreguntaRonda = 0;
  mostrarPreguntaEquipo();
}

// --- Mostrar pregunta para equipo actual ---
function mostrarPreguntaEquipo() {
  const equipo = equipos[indiceEquipoTurno];

  // Buscar siguiente pregunta no usada
  let p = null;
  while (indicePreguntaRonda < preguntasGrupal.length) {
    if (!preguntasUsadas.has(preguntasGrupal[indicePreguntaRonda])) {
      p = preguntasGrupal[indicePreguntaRonda];
      preguntasUsadas.add(p);
      break;
    }
    indicePreguntaRonda++;
  }

  if (!p || indicePreguntaRonda >= preguntasGrupal.length) {
    terminarRonda();
    return;
  }

  mostrarPregunta(p, equipo);
}

// --- Renderiza la pregunta y opciones ---
function mostrarPregunta(pregunta, equipo) {
  const contenedor = document.getElementById("config-grupal");
  const opciones = [
    { texto: pregunta.respuesta, correcta: true },
    { texto: pregunta.opcion_1, correcta: false },
    { texto: pregunta.opcion_2, correcta: false },
    { texto: pregunta.opcion_3, correcta: false }
  ].sort(() => Math.random() - 0.5);

  let html = `
    <h2>Ronda ${rondaActual} - Equipo ${equipo.id} (${equipo.color})</h2>
    <div style="font-weight:bold; margin-bottom:0.5em;">Pregunta para el equipo ${equipo.id}</div>
    <strong>${pregunta.pregunta}</strong>
    <div id="opciones" style="margin-top:1em;">
  `;

  opciones.forEach((op, i) => {
    html += `<button class="btn-opcion" data-correcta="${op.correcta}" style="display:block; margin:0.5em 0;">${op.texto}</button>`;
  });

  html += `</div> <div id="info-ronda" style="margin-top:1em; font-weight:bold;"></div>`;

  contenedor.innerHTML = html;

  document.querySelectorAll('.btn-opcion').forEach(btn => {
    btn.onclick = () => {
      const correcta = btn.dataset.correcta === "true";
      if (correcta) {
        equipo.puntaje++;
        btn.style.background = "#81c784";
      } else {
        btn.style.background = "#e57373";
      }
      deshabilitarOpciones();

      setTimeout(() => {
        pasarTurno();
      }, 700);
    };
  });
}

function deshabilitarOpciones() {
  document.querySelectorAll('.btn-opcion').forEach(btn => {
    btn.disabled = true;
  });
}

// --- Cambia turno al siguiente equipo/pregunta ---
function pasarTurno() {
  indiceEquipoTurno++;
  if (indiceEquipoTurno >= equipos.length) {
    indiceEquipoTurno = 0;
    indicePreguntaRonda++;
  }

  if (indicePreguntaRonda >= preguntasPorRonda) {
    terminarRonda();
  } else {
    mostrarPreguntaEquipo();
  }
}

// --- Final de ronda: resumen y botón continuar ---
function terminarRonda() {
  const contenedor = document.getElementById("config-grupal");
  let resumen = `<h2>Fin de la ronda ${rondaActual}</h2>`;
  resumen += `<p>Resultados parciales:</p><ul>`;
  equipos.forEach(e => {
    resumen += `<li>Equipo ${e.id} (${e.color}): ${e.puntaje} puntos</li>`;
  });
  resumen += `</ul>`;
  resumen += `<button id="btn-continuar-ronda">Continuar</button>`;

  contenedor.innerHTML = resumen;

  document.getElementById("btn-continuar-ronda").onclick = () => {
    if (rondaActual < totalRondas) {
      rondaActual++;
      mostrarTableroVentajaParaRonda();
    } else {
      terminarJuego();
    }
  };
}

// --- Final del juego: muestra ganador ---
function terminarJuego() {
  const contenedor = document.getElementById("config-grupal");
  let ganador = equipos.reduce((max, eq) => (eq.puntaje > max.puntaje ? eq : max), equipos[0]);

  let html = `<h2>Juego finalizado</h2>`;
  html += `<p>Ganador: Equipo ${ganador.id} (${ganador.color}) con ${ganador.puntaje} puntos</p>`;
  html += `<ul>`;
  equipos.forEach(e => {
    html += `<li>Equipo ${e.id} (${e.color}): ${e.puntaje} puntos</li>`;
  });
  html += `</ul>`;
  html += `<button id="btn-jugar-nuevamente">Jugar de nuevo</button>`;

  contenedor.innerHTML = html;

  document.getElementById("btn-jugar-nuevamente").onclick = () => {
    location.reload();
  };
}

// --- Exportar la función principal para que se pueda llamar desde otro script ---
window.iniciarJuegoGrupal = iniciarJuegoGrupal;
