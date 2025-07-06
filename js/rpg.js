
        <br>${tip}
      </div>
      <button id="btn-seguir-nivel">Continuar</button>
    </div>let rpgCiclos = {};
let cicloActual = obtenerSemanaAnio();
let datosCiclo = null;
let progresoRPG = null;
let usuarioActual = null; // Usuario global

const preguntasPorNivel = [5, 5, 4, 4, 3];

// --- 1. Carga de datos y ciclo actual ---
fetch('datos/rpg-preguntas.json')
  .then(res => res.json())
  .then(async data => {
    rpgCiclos = data.ciclos || {};
    datosCiclo = rpgCiclos[cicloActual];
    if (!datosCiclo) {
      mostrarSinCiclo();
      return;
    }
    await mostrarStatsBienvenida(); // Panel superior (XP, ranking)
    inicializarPanelInicio();
    inicializarRPG();
  });

// --- 2. Funciones utilitarias ---
function obtenerSemanaAnio() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return d.getFullYear() + "-S" + Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
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

// --- 2b. Panel bienvenida: XP y ranking parroquia ---
async function mostrarStatsBienvenida() {
  const bienvenida = document.getElementById("bienvenida-stats");
  // 1. Obtener usuario actual de Supabase Auth
  const { data: sessionData } = await supabase.auth.getSession();
  usuarioActual = sessionData?.session?.user;
  if (!usuarioActual) {
    bienvenida.innerHTML = "";
    return;
  }

  // 2. XP total acumulada (suma todas sus filas)
  const { data: xpRows } = await supabase
    .from("rpg_progreso")
    .select("xp")
    .eq("user_id", usuarioActual.id);
  const xpTotal = xpRows ? xpRows.reduce((a, b) => a + (b.xp || 0), 0) : 0;

  // 3. Ranking en parroquia
  const parroquia = usuarioActual.user_metadata?.parroquia || null;
  let rankingHTML = "";
  if (parroquia) {
    const { data: parroquiaRows } = await supabase
      .from("rpg_progreso")
      .select("user_id, xp")
      .eq("parroquia", parroquia);
    // Suma XP total por user
    const rankingMap = {};
    (parroquiaRows || []).forEach(r => {
      if (!rankingMap[r.user_id]) rankingMap[r.user_id] = 0;
      rankingMap[r.user_id] += r.xp || 0;
    });
    // Ordena por XP desc
    const rankingArray = Object.entries(rankingMap)
      .map(([user_id, xp]) => ({ user_id, xp }))
      .sort((a, b) => b.xp - a.xp);
    const miRanking = rankingArray.findIndex(r => r.user_id === usuarioActual.id) + 1;
    rankingHTML = `
      <p>En tu parroquia eres el <b>#${miRanking > 0 ? miRanking : '-'}</b> de ${rankingArray.length}.</p>
      <p>¡Veamos si hoy avanzas al #1! 🚀</p>
    `;
  }
  // Renderiza el panel
  bienvenida.innerHTML = `
    <div class="panel-mensaje panel-bienvenida">
      <h2>¡Bienvenido!</h2>
      <p>Hasta hoy has acumulado <b>${xpTotal}</b> XP.</p>
      ${rankingHTML}
    </div>
  `;
}

// --- 3. Supabase: cargar y guardar progreso ---
async function cargarProgresoRPG() {
  if (window.supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    usuarioActual = sessionData?.session?.user; // Actualiza usuario global
    const userId = usuarioActual?.id;
    if (!userId) return null;
    const { data } = await supabase
      .from("rpg_progreso")
      .select("*")
      .eq("user_id", userId)
      .eq("ciclo", cicloActual)
      .single();
    return data;
  }
  // LocalStorage si no logueado
  const p = JSON.parse(localStorage.getItem("rpg_progreso")) || {};
  return p[cicloActual] || null;
}

async function guardarProgresoRPG({ nivel, rango, xp, completado }) {
  if (window.supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    usuarioActual = sessionData?.session?.user;
    const userId = usuarioActual?.id;
    const meta = usuarioActual?.user_metadata || {};
    if (!userId) return;
    await supabase.from("rpg_progreso").upsert([{
      user_id: userId,
      ciclo: cicloActual,
      nivel_max: nivel,
      rango,
      xp,
      completado,
      fecha_juego: new Date().toISOString(),
      pais: meta.pais || null,
      ciudad: meta.ciudad || null,
      parroquia: meta.parroquia || null
    }]);
    return;
  }
  // LocalStorage para offline
  let p = JSON.parse(localStorage.getItem("rpg_progreso")) || {};
  p[cicloActual] = { nivel, rango, xp, completado };
  localStorage.setItem("rpg_progreso", JSON.stringify(p));
}

