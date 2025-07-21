let usuarioActual = null; 
let preguntasQuiz = []; // Global

const diasPermitidos = [1, 3, 6]; // lunes, miércoles y sábado
const EMOJIS_FLASH = [
  { emoji: "💤", hasta: 17 }, // 20–17s
  { emoji: "🙂", hasta: 13 }, // 16–13s
  { emoji: "😳", hasta: 9 },  // 12–9s
  { emoji: "😬", hasta: 5 },  // 8–5s
  { emoji: "🚨", hasta: 0 }   // 4–0s
];
let temporizadorActivo = null;

// ---------- SONIDOS ----------
function reproducirSonido(nombre) {
  try {
    const audio = new Audio("assets/sonidos/" + nombre);
    audio.play();
  } catch (e) {}
}

// ---------- TEMPORIZADOR + EMOJI ----------
function crearTemporizadorPregunta(duracion, onTimeout, onTick, onEmojiChange) {
  let tiempoRestante = duracion;
  let intervalo;
  let emojiActual = "";

  function actualizarTemporizador() {
    // Círculo SVG
    const circulo = document.getElementById("timer-circular");
    const radio = 40, circunferencia = 2 * Math.PI * radio;
    const progreso = tiempoRestante / duracion;
    if (circulo) {
      circulo.style.strokeDasharray = `${circunferencia}`;
      circulo.style.strokeDashoffset = `${circunferencia * (1 - progreso)}`;
    }

    // Emoji
    const emojiObj = EMOJIS_FLASH.find(e => tiempoRestante > e.hasta) || EMOJIS_FLASH[EMOJIS_FLASH.length - 1];
    if (emojiObj && emojiActual !== emojiObj.emoji) {
      emojiActual = emojiObj.emoji;
      const emojiDiv = document.getElementById("emoji-animado");
      if (emojiDiv) {
        emojiDiv.textContent = emojiActual;
        emojiDiv.className = "emoji-animado" + (emojiActual === "🚨" ? " shake" : "");
        if (onEmojiChange) onEmojiChange(emojiActual);
      }
    }
    // Tiempo texto
    const texto = document.getElementById("timer-text");
    if (texto) texto.textContent = tiempoRestante + "s";
    if (onTick) onTick(tiempoRestante);
  }

  actualizarTemporizador();

  intervalo = setInterval(() => {
    tiempoRestante--;
    actualizarTemporizador();
    if (tiempoRestante <= 0) {
      clearInterval(intervalo);
      if (onTimeout) onTimeout();
    }
  }, 1000);

  temporizadorActivo = {
    detener: () => clearInterval(intervalo),
    getTiempo: () => tiempoRestante
  };
  return temporizadorActivo;
}
function limpiarTemporizadorPregunta() {
  if (temporizadorActivo && temporizadorActivo.detener) temporizadorActivo.detener();
  temporizadorActivo = null;
}

