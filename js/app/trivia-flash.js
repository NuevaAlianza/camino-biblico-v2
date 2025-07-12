let usuarioActual = null;
let preguntasQuiz = []; // Aquí deberías cargar tus preguntas quiz

// -- Día permitido (miércoles=3, sábado=6) --
const diasPermitidos = [3, 6];

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Obtener sesión y usuario
  const { data: sessionData } = await supabase.auth.getSession();
  usuarioActual = sessionData?.session?.user;
  if (!usuarioActual) {
    document.getElementById("trivia-flash-estado").innerHTML = "<b>Inicia sesión para jugar Trivia Flash.</b>";
    return;
  }
  
  const hoy = new Date();
  const diaSemana = hoy.getDay();
  if (!diasPermitidos.includes(diaSemana)) {
    document.getElementById("trivia-flash-estado").innerHTML = `<b>Trivia Flash disponible solo miércoles y sábado.<br>Hoy es ${["domingo","lunes","martes","miércoles","jueves","viernes","sábado"][diaSemana]}.</b>`;
    return;
  }

  // 2. Verificar si ya jugó hoy
  const hoyStr = hoy.toISOString().slice(0,10);
  const { data: jugoHoy, error } = await supabase
    .from("trivia_flash")
    .select("id")
    .eq("usuario_id", usuarioActual.id)
    .eq("fecha", hoyStr)
    .maybeSingle();

  if (jugoHoy) {
    document.getElementById("trivia-flash-estado").innerHTML = "<b>¡Ya jugaste Trivia Flash hoy!<br>Vuelve el próximo día habilitado.</b>";
    mostrarHistorial();
    return;
  }

  // 3. Cargar preguntas quiz (AJUSTA según tu estructura real)
 let preguntasQuiz = [];

async function cargarPreguntasQuiz() {
  if (!preguntasQuiz.length) {
    try {
      // Ajusta la ruta según dónde esté tu HTML respecto a /datos/
      const response = await fetch('datos/quiz.json');
      if (!response.ok) throw new Error('No se pudo cargar quiz.json');
      preguntasQuiz = await response.json();
    } catch (error) {
      console.error('Error al cargar quiz.json:', error);
      preguntasQuiz = []; // O algún valor por defecto
    }
  }
}


  // 4. Seleccionar 5 preguntas aleatorias
  let preguntasSeleccionadas = [];
  while (preguntasSeleccionadas.length < 5) {
    const idx = Math.floor(Math.random() * preguntasQuiz.length);
    if (!preguntasSeleccionadas.includes(preguntasQuiz[idx])) {
      preguntasSeleccionadas.push(preguntasQuiz[idx]);
    }
  }

  // 5. Iniciar juego
  iniciarTriviaFlash(preguntasSeleccionadas);
});

function iniciarTriviaFlash(preguntas) {
  let actual = 0;
  let aciertos = 0;
  let respuestas = [];

  mostrarPregunta();

  function mostrarPregunta() {
    if (actual >= preguntas.length) return finalizarTrivia();
    const q = preguntas[actual];
    // Ajusta las opciones si tu estructura es distinta
    const opciones = [q.respuesta, q.opcion_1, q.opcion_2, q.opcion_3].sort(()=>Math.random()-0.5);
    document.getElementById("trivia-flash-juego").innerHTML = `
      <div class="trivia-pregunta">
        <div class="pregunta">${actual+1}. ${q.pregunta}</div>
        <div class="trivia-opciones">
          ${opciones.map(op=>`
            <button class="trivia-opcion-btn" data-correcta="${op === q.respuesta}">
              ${op}
            </button>
          `).join("")}
        </div>
      </div>
    `;
    document.querySelectorAll(".trivia-opcion-btn").forEach(btn => {
      btn.onclick = e => {
        const correcta = btn.dataset.correcta === "true";
        respuestas.push({ pregunta: q.pregunta, correcta, opcion: btn.textContent });
        if (correcta) aciertos++;
        actual++;
        mostrarPregunta();
      }
    });
  }

  async function finalizarTrivia() {
    document.getElementById("trivia-flash-juego").innerHTML = "";
    let xp = 0;
    if (aciertos === 5) xp = 50;
    else if (aciertos === 4) xp = 20;
    else if (aciertos === 3) xp = 5;

    document.getElementById("trivia-flash-resultado").innerHTML = `
      <div class="trivia-flash-resultado-msg">
        ¡Completaste Trivia Flash!<br>
        <b>${aciertos}</b> de <b>5</b> correctas.
      </div>
      <div class="trivia-flash-xp-ganado">
        ${xp > 0 ? `+${xp} XP 🟡` : `Sin XP esta vez 😅`}
      </div>
    `;

    // Guarda intento en trivia_flash
    await supabase.from("trivia_flash").insert([{
      usuario_id: usuarioActual.id,
      fecha: new Date().toISOString().slice(0,10),
      aciertos,
      xp_obtenido: xp,
      preguntas: respuestas
    }]);

    // Suma XP a rpg_progreso
    // Aquí debes obtener el registro de la semana y sumarle el XP (ajusta según tu lógica de ciclos)
    // Este ejemplo asume un ciclo semanal basado en fecha (ajusta si usas otro sistema):
    const ciclo = obtenerCicloActual();
    const { data: row } = await supabase
      .from("rpg_progreso")
      .select("*")
      .eq("user_id", usuarioActual.id)
      .eq("ciclo", ciclo)
      .maybeSingle();

    if (row) {
      await supabase
        .from("rpg_progreso")
        .update({ xp: (row.xp || 0) + xp })
        .eq("id", row.id);
    } else {
      await supabase
        .from("rpg_progreso")
        .insert([{
          user_id: usuarioActual.id,
          ciclo,
          xp,
          completado: true,
          fecha_juego: new Date()
        }]);
    }

    mostrarHistorial();
  }
}

// Define el ciclo actual (puedes ajustar la lógica según tus ciclos reales)
function obtenerCicloActual() {
  const hoy = new Date();
  const year = hoy.getFullYear();
  // Semana ISO (lunes a domingo)
  const week = Math.floor(((hoy - new Date(year,0,1)) / 86400000 + new Date(year,0,1).getDay()+1)/7);
  return `${year}-S${week}`;
}

// Historial de intentos recientes
async function mostrarHistorial() {
  const { data: intentos } = await supabase
    .from("trivia_flash")
    .select("*")
    .eq("usuario_id", usuarioActual.id)
    .order("fecha", { ascending: false })
    .limit(6);

  document.getElementById("trivia-flash-historial").innerHTML = `
    <h3>Historial Trivia Flash</h3>
    <ul>
      ${intentos.map(i=>`
        <li>${i.fecha}: ${i.aciertos} correctas, ${i.xp_obtenido} XP</li>
      `).join("")}
    </ul>
  `;
}
