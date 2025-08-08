// =====================
//  Quiz Aleatorio – Grupal
// =====================

// Estado / datos
let preguntasDataGrupal = [];
let preguntasGrupal = [];
let equipos = [];
let rondaActual = 1;
const totalRondas = 3;
const preguntasPorRonda = 5; // por equipo en cada ronda
let indicePreguntaGlobal = 0; // recorre preguntas filtradas
let indiceEquipoTurno = 0;    // índice de equipo actual
let turnoSeleccion = 0;       // turno para elegir ventaja (3x3)

// Temporizador
let temporizadorActivo = null;

// Sonidos
const sonidoInicio = new Audio('assets/sonidos/inicio.mp3');
const sonidoCorrecto = new Audio('assets/sonidos/correcto.mp3');
const sonidoIncorrecto = new Audio('assets/sonidos/incorrecto.mp3');
const sonidoFondo = new Audio('assets/sonidos/background.mp3');
sonidoFondo.loop = true;
sonidoFondo.volume = 0.3;

function reproducirSonido(audioObj) {
  try {
    audioObj.pause();
    audioObj.currentTime = 0;
    audioObj.play();
  } catch (e) {}
}

// Utils
function mezclarArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function obtenerCategoriasUnicasGrupal(preguntas) {
  return [...new Set(preguntas.map(p => p.categoria))];
}

// ====== UI base ======
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const contenedor = () => document.getElementById("config-grupal");

// ====== Config (pantalla inicial) ======
function generarCheckboxCategoriasGrupal(preguntas) {
  const categorias = obtenerCategoriasUnicasGrupal(preguntas);
  const box = document.getElementById("elige-categorias-grupal");
  if (!box) return;
  box.innerHTML = "<h3 style='text-align:center;margin:0 0 .6rem 0;'>Categorías:</h3>" +
    categorias.map(cat => `
      <label>
        <input type="checkbox" name="categoria-grupal" value="${cat}" checked>
        <span>${cat}</span>
      </label>
    `).join("");
}

function obtenerCategoriasSeleccionadasGrupal() {
  return Array.from(document.querySelectorAll('input[name="categoria-grupal"]:checked'))
    .map(cb => cb.value);
}

function configurarBotonIniciarGrupal() {
  const btn = document.getElementById("iniciar-quiz-grupal");
  if (!btn) return;
  btn.onclick = () => {
    const cantidadEquipos = parseInt(document.getElementById("cantidad-equipos").value, 10) || 2;
    const categorias = obtenerCategoriasSeleccionadasGrupal();
    if (categorias.length === 0) {
      alert("Por favor selecciona al menos una categoría.");
      return;
    }
    iniciarJuegoGrupal(categorias, cantidadEquipos);
  };
}

// ====== Juego ======
const coloresEquipos = [
  { color: "#2196f3", nombre: "Azul" },
  { color: "#e53935", nombre: "Rojo" },
  { color: "#e91e63", nombre: "Rosado" },
  { color: "#4caf50", nombre: "Verde" }
];

// Mapa aleatorio de valores para tablero 3x3
function generarValoresRandom3x3() {
  let valores = [15, 8, 5, 5, 3, 0, 0, 0, 0];
  valores = mezclarArray(valores);
  const mapa = {};
  for (let i = 1; i <= 9; i++) mapa[i] = valores[i - 1];
  return mapa;
}

function iniciarJuegoGrupal(categoriasSeleccionadas, cantidadEquipos) {
  // build equipos
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

  // preparar preguntas
  preguntasGrupal = mezclarArray(
    preguntasDataGrupal.filter(p => categoriasSeleccionadas.includes(p.categoria))
  );
  indicePreguntaGlobal = 0;
  rondaActual = 1;
  indiceEquipoTurno = 0;
  turnoSeleccion = 0;

  sonidoFondo.play().catch(()=>{});

  mostrarTableroVentajaParaRonda();
}

