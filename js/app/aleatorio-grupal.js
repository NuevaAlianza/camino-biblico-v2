// js/app/aleatorio-grupal.js

// Variables globales para preguntas (se cargan desde JSON)
let preguntasDataGrupal = [];

// Función para obtener categorías únicas de preguntas
function obtenerCategoriasUnicasGrupal(preguntas) {
  return [...new Set(preguntas.map(p => p.categoria))];
}

// Generar checkboxes para selección de categorías en modo grupal
function generarCheckboxCategoriasGrupal(preguntas) {
  const categorias = obtenerCategoriasUnicasGrupal(preguntas);
  const contenedor = document.getElementById("elige-categorias-grupal");
  contenedor.innerHTML = "<h3>Categorías:</h3>";
  categorias.forEach(cat => {
    contenedor.innerHTML += `
      <label style="margin-right:1em; cursor:pointer;">
        <input type="checkbox" name="categoria-grupal" value="${cat}" checked>
        <span>${cat}</span>
      </label>
    `;
  });
}

// Obtener categorías seleccionadas en modo grupal
function obtenerCategoriasSeleccionadasGrupal() {
  return Array.from(document.querySelectorAll('input[name="categoria-grupal"]:checked'))
    .map(cb => cb.value);
}

// Paleta colores para equipos (hasta 4 equipos) con nombre legible
const coloresEquipos = [
  { color: "#2196f3", nombre: "Azul" },
  { color: "#e53935", nombre: "Rojo" },
  { color: "#e91e63", nombre: "Rosado" },
  { color: "#4caf50", nombre: "Verde" }
];

// Variables para juego grupal
let equipos = [];
let rondaActual = 1;
const totalRondas = 3;
const preguntasPorRonda = 5; // Preguntas por equipo en cada ronda

let preguntasGrupal = []; // Preguntas filtradas y mezcladas
let indicePreguntaGlobal = 0; // Índice global para recorrer preguntas filtradas

let indiceEquipoTurno = 0; // Equipo actual

let turnoSeleccion = 0; // Turno para elegir ventaja (3x3)

// Temporizador
let temporizadorActivo = null;

// --- Sonidos (opcional) ---
const sonidoInicio = new Audio('assets/sonidos/inicio.mp3');
const sonidoCorrecto = new Audio('assets/sonidos/correcto.mp3');
const sonidoIncorrecto = new Audio('assets/sonidos/incorrecto.mp3');
const sonidoFondo = new Audio('assets/sonidos/background.mp3');
sonidoFondo.loop = true;
sonidoFondo.volume = 0.3;

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
  switch (parseInt(casilla, 10)) {
    case 1: return 15;
    case 2: return 8;
    case 3: return 5;
    default: return 0;
  }
}

// Detener temporizador si existe
function detenerTemporizador() {
  if (temporizadorActivo) {
    clearInterval(temporizadorActivo);
    temporizadorActivo = null;
  }
}

// Mostrar temporizador y controlar cuenta regresiva
function iniciarTemporizador(duracionSegundos, onTimeout, onTick) {
  let tiempoRestante = duracionSegundos;
  const barra = document.getElementById("progreso");
  const contador = document.getElementById("contador");

  barra.style.width = "100%";
  barra.style.background = "#4caf50";
  contador.textContent = `Tiempo: ${tiempoRestante}s`;

  temporizadorActivo = setInterval(() => {
    tiempoRestante--;
    const porcentaje = (tiempoRestante / duracionSegundos) * 100;
    barra.style.width = porcentaje + "%";

    if (tiempoRestante <= 5) {
      barra.style.background = "#e53935";
    } else if (tiempoRestante <= 10) {
      barra.style.background = "#fbc02d";
    } else {
      barra.style.background = "#4caf50";
    }

    contador.textContent = `Tiempo: ${tiempoRestante}s`;

    if (onTick) onTick(tiempoRestante);

    if (tiempoRestante <= 0) {
      detenerTemporizador();
      onTimeout();
    }
  }, 1000);
}