// --- 4. Estado interno de la partida (RAM) ---
let juegoActual = null;

async function inicializarPanelInicio() {
  // NO vuelvas a llamar a mostrarStatsBienvenida aquí (ya se llama al inicio)
  document.getElementById("titulo-ciclo").textContent = datosCiclo.titulo || "Trivia Bíblica RPG";
  document.getElementById("descripcion-ciclo").textContent = datosCiclo.descripcion || "";
  document.getElementById("mensaje-rpg").textContent =
    "Recuerda: solo tienes 3 vidas para demostrar tu valía. ¿Listo para el reto?";
}

async function inicializarRPG() {
  progresoRPG = await cargarProgresoRPG();
  // Si ya completó el ciclo, muestra solo el resumen
  if (progresoRPG && progresoRPG.completado) {
    document.getElementById("btn-comenzar").style.display = "none";
    document.getElementById("btn-continuar").style.display = "none";
    document.getElementById("juego-rpg").classList.add("oculto");
    document.getElementById("resultados-rpg").classList.add("oculto");
    document.getElementById("logros-rpg").classList.add("oculto");
    document.getElementById("menu-rpg").insertAdjacentHTML("beforeend",
      `<div class="panel-mensaje" style="margin-top:1em;">
        <strong>¡Ya completaste la Trivia de esta semana!</strong>
        <br>Vuelve la próxima semana para un nuevo reto.
      </div>`);
    return;
  }
  // Si no ha jugado, permite iniciar
  document.getElementById("btn-comenzar").style.display = juegoActual ? "none" : "inline-block";
  document.getElementById("btn-continuar").style.display = juegoActual ? "inline-block" : "none";
  document.getElementById("juego-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.add("oculto");
  document.getElementById("logros-rpg").classList.add("oculto");
}

// --- 5. Eventos de los botones ---
document.getElementById("btn-comenzar").onclick = () => {
  juegoActual = {
    nivel: 1,
    vidas: 3,
    pregunta: 0,
    preguntasNivel: null,
    xp: 0
  };
  mostrarNivel();
};
document.getElementById("btn-continuar").onclick = () => {
  mostrarNivel();
};
document.getElementById("btn-logros").onclick = () => {
  mostrarLogros();
};

// --- 6. Juego: mostrar nivel y preguntas ---
function mostrarNivel() {
  const juego = document.getElementById("juego-rpg");
  juego.classList.remove("oculto");
  document.getElementById("menu-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.add("oculto");
  document.getElementById("logros-rpg").classList.add("oculto");

  const nivel = juegoActual.nivel;
  const nivelKey = nivel.toString();
  const numPreguntas = preguntasPorNivel[nivel - 1] || 3;

  if (!datosCiclo.niveles || !Array.isArray(datosCiclo.niveles[nivelKey])) {
    juego.innerHTML = `<div class="panel-mensaje">
      <h2>¡No hay preguntas para el nivel ${nivel}!</h2>
      <p>Verifica tu archivo <b>rpg-preguntas.json</b></p>
      <button onclick="window.location.reload()">Volver</button>
    </div>`;
    return;
  }

  function shuffleOpciones(p) {
    let arr = [...p.opciones];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  if (!juegoActual.preguntasNivel || juegoActual.preguntasNivel.length !== numPreguntas) {
    juegoActual.preguntasNivel = mezclarArray([...datosCiclo.niveles[nivelKey]]).slice(0, numPreguntas).map(p => ({
      ...p,
      opciones: shuffleOpciones(p)
    }));
    juegoActual.pregunta = 0;
  }

  mostrarPregunta();

  function mostrarPregunta() {
    const preguntaActual = juegoActual.pregunta || 0;
    const p = juegoActual.preguntasNivel[preguntaActual];

    if (!p) {
      if (juegoActual.nivel >= preguntasPorNivel.length) {
        terminarAventura(true);
      } else {
        juegoActual.nivel++;
        juegoActual.pregunta = 0;
        juegoActual.preguntasNivel = null;
        mostrarMensajeNivelPersonalizado(
          juegoActual.nivel,
          juegoActual.vidas,
          mostrarNivel
        );
      }
      return;
    }

    juego.innerHTML = `
      <div class="panel-pregunta">
        <div class="rpg-info">
          <span class="rpg-nivel">Nivel: ${juegoActual.nivel}</span>
          <span class="rpg-vidas">${"❤️".repeat(juegoActual.vidas)}</span>
        </div>
        <div class="rpg-pregunta"><b>${p.pregunta}</b></div>
        <div class="rpg-opciones">
          ${p.opciones.map((op, i) => `<button class="rpg-btn-op" data-i="${i}">${op}</button>`).join("")}
        </div>
        <small>Si fallas, pierdes una vida. ¡Suerte!</small>
      </div>
    `;

    document.querySelectorAll('.rpg-btn-op').forEach(btn => {
      btn.onclick = () => {
        const correcta = p.opciones[btn.dataset.i] === p.respuesta;
        if (correcta) {
          btn.classList.add("acierto");
          juegoActual.xp += juegoActual.nivel * 10;
        } else {
          btn.classList.add("fallo");
          juegoActual.vidas--;
          const vidasEl = document.querySelector('.rpg-vidas');
          if (vidasEl) {
            vidasEl.classList.add("shake");
            setTimeout(() => vidasEl.classList.remove("shake"), 400);
          }
        }
        setTimeout(() => {
          juegoActual.pregunta = preguntaActual + 1;
          if (juegoActual.vidas <= 0) {
            terminarAventura();
          } else if (juegoActual.pregunta >= numPreguntas) {
            juegoActual.nivel++;
            juegoActual.pregunta = 0;
            juegoActual.preguntasNivel = null;
            if (juegoActual.nivel > preguntasPorNivel.length) {
              terminarAventura(true);
            } else {
              mostrarMensajeNivelPersonalizado(
                juegoActual.nivel,
                juegoActual.vidas,
                mostrarNivel
              );
            }
          } else {
            mostrarPregunta();
          }
        }, 700);
      };
    });
  }
}

// --- 7. Finalización ---
async function terminarAventura(ganoTodo = false) {
  document.getElementById("juego-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.remove("oculto");
  const rango = obtenerRango(juegoActual.nivel, ganoTodo);
  await guardarProgresoRPG({
    nivel: juegoActual.nivel,
    rango,
    xp: juegoActual.xp,
    completado: true,
  });

  document.getElementById("resultados-rpg").innerHTML = `
    <h2>${ganoTodo ? "¡Felicidades, completaste la Trivia!" : "Fin de la aventura"}</h2>
    <p>Tu rango: <b>${rango}</b></p>
    <p>XP ganada: ${juegoActual.xp}</p>
    <div class="msg-epico">⚡️ Has completado el reto semanal. Vuelve la próxima semana para una nueva aventura.</div>
    <button onclick="window.location.reload()">Volver al inicio</button>
  `;
  document.getElementById("btn-comenzar").style.display = "none";
  document.getElementById("btn-continuar").style.display = "none";
}

// --- 8. Otros ---
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

// -- Mensaje personalizado al pasar nivel (felicitación y tip) --
const tipsPorNivel = [
  "Recuerda leer con atención las opciones antes de responder.",
  "Algunas preguntas tienen pistas en los detalles de la pregunta.",
  "Si tienes dudas, descarta primero las opciones más improbables.",
  "¡Vas muy bien! Mantén la calma y sigue adelante.",
  "¡Estás a un paso del rango más alto! Confía en tu intuición."
];
function mostrarMensajeNivelPersonalizado(nivel, vidas, callback) {
  const mensajes = [
    "¡Buen comienzo!",
    "¡Vas avanzando muy bien!",
    "¡Increíble progreso!",
    "¡Estás entre los mejores!",
    "¡Nivel máximo alcanzado, eres un crack!"
  ];
  const msg = mensajes[nivel-1] || "¡Sigue así!";
  const tip = tipsPorNivel[nivel-1] || "";

  document.getElementById("juego-rpg").innerHTML = `
    <div class="panel-mensaje-nivel">
      <h2>🎉 ¡Felicidades!</h2>
      <p>${msg}</p>
      <p>Has alcanzado el <b>nivel ${nivel}</b>.<br>
      Te quedan <b>${vidas}</b> ${vidas === 1 ? "vida" : "vidas"}.</p>
      <div class="tip-box">
        <strong>Tip para este nivel:</strong><br>${tip}
      </div>
      <button id="btn-seguir-nivel">Continuar</button>
    </div>
  `;
  document.getElementById("btn-seguir-nivel").onclick = callback;
}
