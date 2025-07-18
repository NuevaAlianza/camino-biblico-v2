// =======================
// quiz.js – Camino Bíblico
// =======================

// Variables globales
let datos = [];
let preguntas = [];
let preguntaActual = 0;
let puntaje = 0;
let tiempo = 58;
let intervalo;

// Elementos del DOM
const categoriaSelect    = document.getElementById("categoria");
const temaSelect         = document.getElementById("tema");
const iniciarBtn         = document.getElementById("iniciar");
const seleccionForm      = document.getElementById("seleccion-tema-form");

const juego              = document.getElementById("juego");
const preguntaEl         = document.getElementById("pregunta");
const opcionesEl         = document.getElementById("opciones");
const comentarioEl       = document.getElementById("comentario");
const resultadoEl        = document.getElementById("resultado");
const detalleResultado   = document.getElementById("detalle-resultado");
const mensajeResultado   = document.getElementById("mensaje-resultado");
const reiniciarBtn       = document.getElementById("reiniciar");
const volverBtn          = document.getElementById("volver");
const conteoPreguntaEl   = document.getElementById("conteo-pregunta");
const barraProgreso      = document.getElementById("progreso");
const contadorEl         = document.getElementById("contador");

// Sonidos
const sonidoInicio     = new Audio("assets/sonidos/inicio.mp3");
const sonidoAdvertencia= new Audio("assets/sonidos/warning.mp3");
const sonidoFin        = new Audio("assets/sonidos/end.mp3");
const sonidoClick      = new Audio("assets/sonidos/click.mp3");
const sonidoCorrecto   = new Audio("assets/sonidos/correcto.mp3");
const sonidoIncorrecto = new Audio("assets/sonidos/incorrecto.mp3");

function reproducirSonido(audio) {
  audio.currentTime = 0;
  audio.play();
}

// ===============================
// 1. Selección de categoría y tema
// ===============================

function actualizarBotonIniciar() {
  iniciarBtn.disabled = !(categoriaSelect.value && temaSelect.value);
}

// Carga el JSON de preguntas y popula categorías
fetch("datos/quiz.json")
  .then(res => res.json())
  .then(json => {
    datos = json.filter(item => item.tipo === "quiz comentado");
    const categorias = [...new Set(datos.map(item => item.categoria))];
    categorias.forEach(categoria => {
      const option = document.createElement("option");
      option.value = categoria;
      option.textContent = categoria;
      categoriaSelect.appendChild(option);
    });
  });

// Cambiar categoría → carga temas
categoriaSelect.addEventListener("change", () => {
  temaSelect.innerHTML = '<option value="">-- Elige un tema --</option>';
  const categoria = categoriaSelect.value;
  if (!categoria) {
    temaSelect.disabled = true;
    actualizarBotonIniciar();
    return;
  }
  const temas = [...new Set(datos
    .filter(item => item.categoria === categoria)
    .map(item => item.tema)
  )];
  temas.forEach(tema => {
    const option = document.createElement("option");
    option.value = tema;
    option.textContent = tema;
    temaSelect.appendChild(option);
  });
  temaSelect.disabled = false;
  actualizarBotonIniciar();
});

// Cambiar tema → habilita botón si ambos select tienen valor
temaSelect.addEventListener("change", actualizarBotonIniciar);

// Usar evento submit del form para iniciar quiz
seleccionForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (iniciarBtn.disabled) return;
  reproducirSonido(sonidoClick);
  const categoria = categoriaSelect.value;
  const tema      = temaSelect.value;
  if (!categoria || !tema) return;

  preguntas = datos
    .filter(item => item.categoria === categoria && item.tema === tema)
    .sort(() => 0.5 - Math.random())
    .slice(0, 15);

  preguntaActual = 0;
  puntaje        = 0;

  document.querySelector(".seleccion-tema-v2").classList.add("oculto");
  resultadoEl.classList.add("oculto");
  juego.classList.remove("oculto");
  mostrarPregunta();
});

// =========================
// 2. Lógica de juego / Quiz
// =========================

