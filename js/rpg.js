let rpgCiclos = {};
let cicloActual = obtenerSemanaAnio();
let datosCiclo = null; // Datos del ciclo actual: título, descripcion, niveles...
let progresoRPG = null;

// Configurable: preguntas por nivel (ej: nivel 1=5, 2=5, 3=4, 4=4, 5=3)
const preguntasPorNivel = [5, 5, 4, 4, 3];

fetch('datos/rpg-preguntas.json')
  .then(res => res.json())
  .then(data => {
    rpgCiclos = data.ciclos || {};
    datosCiclo = rpgCiclos[cicloActual];
    if (!datosCiclo) {
      mostrarSinCiclo();
      return;
    }
    inicializarPanelInicio();
    inicializarRPG();
  });

// --- Obtener la semana/ciclo actual (formato: 2025-S28) ---
function obtenerSemanaAnio() {
  const d = new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 4 - (d.getDay()||7));
  const yearStart = new Date(d.getFullYear(),0,1);
  return d.getFullYear() + "-S" + Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

function mostrarSinCiclo() {
  document.getElementById("menu-rpg").innerHTML = `
    <div class="panel-mensaje">
      <h2>No hay trivia RPG programada para esta semana.</h2>
      <p>¡Vuelve la próxima semana!</p>
    </div>
  `;
  document.getElementById("btn-comenzar").style.display = "none";
  document.getElementById("btn-continuar").style.display = "none";
}

// ---- PANEL INICIO: título, descripción y mensaje motivacional ----
function inicializarPanelInicio() {
  document.getElementById("titulo-ciclo").textContent = datosCiclo.titulo || "Trivia Bíblica RPG";
  document.getElementById("descripcion-ciclo").textContent = datosCiclo.descripcion || "";
  document.getElementById("mensaje-rpg").textContent =
    "Recuerda: solo tienes 3 vidas para demostrar tu valía. ¿Listo para el reto?";
}

// ---- Guardar/cargar progreso (Supabase o local) ----
async function cargarProgreso() {
  if (window.supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (userId) {
      const { data, error } = await supabase
        .from("progreso")
        .select("*")
        .eq("user_id", userId)
        .eq("tipo", "rpg")
        .eq("clave", cicloActual)
        .single();
      if (data && data.progreso) return JSON.parse(data.progreso);
      return null;
    }
  }
  // LocalStorage fallback
  const p = JSON.parse(localStorage.getItem("rpg_progreso")) || {};
  return p[cicloActual] || null;
}

async function guardarProgreso(prog) {
  if (window.supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (userId) {
      await supabase.from("progreso").upsert([{
        user_id: userId,
        tipo: "rpg",
        clave: cicloActual,
        progreso: JSON.stringify(prog),
        fecha: new Date().toISOString()
      }]);
      return;
    }
  }
  let p = JSON.parse(localStorage.getItem("rpg_progreso")) || {};
  p[cicloActual] = prog;
  localStorage.setItem("rpg_progreso", JSON.stringify(p));
}