// --- Inicio de juego grupal ---
function iniciarJuegoGrupal(categoriasSeleccionadas, cantidadEquipos) {
  equipos = [];
  for (let i = 0; i < cantidadEquipos; i++) {
    equipos.push({
      id: i + 1,
      color: coloresEquipos[i].color,
      nombreColor: coloresEquipos[i].nombre,
      puntaje: 0,
      tiempoExtra: 0,
      preguntasContestadas: 0
    });
  }

  preguntasGrupal = mezclarArray(
    preguntasDataGrupal.filter(p => categoriasSeleccionadas.includes(p.categoria))
  );
  indicePreguntaGlobal = 0;
  rondaActual = 1;
  indiceEquipoTurno = 0;
  turnoSeleccion = 0;

  sonidoFondo.play().catch(() => {});

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

  // NUEVO: Barajamos los números del 1 al 9 para aleatorizar la disposición
  const casillas = mezclarArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (let i = 0; i < 9; i++) {
    html += `<button class="casilla" data-casilla="${casillas[i]}" style="padding: 20px; font-weight: bold; border-radius: 8px;">${casillas[i]}</button>`;
  }
  html += `</div>`;
  html += `<div id="info-seleccion" style="margin-top: 1em; font-weight: bold; text-align: center;"></div>`;

  contenedor.innerHTML = html;

  iniciarTurnosSeleccionVentaja();
}


// --- Controla turnos para que cada equipo elija ventaja ---
function iniciarTurnosSeleccionVentaja() {
  const info = document.getElementById("info-seleccion");

  if (turnoSeleccion >= equipos.length) return;

  info.textContent = `Turno del equipo ${equipos[turnoSeleccion].id} (${equipos[turnoSeleccion].nombreColor})`;

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
        info.textContent = `Turno del equipo ${equipos[turnoSeleccion].id} (${equipos[turnoSeleccion].nombreColor})`;
      } else {
        info.textContent = `Selección completada. Comenzando ronda ${rondaActual}...`;
        setTimeout(() => {
          comenzarRonda();
        }, 3000); // Cambiado a 3 segundos para mayor visibilidad
      }
    };
  });
}

// --- Inicia la ronda: turno primer equipo, primera pregunta ---
function comenzarRonda() {
  indiceEquipoTurno = 0;
  mostrarPreguntaEquipo();
}

