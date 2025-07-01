// js/app/aleatorio.js

let preguntasData = [];

// --- SONIDOS ---
const sonidoInicio = new Audio('assets/sonidos/inicio.mp3');
const sonidoCorrecto = new Audio('assets/sonidos/correcto.mp3');
const sonidoIncorrecto = new Audio('assets/sonidos/incorecto.mp3');
const sonidoFondo = new Audio('assets/sonidos/background.mp3');
sonidoFondo.volume = 0.4;

function reproducirSonido(audioObj) {
  try {
    audioObj.currentTime = 0;
    audioObj.play();
  } catch (e) {}
}

function obtenerCategoriasUnicas(preguntasData) {
  return [...new Set(preguntasData.map(p => p.categoria))];
}

function generarCheckboxCategorias(preguntasData) {
  const categorias = obtenerCategoriasUnicas(preguntasData);
  const contenedor = document.getElementById("elige-categorias");
  contenedor.innerHTML = "<h3>Categorías:</h3>";
  categorias.forEach(cat => {
    contenedor.innerHTML += `
      <label style="margin-right:1em;">
        <input type="checkbox" name="categoria" value="${cat}" checked>
        ${cat}
      </label>
    `;
  });
}

function obtenerPreguntasFiltradas(preguntasData) {
  const seleccionados = Array.from(document.querySelectorAll('input[name="categoria"]:checked'))
    .map(cb => cb.value);
  return preguntasData.filter(p => seleccionados.includes(p.categoria));
}

// Mezclar array (Fisher–Yates shuffle)
function mezclarArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function iniciarQuizConPreguntas(preguntas) {
  let indice = 0;
  let aciertos = 0;
  const juegoDiv = document.getElementById("juego-aleatorio");
  const configDiv = document.getElementById("config-quiz-random");

  configDiv.classList.add("oculto");
  juegoDiv.classList.remove("oculto");

 function mostrarPregunta() {
  reproducirSonido(sonidoInicio);

  const p = preguntas[indice];

  // Opciones mezcladas (respuesta correcta y 3 falsas)
  const opciones = [
    { texto: p.respuesta, correcta: true },
    { texto: p.opcion_1, correcta: false },
    { texto: p.opcion_2, correcta: false },
    { texto: p.opcion_3, correcta: false }
  ].sort(() => Math.random() - 0.5);

  let html = `
    <div>
      <h3>Pregunta ${indice + 1} de ${preguntas.length}</h3>
      <div id="barra-tiempo" style="width: 100%; height: 16px; background: #eee; border-radius: 8px; margin-bottom: 1em;">
        <div id="progreso" style="height: 100%; width: 100%; background: #4caf50; border-radius: 8px; transition: width 0.2s;"></div>
      </div>
      <div id="contador" style="font-weight: bold; margin:0.5em 0;">Tiempo: 20s</div>
      <strong>${p.pregunta}</strong>
      <div id="opciones" style="margin-top:1em;">
  `;

  opciones.forEach((op, i) => {
    html += `<button class="btn-opcion" data-correcta="${op.correcta}" style="display:block;margin:0.5em 0;">${op.texto}</button>`;
  });

  html += `
      </div>
      <small>${p.categoria} / ${p.tema}</small>
    </div>
  `;

  juegoDiv.innerHTML = html;

  // --- TEMPORIZADOR Y BARRA FLUIDA ---
  const duracion = 20; // segundos
  const barra = document.getElementById("progreso");
  const contador = document.getElementById("contador");
  const tiempoInicio = Date.now();
  const tiempoFin = tiempoInicio + duracion * 1000;
  let terminado = false;

  function actualizarBarra() {
    if (terminado) return;
    const ahora = Date.now();
    let restante = (tiempoFin - ahora) / 1000; // en segundos
    if (restante < 0) restante = 0;
    const porcentaje = (restante / duracion) * 100;
    barra.style.width = porcentaje + "%";

    // Cambia color según el tiempo
    if (restante <= 5) {
      barra.style.background = "#e53935";
    } else if (restante <= 10) {
      barra.style.background = "#fbc02d";
    } else {
      barra.style.background = "#4caf50";
    }

    contador.textContent = `Tiempo: ${Math.ceil(restante)}s`;

    if (restante > 0) {
      requestAnimationFrame(actualizarBarra);
    } else {
      terminado = true;
      desactivarOpciones();
      reproducirSonido(sonidoIncorrecto);
      sonidoFondo.pause();
      siguientePregunta(false, true);
    }
  }
  actualizarBarra();

  function desactivarOpciones() {
    document.querySelectorAll('.btn-opcion').forEach(btn => {
      btn.disabled = true;
    });
  }

  function siguientePregunta(respondioCorrecto, timeout = false) {
    if (terminado) return;
    terminado = true;
    if (respondioCorrecto) aciertos++;
    indice++;
    setTimeout(() => {
      if (indice < preguntas.length) {
        mostrarPregunta();
      } else {
        mostrarResultado();
      }
    }, 700); // Pausa para ver la respuesta
  }

  document.querySelectorAll('.btn-opcion').forEach(btn => {
    btn.addEventListener('click', (e) => {
      desactivarOpciones();
      const correcta = btn.dataset.correcta === "true";
      if (correcta) {
        reproducirSonido(sonidoCorrecto);
      } else {
        reproducirSonido(sonidoIncorrecto);
      }
      btn.style.background = correcta ? "#81c784" : "#e57373"; // verde o rojo
      sonidoFondo.pause();
      siguientePregunta(correcta);
    });
  });
}


  function mostrarResultado() {
    sonidoFondo.pause();
    juegoDiv.innerHTML = `
      <h2>¡Quiz finalizado!</h2>
      <p>Respondiste correctamente <b>${aciertos}</b> de <b>${preguntas.length}</b> preguntas.</p>
      <button onclick="window.location.reload()">Volver a configurar</button>
      <a href="index.html" class="btn-volver">Volver al inicio</a>
    `;
  }

  mostrarPregunta();
}

// --- Carga inicial y evento de iniciar quiz ---

document.addEventListener("DOMContentLoaded", () => {
  fetch('datos/quiz.json')
    .then(res => res.json())
    .then(data => {
      preguntasData = data;
      generarCheckboxCategorias(preguntasData);
    });

  document.getElementById("iniciar-quiz-random").addEventListener("click", () => {
    const cantidad = parseInt(document.getElementById("cantidad-preguntas").value);
    let preguntasFiltradas = obtenerPreguntasFiltradas(preguntasData);
    preguntasFiltradas = mezclarArray(preguntasFiltradas).slice(0, cantidad);
    iniciarQuizConPreguntas(preguntasFiltradas);
  });
});