function mostrarPregunta() {
  resetearEstado();
  reproducirSonido(sonidoInicio);

  const actual = preguntas[preguntaActual];
  preguntaEl.textContent = actual.pregunta;

  const opciones = [
    actual.respuesta,
    actual.opcion_1,
    actual.opcion_2,
    actual.opcion_3
  ].sort(() => 0.5 - Math.random());

  opciones.forEach(op => {
    const btn = document.createElement("button");
    btn.textContent = op;
    btn.classList.add("opcion");
    btn.addEventListener("click", () => {
      reproducirSonido(sonidoClick);
      seleccionarOpcion(op, actual);
    });
    opcionesEl.appendChild(btn);
  });

  conteoPreguntaEl.textContent = `Pregunta ${preguntaActual + 1} de ${preguntas.length}`;
  // Si quieres mostrar el tiempo, desoculta esta línea:
  // contadorEl.textContent = `Tiempo: 58s`;
  iniciarTemporizador();
}

function seleccionarOpcion(opcion, actual) {
  detenerTemporizador();

  const botones = opcionesEl.querySelectorAll("button");
  botones.forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === actual.respuesta) {
      btn.classList.add("correcto");
    } else if (btn.textContent === opcion) {
      btn.classList.add("incorrecto");
    }
  });

  // Muestra el comentario dependiendo del resultado
  if (opcion === actual.respuesta) {
    puntaje++;
    reproducirSonido(sonidoCorrecto);
    comentarioEl.textContent = actual["cita biblica"];
  } else {
    reproducirSonido(sonidoIncorrecto);
    comentarioEl.textContent = "¡Fallaste! Inténtalo en la próxima pregunta.";
  }
  comentarioEl.classList.remove("oculto");

  // Oculta el comentario suavemente antes de la próxima pregunta
  setTimeout(() => {
    comentarioEl.classList.add("oculto");
  }, 5300);

  setTimeout(() => {
    preguntaActual++;
    // Si era la última, fuerza mostrarResultado:
    if (preguntaActual >= preguntas.length) {
      mostrarResultado();
    } else {
      mostrarPregunta();
    }
  }, 6000);
}

// ====================
// 3. Resultado final
// ====================

function mostrarResultado() {
  juego.classList.add("oculto");
  resultadoEl.classList.remove("oculto");
  detalleResultado.textContent = `Respondiste correctamente ${puntaje} de ${preguntas.length} preguntas.`;

  // Mensaje personalizado según puntaje
  let mensaje = "";
  const porcentaje = (puntaje / preguntas.length) * 100;
  if (porcentaje >= 90) mensaje = "¡Increíble! Eres un maestro del tema 🎉";
  else if (porcentaje >= 75) mensaje = "¡Muy bien! Sigue practicando 👏";
  else if (porcentaje >= 60) mensaje = "¡Bien hecho! Pero puedes mejorar 👍";
  else mensaje = "¡Ánimo! Practica un poco más y lo lograrás 💡";
  mensajeResultado.textContent = mensaje;

  // Guardar localmente
  guardarProgreso("quiz comentado", temaSelect.value, puntaje, preguntas.length);

  // Sincronizar con Supabase si hay sesión activa
  guardarProgresoEnNube();

  // Determinar nota y mostrar botón coleccionables
  let nota = "F";
  if (porcentaje >= 90) nota = "A";
  else if (porcentaje >= 75) nota = "B";
  else if (porcentaje >= 60) nota = "C";
  else if (porcentaje >= 40) nota = "D";

  const btnColeccionable = document.getElementById("ver-coleccionables");
  // Limpia listeners viejos
  const nuevoBtn = btnColeccionable.cloneNode(true);
  btnColeccionable.parentNode.replaceChild(nuevoBtn, btnColeccionable);

  if (["A", "B", "C"].includes(nota)) {
    nuevoBtn.classList.remove("oculto");
    nuevoBtn.addEventListener("click", () => {
      reproducirSonido(sonidoClick);
      if (navigator.vibrate) navigator.vibrate(100);
      window.location.href = "coleccionables-v2.html";
    });
  } else {
    nuevoBtn.classList.add("oculto");
  }
}

// ==================
// 4. Temporizador
// ==================
function resetearEstado() {
  opcionesEl.innerHTML = "";
  comentarioEl.classList.add("oculto");
  barraProgreso.style.width = "100%";
  // contadorEl.textContent = "Tiempo: 58s"; // solo si lo usas
}

