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

    // Prepara las opciones mezcladas (respuesta correcta y 3 falsas)
    const opciones = [
      { texto: p.respuesta, correcta: true },
      { texto: p.opcion_1, correcta: false },
      { texto: p.opcion_2, correcta: false },
      { texto: p.opcion_3, correcta: false }
    ].sort(() => Math.random() - 0.5);

    let html = `
      <div>
        <h3>Pregunta ${indice + 1} de ${preguntas.length}</h3>
        <strong>${p.pregunta}</strong>
        <div id="opciones">
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

    // Escucha los clics en las opciones
    document.querySelectorAll('.btn-opcion').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (btn.dataset.correcta === "true") aciertos++;
        indice++;
        if (indice < preguntas.length) {
          mostrarPregunta();
        } else {
          mostrarResultado();
        }
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

