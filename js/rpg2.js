// === Mentores disponibles y sus habilidades ===
const MENTORES = [
  {
    id: "san_juan",
    nombre: "San Juan Vianney",
    img: "assets/img/mentor/mentor_cura.png",
    habilidades: [
      "Oración poderosa", "Empatía pastoral", "Consejo certero", "Ánimo inagotable", "Discernimiento espiritual"
    ],
    mensajes: [
      "Confía en el Señor y avanza con alegría.",
      "Recuerda que la oración es tu fuerza.",
      "La paciencia y el amor abren todas las puertas."
    ]
  },
  {
    id: "santa_teresa",
    nombre: "Santa Teresa de Ávila",
    img: "assets/img/mentor/santa_teresa.png",
    habilidades: [
      "Mente brillante", "Oración profunda", "Valor ante la adversidad", "Paz interior", "Intuición femenina"
    ],
    mensajes: [
      "Nada te turbe, nada te espante.",
      "Dios basta, sigue adelante.",
      "La humildad es la clave del crecimiento."
    ]
  },
  {
    id: "san_pablo",
    nombre: "San Pablo",
    img: "assets/img/mentor/san_pablo.png",
    habilidades: [
      "Valentía", "Sabiduría escritural", "Entusiasmo misionero", "Persuasión", "Fe contagiosa"
    ],
    mensajes: [
      "Todo lo puedo en Aquel que me fortalece.",
      "Sé firme en la fe y valiente en las pruebas.",
      "La Palabra es tu espada, úsala con sabiduría."
    ]
  }
];

// ========== Selección de Mentor ==========
let mentorSeleccionado = null;
let habilidadesAsignadas = [];
let mensajeBienvenida = "";

function renderMentores() {
  const container = document.getElementById('mentor-section');
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

  // Eventos de selección
  document.querySelectorAll('.mentor-card').forEach(card => {
    card.onclick = () => seleccionarMentor(card.dataset.idx);
  });
}

// Función para elegir habilidades aleatorias y únicas por mentor
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
  mensajeBienvenida = mentorSeleccionado.mensajes[
    Math.floor(Math.random() * mentorSeleccionado.mensajes.length)
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
    // Aquí luego se conecta el flujo RPG real
    alert('Aquí empezaría la trivia RPG 2...');
  };
}

// Init
document.addEventListener('DOMContentLoaded', renderMentores);