// Renderiza tablero 3x3 y gestiona selección de ventajas
function mostrarTableroVentajaParaRonda() {
  const valores3x3 = generarValoresRandom3x3();

  contenedor().innerHTML = `
    <h2>Ronda ${rondaActual} – Ventajas de tiempo</h2>
    <p style="text-align:center">Equipos eligen una casilla (en orden) para obtener segundos extra.</p>

    <div id="tablero-ventaja"></div>
    <div id="info-seleccion" style="margin-top: 1em; font-weight: bold; text-align: center;"></div>
  `;

  // Construir 9 botones con números mezclados
  const nums = mezclarArray([1,2,3,4,5,6,7,8,9]);
  const tablero = document.getElementById("tablero-ventaja");
  nums.forEach(n => {
    const b = document.createElement("button");
    b.className = "casilla";
    b.dataset.casilla = String(n);
    b.textContent = n;
    tablero.appendChild(b);
  });

  const info = document.getElementById("info-seleccion");
  const casillas = $$("#tablero-ventaja .casilla");

  function actualizarTurnoTexto() {
    info.textContent = `Turno del equipo ${equipos[turnoSeleccion].id} (${equipos[turnoSeleccion].nombreColor})`;
  }

  actualizarTurnoTexto();

  casillas.forEach(btn => {
    btn.onclick = () => {
      if (turnoSeleccion >= equipos.length) return;

      const val = valores3x3[btn.dataset.casilla];
      equipos[turnoSeleccion].tiempoExtra = val;

      // color de equipo en la casilla
      btn.style.background = equipos[turnoSeleccion].color;
      btn.style.color = "#fff";
      btn.disabled = true;

      reproducirSonido(sonidoCorrecto);
      info.textContent = `¡Equipo ${equipos[turnoSeleccion].id} obtuvo ${val} segundos extra!`;

      turnoSeleccion++;
      if (turnoSeleccion < equipos.length) {
        setTimeout(actualizarTurnoTexto, 900);
      } else {
        setTimeout(() => {
          info.textContent = `Selección completada. Comenzando ronda ${rondaActual}...`;
        }, 900);
        setTimeout(() => comenzarRonda(), 2000);
      }
    };
  });
}

function comenzarRonda() {
  // reset preguntasContestadas por equipo para esta ronda
  equipos.forEach(e => e.preguntasContestadas = 0);
  indiceEquipoTurno = 0;
  mostrarPreguntaEquipo();
}

function mostrarPreguntaEquipo() {
  // si se acabaron las preguntas disponibles
  if (indicePreguntaGlobal >= preguntasGrupal.length) {
    terminarRonda();
    return;
  }

  const equipo = equipos[indiceEquipoTurno];

  // si este equipo ya respondió sus N preguntas de la ronda, pasar turno
  if (equipo.preguntasContestadas >= preguntasPorRonda) {
    return pasarTurno();
  }

  // tomar siguiente pregunta global
  const p = preguntasGrupal[indicePreguntaGlobal++];
  equipo.preguntasContestadas++;

  renderPregunta(p, equipo);
}

function renderPregunta(pregunta, equipo) {
  // Barajar opciones
  const opciones = [
    { texto: pregunta.respuesta, correcta: true },
    { texto: pregunta.opcion_1, correcta: false },
    { texto: pregunta.opcion_2, correcta: false },
    { texto: pregunta.opcion_3, correcta: false }
  ];
  mezclarArray(opciones);

  // Tiempo base + bonus del equipo
  const tiempoBase = 20 + (equipo.tiempoExtra || 0);

  // Render de pantalla de pregunta
  contenedor().innerHTML = `
    <div class="franja-equipo" style="background:${equipo.color}"></div>
    <h2>Ronda ${rondaActual} – Equipo ${equipo.id} (${equipo.nombreColor})</h2>
    <div id="temporizador">
      <div id="barra-tiempo">
        <div id="progreso"></div>
      </div>
      <div id="contador">${tiempoBase}s</div>
    </div>

    <strong id="pregunta" style="display:block;margin:.6rem 0 0.5rem 0;">${pregunta.pregunta}</strong>
    <div id="opciones"></div>

    <div id="info-ronda"></div>
  `;

  const opcionesContainer = document.getElementById("opciones");
  opcionesContainer.innerHTML = opciones.map((op, i) =>
    `<button class="btn-opcion" data-correcta="${op.correcta}">${op.texto}</button>`
  ).join("");

  reproducirSonido(sonidoInicio);
  if (sonidoFondo.paused) sonidoFondo.play().catch(()=>{});

  // Temporizador
  detenerTemporizador();
  iniciarTemporizador(
    tiempoBase,
    // timeout:
    () => {
      reproducirSonido(sonidoIncorrecto);
      mostrarTransicionSiguientePregunta(pasarTurno);
    }
  );

  // Clicks en opciones
  $$("#opciones .btn-opcion").forEach(btn => {
    btn.onclick = () => {
      const correcta = btn.dataset.correcta === "true";
      if (correcta) {
        equipo.puntaje++;
        reproducirSonido(sonidoCorrecto);
        btn.style.background = "#81c784";
      } else {
        reproducirSonido(sonidoIncorrecto);
        btn.style.background = "#e57373";
      }
      // bloquear más clicks
      deshabilitarOpciones();
      detenerTemporizador();
      mostrarTransicionSiguientePregunta(pasarTurno);
    };
  });
}

