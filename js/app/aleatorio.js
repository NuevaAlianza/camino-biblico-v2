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

// Aquí puedes personalizar cómo se muestra cada pregunta
function mostrarPreguntas(preguntas) {
  const juegoDiv = document.getElementById("juego-aleatorio");
  const configDiv = document.getElementById("config-quiz-random");
  configDiv.classList.add("oculto");
  juegoDiv.classList.remove("oculto");
  let html = "<ol>";
  preguntas.forEach((p, idx) => {
    html += `
      <li style="margin-bottom:1em;">
        <strong>${p.pregunta}</strong><br>
        <ul style="list-style:none;">
          <li>A) ${p.respuesta}</li>
          <li>B) ${p.opcion_1}</li>
          <li>C) ${p.opcion_2}</li>
          <li>D) ${p.opcion_3}</li>
        </ul>
        <small>${p.categoria} / ${p.tema}</small>
      </li>
    `;
  });
  html += "</ol>";
  html += `<button onclick="window.location.reload()">Volver a configurar</button>`;
  juegoDiv.innerHTML = html;
}

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
    mostrarPreguntas(preguntasFiltradas);
  });
});
