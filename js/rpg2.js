// Demo de mentores (puedes ampliar luego)
const MENTORES = [
  {
    id: "juan",
    nombre: "San Juan",
    img: "assets/img/mentor/juan.png",
    habilidades: [
      "Sabiduría +3",
      "Intuición Bíblica +2"
    ],
    presentacion: [
      "¡Hola! Soy San Juan, tu guía en este camino de fe.",
      "Juntos aprenderemos a profundizar en la Palabra.",
      "¿Listo para convertirte en un explorador bíblico?"
    ]
  },
  {
    id: "pablo",
    nombre: "San Pablo",
    img: "assets/img/mentor/pablo.png",
    habilidades: [
      "Disciplina +4",
      "Coraje +2"
    ],
    presentacion: [
      "¡Te acompaña San Pablo! Conmigo aprenderás a no rendirte.",
      "Recuerda, la constancia es clave en este reto.",
      "La fe mueve montañas. ¿Listo para el desafío?"
    ]
  }
  // ...agrega más mentores
];

let mentorElegido = null;

// ==== 1. Renderizar lista de mentores ====
function renderizarMentores() {
  const lista = document.getElementById("mentores-lista");
  lista.innerHTML = "";
  MENTORES.forEach(mentor => {
    const div = document.createElement("div");
    div.className = "mentor-card";
    div.innerHTML = `
      <img src="${mentor.img}" alt="${mentor.nombre}" class="mentor-avatar"/>
      <div class="mentor-nombre">${mentor.nombre}</div>
    `;
    div.onclick = () => mostrarDetalleMentor(mentor);
    lista.appendChild(div);
  });
}

function mostrarDetalleMentor(mentor) {
  mentorElegido = mentor;
  const detalle = document.getElementById("mentor-detalle");
  detalle.classList.remove("oculto");
  detalle.innerHTML = `
    <h3>${mentor.nombre}</h3>
    <img src="${mentor.img}" alt="${mentor.nombre}" class="mentor-avatar-grande"/>
    <div class="mentor-habilidades">
      <b>Habilidades:</b>
      <ul>
        ${mentor.habilidades.map(h => `<li>${h}</li>`).join("")}
      </ul>
    </div>
    <div class="mentor-msg-presentacion">
      “${mentor.presentacion[Math.floor(Math.random() * mentor.presentacion.length)]}”
    </div>
  `;
  document.getElementById("btn-seleccionar-mentor").classList.remove("oculto");
}

// ==== 2. Al seleccionar mentor ====
document.getElementById("btn-seleccionar-mentor").onclick = () => {
  if (!mentorElegido) return;
  // Oculta selección de mentor y muestra bienvenida
  document.getElementById("pantalla-mentor").classList.add("oculto");
  document.getElementById("pantalla-bienvenida").classList.remove("oculto");
  mostrarBienvenidaMentor();
};

function mostrarBienvenidaMentor() {
  // Renderiza el avatar y nombre
  document.getElementById("bienvenida-mentor").innerHTML = `
    <img src="${mentorElegido.img}" alt="${mentorElegido.nombre}" class="mentor-avatar-grande"/>
    <h2>¡Bienvenido con ${mentorElegido.nombre}!</h2>
  `;
  // Mensaje aleatorio del mentor
  const mensajes = [
    ...mentorElegido.presentacion,
    "¡Recuerda! Si tienes dudas, tu mentor siempre te anima a avanzar.",
    "Cada pregunta es una oportunidad de aprender y ganar XP."
  ];
  document.getElementById("mensaje-como-jugar").innerHTML = `
    <div class="mentor-msg-bienvenida">
      ${mensajes[Math.floor(Math.random() * mensajes.length)]}
    </div>
    <div class="mentor-tips">Tienes 3 vidas y ganas XP por cada acierto.<br>¿Listo para la aventura?</div>
  `;
}

// ==== 3. Al presionar “¡Comenzar aventura!” ====
document.getElementById("btn-iniciar-rpg").onclick = () => {
  alert("Aquí comenzaría la trivia RPG real (¡próximamente!).");
  // Aquí ocultarías pantalla bienvenida y mostrarías la de preguntas.
};

// ==== INICIALIZACIÓN ====
document.addEventListener("DOMContentLoaded", () => {
  renderizarMentores();
  // Muestra solo la pantalla de selección de mentor
  document.getElementById("pantalla-mentor").classList.remove("oculto");
  document.getElementById("pantalla-bienvenida").classList.add("oculto");
  document.getElementById("pantalla-juego").classList.add("oculto");
  document.getElementById("pantalla-resultados").classList.add("oculto");
});