function deshabilitarOpciones() {
  $$("#opciones .btn-opcion").forEach(b => b.disabled = true);
}

// Temporizador de barra
function detenerTemporizador() {
  if (temporizadorActivo) {
    clearInterval(temporizadorActivo);
    temporizadorActivo = null;
  }
}

function iniciarTemporizador(duracionSegundos, onTimeout, onTick) {
  let tiempoRestante = duracionSegundos;
  const barra = document.getElementById("progreso");
  const contador = document.getElementById("contador");

  const pintar = () => {
    const pct = (tiempoRestante / duracionSegundos) * 100;
    if (barra) {
      barra.style.width = pct + "%";
      if (tiempoRestante <= 5) barra.style.background = "#e53935";
      else if (tiempoRestante <= 10) barra.style.background = "#fbc02d";
      else barra.style.background = "#4caf50";
    }
    if (contador) contador.textContent = `${tiempoRestante}s`;
    if (onTick) onTick(tiempoRestante);
  };

  pintar();
  temporizadorActivo = setInterval(() => {
    tiempoRestante--;
    pintar();
    if (tiempoRestante <= 0) {
      detenerTemporizador();
      onTimeout && onTimeout();
    }
  }, 1000);
}

// Transición entre preguntas
function mostrarTransicionSiguientePregunta(callback) {
  contenedor().innerHTML = `
    <div style="text-align:center; font-size:2em; margin:2em 0;">
      <strong>Preparando la siguiente pregunta...</strong>
      <div id="cuenta-transicion">5</div>
    </div>
  `;
  let cuenta = 5;
  const id = setInterval(() => {
    cuenta--;
    const el = document.getElementById("cuenta-transicion");
    if (el) el.textContent = cuenta;
    if (cuenta <= 0) {
      clearInterval(id);
      callback();
    }
  }, 1000);
}

// Pasar turno al siguiente equipo o terminar ronda
function pasarTurno() {
  indiceEquipoTurno++;
  if (indiceEquipoTurno >= equipos.length) indiceEquipoTurno = 0;

  // ¿todos completaron sus preguntas?
  const todosCompletaron = equipos.every(e => (e.preguntasContestadas || 0) >= preguntasPorRonda);

  if (todosCompletaron) terminarRonda();
  else mostrarPreguntaEquipo();
}

function terminarRonda() {
  // resumen parcial
  let html = `<h2>Fin de la ronda ${rondaActual}</h2>
  <p>Resultados parciales acumulados:</p>
  <ul>${equipos.map(e => `<li>Equipo ${e.id} (${e.nombreColor}): ${e.puntaje} puntos</li>`).join("")}</ul>
  <button id="btn-continuar-ronda">Continuar</button>`;

  contenedor().innerHTML = html;

  const btn = document.getElementById("btn-continuar-ronda");
  if (btn) {
    btn.onclick = () => {
      if (rondaActual < totalRondas) {
        rondaActual++;
        turnoSeleccion = 0; // reset para 3x3
        mostrarTableroVentajaParaRonda();
      } else {
        terminarJuego();
      }
    };
  }
}

function terminarJuego() {
  const ganador = equipos.reduce((max, e) => e.puntaje > max.puntaje ? e : max, equipos[0]);
  contenedor().innerHTML = `
    <h2>Juego finalizado</h2>
    <p>Ganador: Equipo ${ganador.id} (${ganador.nombreColor}) con ${ganador.puntaje} puntos</p>
    <ul>${equipos.map(e => `<li>Equipo ${e.id} (${e.nombreColor}): ${e.puntaje} puntos</li>`).join("")}</ul>
    <button id="btn-jugar-nuevamente">Jugar de nuevo</button>
  `;
  const btn = document.getElementById("btn-jugar-nuevamente");
  if (btn) btn.onclick = () => location.reload();
}

// ====== Bootstrap de la pantalla de configuración ======
function iniciarConfiguracionGrupal() {
  fetch('datos/quiz.json')
    .then(res => res.json())
    .then(data => {
      preguntasDataGrupal = data;
      generarCheckboxCategoriasGrupal(preguntasDataGrupal);
      configurarBotonIniciarGrupal();
    })
    .catch(() => {
      // fallback mínimo
      preguntasDataGrupal = [];
      generarCheckboxCategoriasGrupal([]);
      configurarBotonIniciarGrupal();
    });
}

window.iniciarConfiguracionGrupal = iniciarConfiguracionGrupal;
window.iniciarJuegoGrupal = iniciarJuegoGrupal;