// ---------- MAIN ----------
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Obtener sesión y usuario
  const { data: sessionData } = await supabase.auth.getSession();
  usuarioActual = sessionData?.session?.user;
  if (!usuarioActual) {
    document.getElementById("trivia-flash-estado").innerHTML = "<b>Inicia sesión para jugar Trivia Flash.</b>";
    return;
  }
  
  // 2. Día de la semana
  const hoy = new Date();
  const diaSemana = hoy.getDay();
  let diaNombre = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"][diaSemana];
  let mensajeDia = "";
  if (diaSemana === 3) mensajeDia = "<span class='flash-dia-activo'>¡Flash Wednesday!</span>";
  else if (diaSemana === 6) mensajeDia = "<span class='flash-dia-activo'>Reto Sábado Flash</span>";
  else if (diaSemana === 1) mensajeDia = "<span class='flash-dia-lunes'>Trivia Flash – lunes</span>";
  else mensajeDia = `<span class='flash-dia-inactivo'>Trivia Flash: Hoy es ${diaNombre}.</span>`;

  document.getElementById("trivia-flash-estado").innerHTML = mensajeDia;

  if (!diasPermitidos.includes(diaSemana)) {
    document.getElementById("trivia-flash-estado").innerHTML +=
      `<b>Trivia Flash disponible solo lunes, miércoles y sábado.<br>
       Hoy es ${diaNombre}.</b>`;
    return;
  }

  // 3. Verificar si ya jugó hoy
  const hoyStr = hoy.toISOString().slice(0,10);
  const { data: jugoHoy } = await supabase
    .from("trivia_flash")
    .select("id")
    .eq("user_id", usuarioActual.id)
    .eq("fecha", hoyStr)
    .maybeSingle();

  if (jugoHoy) {
    document.getElementById("trivia-flash-estado").innerHTML += "<b>¡Ya jugaste Trivia Flash hoy!<br>Vuelve el próximo día habilitado.</b>";
    mostrarHistorial();
    return;
  }

  // 4. Cargar preguntas quiz
  await cargarPreguntasQuiz();
  if (!preguntasQuiz.length) {
    document.getElementById("trivia-flash-estado").innerHTML += "<b>No hay preguntas disponibles. Contacta al administrador.</b>";
    return;
  }
  if (preguntasQuiz.length < 5) {
    document.getElementById("trivia-flash-estado").innerHTML += "<b>Se requieren al menos 5 preguntas para jugar. Agrega más preguntas al sistema.</b>";
    return;
  }

  // 5. Seleccionar 5 preguntas aleatorias únicas
  let preguntasSeleccionadas = [];
  const usados = new Set();
  while (preguntasSeleccionadas.length < 5 && usados.size < preguntasQuiz.length) {
    const idx = Math.floor(Math.random() * preguntasQuiz.length);
    if (!usados.has(idx)) {
      usados.add(idx);
      preguntasSeleccionadas.push(preguntasQuiz[idx]);
    }
  }

  // 6. Iniciar juego
  iniciarTriviaFlash(preguntasSeleccionadas, diaSemana);
});

async function cargarPreguntasQuiz() {
  if (!preguntasQuiz.length) {
    try {
      const response = await fetch('datos/quiz.json');
      if (!response.ok) throw new Error('No se pudo cargar quiz.json');
      preguntasQuiz = await response.json();
    } catch (error) {
      console.error('Error al cargar quiz.json:', error);
      preguntasQuiz = [];
    }
  }
}