async function inicializarRPG() {
  progresoRPG = await cargarProgreso();
  document.getElementById("btn-comenzar").style.display = progresoRPG ? "none" : "inline-block";
  document.getElementById("btn-continuar").style.display = progresoRPG ? "inline-block" : "none";
  document.getElementById("juego-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.add("oculto");
  document.getElementById("logros-rpg").classList.add("oculto");
}

// --- Comenzar nueva partida ---
document.getElementById("btn-comenzar").onclick = async () => {
  progresoRPG = {
    nivel: 1,
    vidas: 3,
    pregunta: 0,
    preguntasNivel: null,
    completado: false,
    rango: "",
    xp: 0
  };
  await guardarProgreso(progresoRPG);
  jugarNivel();
};

document.getElementById("btn-continuar").onclick = () => {
  jugarNivel();
};
document.getElementById("btn-logros").onclick = () => {
  mostrarLogros();
};

// ---- Jugar nivel ----
function jugarNivel() {
  const juego = document.getElementById("juego-rpg");
  juego.classList.remove("oculto");
  document.getElementById("menu-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.add("oculto");
  document.getElementById("logros-rpg").classList.add("oculto");

  const nivel = progresoRPG.nivel;
  const nivelKey = nivel.toString();

  // ¿Cuántas preguntas en este nivel? (por configuración)
  const numPreguntas = preguntasPorNivel[nivel - 1] || 3;

  // --- Validación: existen preguntas para este nivel ---
  if (!datosCiclo.niveles || !Array.isArray(datosCiclo.niveles[nivelKey])) {
    juego.innerHTML = `<div class="panel-mensaje">
      <h2>¡No hay preguntas para el nivel ${nivel}!</h2>
      <p>Verifica tu archivo <b>rpg-preguntas.json</b></p>
      <button onclick="window.location.reload()">Volver</button>
    </div>`;
    return;
  }

  // Guardar el array de preguntas en el progreso SOLO la primera vez en cada nivel
  if (!progresoRPG.preguntasNivel || progresoRPG.preguntasNivel.length !== numPreguntas) {
    progresoRPG.preguntasNivel = mezclarArray([...datosCiclo.niveles[nivelKey]]).slice(0, numPreguntas);
    progresoRPG.pregunta = 0;
    guardarProgreso(progresoRPG);
  }
  mostrarPregunta();

  function mostrarPregunta() {
    const preguntaActual = progresoRPG.pregunta || 0;
    const p = progresoRPG.preguntasNivel[preguntaActual];

    juego.innerHTML = `
      <div class="panel-pregunta">
        <div class="rpg-info">
          <span class="rpg-nivel">Nivel: ${nivel}</span>
          <span class="rpg-vidas">${"❤️".repeat(progresoRPG.vidas)}</span>
        </div>
        <div class="rpg-pregunta"><b>${p.pregunta}</b></div>
        <div class="rpg-opciones">
          ${p.opciones.map((op, i) => `<button class="rpg-btn-op" data-i="${i}">${op}</button>`).join("")}
        </div>
        <small>Si fallas, pierdes una vida. ¡Suerte!</small>
      </div>
    `;

    document.querySelectorAll('.rpg-btn-op').forEach(btn => {
      btn.onclick = async () => {
        const correcta = p.opciones[btn.dataset.i] === p.respuesta;
        if (correcta) {
          btn.classList.add("acierto");
          progresoRPG.xp += nivel * 10;
        } else {
          btn.classList.add("fallo");
          progresoRPG.vidas--;
          const vidasEl = document.querySelector('.rpg-vidas');
          if (vidasEl) {
            vidasEl.classList.add("shake");
            setTimeout(() => vidasEl.classList.remove("shake"), 400);
          }
        }
        setTimeout(async () => {
          progresoRPG.pregunta = preguntaActual + 1;
          await guardarProgreso(progresoRPG);
          if (progresoRPG.vidas <= 0) {
            terminarAventura();
          } else if (progresoRPG.pregunta >= numPreguntas) {
            progresoRPG.nivel++;
            progresoRPG.pregunta = 0;
            progresoRPG.preguntasNivel = null; // Nuevo set en siguiente nivel
            await guardarProgreso(progresoRPG);
            // Si terminó el último nivel (5), termina la aventura
            if (progresoRPG.nivel > preguntasPorNivel.length) {
              terminarAventura(true);
            } else {
              mostrarMensajeNivel(`¡Avanzas al nivel ${progresoRPG.nivel}!`, jugarNivel);
            }
          } else {
            mostrarPregunta();
          }
        }, 700);
      };
    });
  }
}

function mostrarMensajeNivel(msg, cb) {
  const juego = document.getElementById("juego-rpg");
  juego.innerHTML = `
    <div class="panel-mensaje">
      <h2>${msg}</h2>
      <button id="btn-seguir-nivel">Continuar</button>
    </div>
  `;
  document.getElementById("btn-seguir-nivel").onclick = cb;
}

function terminarAventura(ganoTodo = false) {
  document.getElementById("juego-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.remove("oculto");
  const rango = obtenerRango(progresoRPG.nivel, ganoTodo);
  progresoRPG.rango = rango;
  progresoRPG.completado = true;
  guardarProgreso(progresoRPG);

  // Mensaje épico y bloqueo hasta próximo ciclo
  document.getElementById("resultados-rpg").innerHTML = `
    <h2>${ganoTodo ? "¡Felicidades, completaste la Trivia!" : "Fin de la aventura"}</h2>
    <p>Tu rango: <b>${rango}</b></p>
    <p>XP ganada: ${progresoRPG.xp}</p>
    <div class="msg-epico">⚡️ Has completado el reto semanal. Vuelve la próxima semana para una nueva aventura.</div>
    <button onclick="window.location.reload()">Volver al inicio</button>
  `;
  document.getElementById("btn-comenzar").style.display = "none";
  document.getElementById("btn-continuar").style.display = "none";
}

function obtenerRango(nivel, ganoTodo) {
  if (ganoTodo) return "Maestro de la Palabra";
  if (nivel === 5) return "Sabio de las Escrituras";
  if (nivel === 4) return "Guerrero de la Fe";
  if (nivel === 3) return "Explorador Bíblico";
  if (nivel === 2) return "Principiante";
  return "Principiante";
}

function mezclarArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function mostrarLogros() {
  document.getElementById("menu-rpg").classList.add("oculto");
  document.getElementById("juego-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.add("oculto");
  document.getElementById("logros-rpg").classList.remove("oculto");
  document.getElementById("logros-rpg").innerHTML = `
    <h2>Logros RPG (próximamente)</h2>
    <button onclick="window.location.reload()">Volver</button>
  `;
}
