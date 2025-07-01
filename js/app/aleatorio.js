// js/app/aleatorio.js

let preguntasData = [];

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

    // --- TEMPORIZADOR Y BARRA ---
    const duracion = 20; // segundos
    let tiempoRestante = duracion;
    const barra = document.getElementById("progreso");
    let intervalo = setInterval(() => {
      tiempoRestante--;
      // Actualiza ancho barra
      let porcentaje = (tiempoRestante / duracion) * 100;
      barra.style.width = porcentaje + "%";
      // Cambia color según el tiempo
      if (tiempoRestante <= 5) {
        barra.style.background = "#e53935"; // rojo
      } else if (tiempoRestante <= 10) {
        barra.style.background = "#fbc02d"; // amarillo
      } else {
        barra.style.background = "#4caf50"; // verde
      }

      if (tiempoRestante <= 0) {
        clearInterval(intervalo);
        desactivarOpciones();
        siguientePregunta(false, true); // tiempo agotado
      }
    }, 1000);

    function desactivarOpciones() {
      document.querySelectorAll('.btn-opcion').forEach(btn => {
        btn.disabled = true;
      });
    }

    function siguientePregunta(respondioCorrecto, timeout = false) {
      clearInterval(intervalo);
      if (respondioCorrecto) aciertos++;
      indice++;
      setTimeout(() => {
        if (indice < preguntas.length) {
          mostrarPregunta();
        } else {
          mostrarResultado();
        }
      }, 700); // Pequeña pausa para que vea el resultado
    }

    document.querySelectorAll('.btn-opcion').forEach(btn => {
      btn.addEventListener('click', (e) => {
        desactivarOpciones();
        const correcta = btn.dataset.correcta === "true";
        btn.style.background = correcta ? "#81c784" : "#e57373"; // verde o rojo
        siguientePregunta(correcta);
      });
    });
  }

  function mostrarResultado() {
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
