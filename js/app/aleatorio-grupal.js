document.addEventListener("DOMContentLoaded", () => {
  const cantidadEquiposInput = document.getElementById("cantidad-equipos");
  const categoriasContainer = document.getElementById("elige-categorias-grupal");
  const iniciarBtn = document.getElementById("iniciar-quiz-grupal");
  const franjaEquipo = document.querySelector(".franja-equipo");
  const preguntaEl = document.getElementById("pregunta");
  const opcionesContainer = document.getElementById("opciones");
  const temporizador = document.getElementById("temporizador");
  const barraTiempo = document.getElementById("barra-tiempo");
  const progresoTiempo = document.getElementById("progreso");
  const contadorEl = document.getElementById("contador");
  const tableroVentaja = document.getElementById("tablero-ventaja");

  let categorias = ["Biblia", "Historia", "Geografía", "Liturgia"];
  let preguntas = []; // Aquí cargarías tus preguntas
  let tiempoRestante = 20;
  let timer;
  let equipoActual = 0;
  let cantidadEquipos = 2;

  // === Generar categorías ===
  categoriasContainer.innerHTML = categorias.map(cat => `
    <label>
      <input type="checkbox" value="${cat}">
      <span>${cat}</span>
    </label>
  `).join("");

  // === Iniciar juego ===
  iniciarBtn.addEventListener("click", () => {
    const seleccionadas = [...categoriasContainer.querySelectorAll("input:checked")].map(cb => cb.value);
    if (!seleccionadas.length) {
      alert("Selecciona al menos una categoría");
      return;
    }
    cantidadEquipos = parseInt(cantidadEquiposInput.value) || 2;
    iniciarRonda();
  });

  function iniciarRonda() {
    actualizarFranja();
    mostrarPregunta();
    iniciarTemporizador();
  }

  function actualizarFranja() {
    const coloresEquipos = ["#2196f3", "#e91e63", "#ff9800", "#4caf50"];
    franjaEquipo.style.background = coloresEquipos[equipoActual % coloresEquipos.length];
  }

  function mostrarPregunta() {
    preguntaEl.textContent = "Ejemplo de pregunta para el equipo " + (equipoActual + 1);
    opcionesContainer.innerHTML = "";
    ["Opción 1", "Opción 2", "Opción 3", "Opción 4"].forEach(op => {
      const btn = document.createElement("button");
      btn.className = "btn-opcion";
      btn.textContent = op;
      btn.addEventListener("click", () => validarRespuesta(op));
      opcionesContainer.appendChild(btn);
    });
  }

  function iniciarTemporizador() {
    tiempoRestante = 20;
    actualizarBarra();
    clearInterval(timer);
    timer = setInterval(() => {
      tiempoRestante--;
      actualizarBarra();
      if (tiempoRestante <= 0) {
        clearInterval(timer);
        pasarTurno();
      }
    }, 1000);
  }

  function actualizarBarra() {
    progresoTiempo.style.width = `${(tiempoRestante / 20) * 100}%`;
    if (tiempoRestante > 10) {
      progresoTiempo.style.background = "#4caf50";
    } else if (tiempoRestante > 5) {
      progresoTiempo.style.background = "#ff9800";
    } else {
      progresoTiempo.style.background = "#f44336";
    }
    contadorEl.textContent = `${tiempoRestante}s`;
  }

  function validarRespuesta(opcion) {
    clearInterval(timer);
    alert(`Respuesta seleccionada: ${opcion}`);
    pasarTurno();
  }

  function pasarTurno() {
    equipoActual = (equipoActual + 1) % cantidadEquipos;
    iniciarRonda();
  }

  // === Tablero 3x3 de ventajas ===
  function generarTableroVentaja() {
    tableroVentaja.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const casilla = document.createElement("div");
      casilla.className = "casilla";
      casilla.textContent = i + 1;
      casilla.addEventListener("click", () => {
        alert(`Elegiste la casilla ${i + 1}`);
      });
      tableroVentaja.appendChild(casilla);
    }
  }

  generarTableroVentaja();
});