function iniciarTriviaFlash(preguntas, diaSemana) {
  let actual = 0;
  let aciertos = 0;
  let respuestas = [];

  mostrarPregunta();

  function mostrarPregunta() {
    if (actual >= preguntas.length) return finalizarTrivia();
    const q = preguntas[actual];
    const opciones = [q.respuesta, q.opcion_1, q.opcion_2, q.opcion_3].sort(()=>Math.random()-0.5);

    document.getElementById("trivia-flash-juego").innerHTML = `
      <div class="temporizador-panel">
        <svg width="90" height="90" class="temporizador-svg">
          <circle cx="45" cy="45" r="40" stroke="#39d2c0" stroke-width="7" fill="none" id="timer-circular"/>
        </svg>
        <span id="emoji-animado" class="emoji-animado">💤</span>
        <div id="timer-text" class="timer-text">20s</div>
      </div>
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

    limpiarTemporizadorPregunta();
    reproducirSonido("start.mp3");

    crearTemporizadorPregunta(
      25,
      () => { // onTimeout
        // Tiempo agotado: cuenta como fallo y pasa a la siguiente
        respuestas.push({ pregunta: q.pregunta, correcta: false, opcion: "(Sin respuesta)" });
        actual++;
        mostrarPregunta();
      },
      (tiempoRestante) => {
        if (tiempoRestante === 15) reproducirSonido("halfway.mp3");
        if (tiempoRestante === 6) reproducirSonido("warning.mp3");
      },
      (emoji) => {
        // Extra animación si quieres aquí
      }
    );

    document.querySelectorAll(".trivia-opcion-btn").forEach(btn => {
      btn.onclick = e => {
        limpiarTemporizadorPregunta();
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
    if (aciertos === 5) xp = 10;
    else if (aciertos === 4) xp = 5;
    else if (aciertos === 3) xp = 2;

    // --- Sonido final y feedback visual ---
    let emojiFinal = "😅", msgFinal = "¡Sigue practicando!", sonidoFinal = "resultado_bajo.mp3";
    if (aciertos >= 3 && aciertos <= 4) { emojiFinal = "😃"; msgFinal = "¡Muy bien, casi lo logras!"; sonidoFinal = "resultado_medio.mp3"; }
    if (aciertos === 5) { emojiFinal = "🥇"; msgFinal = "¡Excelente, eres Flash Pro!"; sonidoFinal = "resultado_alto.mp3"; }
    reproducirSonido(sonidoFinal);

    document.getElementById("trivia-flash-resultado").innerHTML = `
      <div class="trivia-flash-resultado-msg">
        <span class="emoji-final">${emojiFinal}</span><br>
        <b>${aciertos}</b> de <b>5</b> correctas.<br>
        <span class="msg-final">${msgFinal}</span>
      </div>
      <div class="trivia-flash-xp-ganado">
        ${xp > 0 ? `+${xp} XP 🟡` : `Sin XP esta vez 😅`}
      </div>
    `;

    // Guarda intento en trivia_flash
    const { error } = await supabase.from("trivia_flash").insert([{
      user_id: usuarioActual.id,
      fecha: new Date().toISOString().slice(0,10),
      aciertos,
      xp_obtenido: xp,
      preguntas: respuestas
    }]);
    if (error) {
      document.getElementById("trivia-flash-resultado").innerHTML += `
        <div class="trivia-flash-resultado-msg error">❌ Hubo un error al guardar tu intento.<br>
        Por favor, contacta a soporte o revisa la consola.<br>
        <pre>${error.message}</pre>
        </div>`;
      return;
    }

  

    mostrarBotonCompartir(aciertos, diaSemana);
    mostrarHistorial();
  }
}

// Botón compartir flotante (puedes personalizar la posición/animación en CSS)
function mostrarBotonCompartir(aciertos, diaSemana) {
  let mensaje = `¡Jugué Trivia Flash y logré ${aciertos} de 5!\n¿Puedes superarme?`;
  let btn = document.getElementById("btn-flash-compartir");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "btn-flash-compartir";
    btn.className = "flash-compartir-btn";
    document.body.appendChild(btn);
  }
  btn.innerHTML = "Compartir resultado 📣";
  btn.style.display = "block";
  // Color y animación más llamativos miércoles y sábado
  btn.classList.toggle("flash-activo", diaSemana === 3 || diaSemana === 6);
  btn.classList.add("flash-bounce");

  btn.onclick = () => {
    if (navigator.share) {
      navigator.share({
        title: "Trivia Flash",
        text: mensaje,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(mensaje);
      alert("¡Resultado copiado! Puedes pegarlo donde quieras.");
    }
  };
  // Remueve animación después de aparecer
  setTimeout(()=>btn.classList.remove("flash-bounce"), 1600);
}

// Define el ciclo actual (puedes ajustar la lógica según tus ciclos reales)
function obtenerCicloActual() {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const week = Math.floor(((hoy - new Date(year,0,1)) / 86400000 + new Date(year,0,1).getDay()+1)/7);
  return `${year}-S${week}`;
}

// Historial de intentos recientes
async function mostrarHistorial() {
  const { data: intentos } = await supabase
    .from("trivia_flash")
    .select("*")
    .eq("user_id", usuarioActual.id)
    .order("fecha", { ascending: false })
    .limit(6);

  document.getElementById("trivia-flash-historial").innerHTML = `
    <h3>Historial Trivia Flash</h3>
    <ul>
      ${(intentos || []).map(i=>`
        <li>${i.fecha}: ${i.aciertos} correctas, ${i.xp_obtenido} XP</li>
      `).join("")}
    </ul>
  `;
}