// --- Mostrar pregunta para equipo actual ---
function mostrarPreguntaEquipo() {
  if (indicePreguntaGlobal >= preguntasGrupal.length) {
    terminarRonda();
    return;
  }

  const equipo = equipos[indiceEquipoTurno];

  if (equipo.preguntasContestadas >= preguntasPorRonda) {
    pasarTurno();
    return;
  }

  const p = preguntasGrupal[indicePreguntaGlobal];
  indicePreguntaGlobal++;

  equipo.preguntasContestadas++;

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

  // Tiempo base 20 + bonus de equipo
  const tiempoBase = 20 + equipo.tiempoExtra;

  let html = `
    <h2>Ronda ${rondaActual} - Equipo ${equipo.id} (${equipo.nombreColor})</h2>
    <div style="font-weight:bold; margin-bottom:0.5em;">Pregunta para el equipo ${equipo.id}</div>

    <div id="temporizador" style="display:flex; align-items:center; gap:10px; margin-bottom: 1em;">
      <div id="barra-tiempo" style="flex:1; height: 16px; background: #eee; border-radius: 8px;">
        <div id="progreso" style="height: 100%; width: 100%; background: #4caf50; border-radius: 8px; transition: width 0.2s;"></div>
      </div>
      <div id="contador" style="font-weight: bold; min-width: 48px;">Tiempo: ${tiempoBase}s</div>
    </div>

    <strong>${pregunta.pregunta}</strong>
    <div id="opciones" style="margin-top:1em;">
  `;

  opciones.forEach((op) => {
    html += `<button class="btn-opcion" data-correcta="${op.correcta}" style="display:block; margin:0.5em 0;">${op.texto}</button>`;
  });

  html += `</div> <div id="info-ronda" style="margin-top:1em; font-weight:bold;"></div>`;

  contenedor.innerHTML = html;

  // Sonido inicio pregunta
  sonidoInicio.play().catch(() => {});

  // Iniciar música de fondo si no está sonando
  if (sonidoFondo.paused) {
    sonidoFondo.play().catch(() => {});
  }

  // Iniciar temporizador
  detenerTemporizador();
  iniciarTemporizador(tiempoBase, () => {
    // Tiempo agotado → penalizar, pasar turno
    sonidoIncorrecto.play().catch(() => {});
    pasarTurno();
  });

  // Eventos para opciones
  document.querySelectorAll('.btn-opcion').forEach(btn => {
    btn.onclick = () => {
      const correcta = btn.dataset.correcta === "true";
      if (correcta) {
        equipo.puntaje++;
        sonidoCorrecto.play().catch(() => {});
        btn.style.background = "#81c784";
      } else {
        sonidoIncorrecto.play().catch(() => {});
        btn.style.background = "#e57373";
      }
      deshabilitarOpciones();
      detenerTemporizador();

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
  }

  // Revisar si todos los equipos completaron las preguntas de la ronda
  const todosCompletaron = equipos.every(e => (e.preguntasContestadas || 0) >= preguntasPorRonda);

  if (todosCompletaron) {
    terminarRonda();
  } else {
    mostrarPreguntaEquipo();
  }
}

// --- Final de ronda: resumen y botón continuar ---
function terminarRonda() {
  const contenedor = document.getElementById("config-grupal");

  // Reset contador preguntas para la siguiente ronda
  equipos.forEach(e => e.preguntasContestadas = 0);

  // Mostrar resumen acumulado (puntajes acumulados de todas las rondas)
  let resumen = `<h2>Fin de la ronda ${rondaActual}</h2>`;
  resumen += `<p>Resultados parciales acumulados:</p><ul>`;
  equipos.forEach(e => {
    resumen += `<li>Equipo ${e.id} (${e.nombreColor}): ${e.puntaje} puntos</li>`;
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
  html += `<p>Ganador: Equipo ${ganador.id} (${ganador.nombreColor}) con ${ganador.puntaje} puntos</p>`;
  html += `<ul>`;
  equipos.forEach(e => {
    html += `<li>Equipo ${e.id} (${e.nombreColor}): ${e.puntaje} puntos</li>`;
  });
  html += `</ul>`;
  html += `<button id="btn-jugar-nuevamente">Jugar de nuevo</button>`;

  contenedor.innerHTML = html;

  document.getElementById("btn-jugar-nuevamente").onclick = () => {
    location.reload();
  };

}

// Exportar función para iniciar el juego grupal desde otro script
window.iniciarJuegoGrupal = iniciarJuegoGrupal;

// Exportar función para iniciar configuración grupal desde HTML
window.iniciarConfiguracionGrupal = iniciarConfiguracionGrupal;

// Inicializar configuración grupal al mostrar esa sección
function iniciarConfiguracionGrupal() {
  fetch('datos/quiz.json')
    .then(res => res.json())
    .then(data => {
      preguntasDataGrupal = data;
      generarCheckboxCategoriasGrupal(preguntasDataGrupal);
      configurarBotonIniciarGrupal();
    });
}

// Configurar botón para iniciar juego grupal
function configurarBotonIniciarGrupal() {
  const btn = document.getElementById("iniciar-quiz-grupal");
  if (btn) {
    btn.onclick = () => {
      const cantidadEquipos = parseInt(document.getElementById("cantidad-equipos").value);
      const categoriasSeleccionadas = obtenerCategoriasSeleccionadasGrupal();
      if (categoriasSeleccionadas.length === 0) {
        alert("Por favor selecciona al menos una categoría.");
        return;
      }
      iniciarJuegoGrupal(categoriasSeleccionadas, cantidadEquipos);
    };
  }
}