function iniciarTemporizador() {
  tiempo = 58;
  barraProgreso.style.width = "100%";
  // contadorEl.textContent = `Tiempo: ${tiempo}s`; // solo si lo usas
  intervalo = setInterval(() => {
    tiempo--;
    const pct = (tiempo / 58) * 100;
    barraProgreso.style.width = `${pct}%`;

    // contadorEl.textContent = `Tiempo: ${tiempo}s`; // solo si lo usas

    if (tiempo === 20 || tiempo === 10) reproducirSonido(sonidoAdvertencia);

    if (tiempo <= 0) {
      clearInterval(intervalo);
      reproducirSonido(sonidoFin);
      seleccionarOpcion("tiempo agotado", preguntas[preguntaActual]);
    }
  }, 1000);
}

function detenerTemporizador() {
  clearInterval(intervalo);
}

// =======================
// 5. Botones reinicio/nav
// =======================
reiniciarBtn.addEventListener("click", () => {
  document.querySelector(".seleccion-tema-v2").classList.remove("oculto");
  resultadoEl.classList.add("oculto");
});

volverBtn.addEventListener("click", () => {
  window.location.href = "menu.html";
});

// ===============================
// 6. Guardado de progreso local
// ===============================
function guardarProgreso(tipo, tema, puntaje, total) {
  const fecha = new Date().toISOString();

  // Historial
  const historial = JSON.parse(localStorage.getItem("historial")) || [];
  historial.push({ tipo, tema, puntaje, total, fecha });
  localStorage.setItem("historial", JSON.stringify(historial));

  // Calcular nota
  const porcentaje = (puntaje / total) * 100;
  let nota = "F";
  if (porcentaje >= 90) nota = "A";
  else if (porcentaje >= 75) nota = "B";
  else if (porcentaje >= 60) nota = "C";
  else if (porcentaje >= 40) nota = "D";

  // Categoría real
  const ejemplo = datos.find(p => p.tema === tema);
  const categoriaReal = ejemplo?.categoria || "Sin categoría";

  // Construir objeto de progreso v2
  const progreso = JSON.parse(localStorage.getItem("progreso")) || { version: 2, categorias: {} };
  if (!progreso.categorias[categoriaReal]) progreso.categorias[categoriaReal] = {};
  progreso.categorias[categoriaReal][tema] = {
    porcentaje: Math.round(porcentaje),
    nota,
    estado: "completado"
  };
  localStorage.setItem("progreso", JSON.stringify(progreso));
}

// ===============================
// 7. Sincronización con Supabase
// ===============================
async function guardarProgresoEnNube() {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) {
    console.warn("No hay sesión activa.");
    return;
  }

  // Datos principales
  const tipo = "quiz comentado";
  const clave = temaSelect.value;
  const porcentaje = Math.round((puntaje / preguntas.length) * 100);
  let nota = "F";
  if (porcentaje >= 90) nota = "A";
  else if (porcentaje >= 75) nota = "B";
  else if (porcentaje >= 60) nota = "C";
  else if (porcentaje >= 40) nota = "D";

  // Guarda progreso (último intento, una fila por usuario-tipo-clave)
 const { error } = await supabase
  .from("progreso")
  .upsert([{
    user_id: userId,
    tipo,
    clave,
    nota,
    porcentaje,
    fecha: new Date().toISOString()
  }], {
    onConflict: ['user_id', 'tipo', 'clave']
  });

if (error) {
  console.error("❌ Error al guardar progreso en nube:", error.message);
} else {
  console.log("✅ Progreso guardado en Supabase.");
}


  // Guarda historial (todas las sesiones, cada intento)
  const { error: histError } = await supabase
    .from("historial")
    .insert([{
      user_id: userId,
      tipo,
      clave,
      puntaje,
      total: preguntas.length,
      fecha: new Date().toISOString()
    }]);
  if (histError) {
    console.error("❌ Error al guardar historial en nube:", histError.message);
  } else {
    console.log("✅ Historial guardado en Supabase.");
  }
}
// Habilita/deshabilita botón siempre que cambie categoría o tema
categoriaSelect.addEventListener("change", actualizarBotonIniciar);
temaSelect.addEventListener("change", actualizarBotonIniciar);

// Si la categoría cambia, forzar limpiar y desactivar el tema
categoriaSelect.addEventListener("change", () => {
  if (!categoriaSelect.value) {
    temaSelect.value = "";
    temaSelect.disabled = true;
  }
  actualizarBotonIniciar();
});

// Cada vez que se agreguen temas, asegúrate que se habilita bien:
categoriaSelect.addEventListener("change", () => {
  // ...ya tienes esto, pero asegúrate que:
  temaSelect.disabled = temaSelect.options.length <= 1;
});

