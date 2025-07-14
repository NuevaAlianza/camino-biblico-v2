


// --- Referencias DOM ---
const btnComenzar = document.getElementById("btn-comenzar");
const inicio = document.getElementById("inicio");
const juego = document.getElementById("juego");
const final = document.getElementById("final");
const preguntaDiv = document.getElementById("pregunta");
const opcionesDiv = document.getElementById("opciones");
const conteoPregunta = document.getElementById("conteo-pregunta");
const puntajeFinal = document.getElementById("puntaje-final");
const imagenColeccionable = document.getElementById("imagen-coleccionable");
const barraTiempo = document.getElementById("barra-tiempo");
const progresoBar = document.getElementById("progreso");
const contador = document.getElementById("contador");

// --- Variables globales ---
let datosTemporada = null;
let idTemporada = null;
let preguntas = [];
let indicePregunta = 0;
let puntaje = 0;
let tiempoRestante = 58;
let timer = null;

// --- 1. Cargar temporadas y buscar activa ---
fetch('./datos/temporadas.json')
  .then(res => res.json())
  .then(temporadas => {
    const hoy = new Date();
    datosTemporada = temporadas.find(t => {
      const ini = new Date(t.fecha_inicio);
      const fin = new Date(t.fecha_fin);
      return hoy >= ini && hoy <= fin;
    });
    if (!datosTemporada) {
      btnComenzar.disabled = true;
      document.getElementById("descripcion-temporada").textContent = "No hay temporada activa en este momento.";
      return;
    }
    idTemporada = datosTemporada.id;
    preguntas = datosTemporada.preguntas;
    document.getElementById("titulo-temporada").textContent = datosTemporada.titulo;
    document.getElementById("descripcion-temporada").textContent = datosTemporada.descripcion;
  });

// --- 2. Comenzar quiz ---
btnComenzar.addEventListener("click", () => {
  if (!datosTemporada || !preguntas.length) {
    alert("No hay preguntas para esta temporada.");
    return;
  }
  inicio.classList.add("oculto");
  juego.classList.remove("oculto");
  final.classList.add("oculto");
  indicePregunta = 0;
  puntaje = 0;
  mostrarPregunta();
});

// --- 3. Mostrar pregunta actual ---
function mostrarPregunta() {
  if (timer) clearInterval(timer);
  tiempoRestante = 58;
  actualizarBarraTiempo();
  timer = setInterval(() => {
    tiempoRestante--;
    actualizarBarraTiempo();
    if (tiempoRestante <= 0) {
      clearInterval(timer);
      indicePregunta++;
      mostrarPregunta();
    }
  }, 1000);

  if (indicePregunta >= preguntas.length) {
    clearInterval(timer);
    finalizarJuego();
    return;
  }
  const p = preguntas[indicePregunta];
  preguntaDiv.textContent = p.pregunta;
  opcionesDiv.innerHTML = "";
  let opciones = [p.respuesta, p.opcion_1, p.opcion_2, p.opcion_3]
    .sort(() => Math.random() - 0.5); // Aleatorizar

  opciones.forEach(op => {
    const btn = document.createElement("button");
    btn.textContent = op;
    btn.onclick = () => {
      clearInterval(timer);
      if (op === p.respuesta) puntaje++;
      indicePregunta++;
      mostrarPregunta();
    };
    opcionesDiv.appendChild(btn);
  });
  conteoPregunta.textContent = `Pregunta ${indicePregunta + 1} de ${preguntas.length}`;
}

// --- 4. Barra y contador de tiempo ---
function actualizarBarraTiempo() {
  contador.textContent = `Tiempo: ${tiempoRestante}s`;
  progresoBar.style.width = `${(tiempoRestante / 58) * 100}%`;
  if (tiempoRestante > 30) progresoBar.style.background = '#2a9d8f';
  else if (tiempoRestante > 10) progresoBar.style.background = '#e9c46a';
  else progresoBar.style.background = '#e76f51';
}

// --- 5. Finalizar juego (usa tu código ya existente) ---
// Pega aquí tu función finalizarJuego y guardarProgresoEnNubeTemporada, **tal cual la tienes**.


// ...todo tu código previo sin cambios...

function finalizarJuego() {
  juego.classList.add("oculto");
  final.classList.remove("oculto");

  const max = datosTemporada.puntaje_maximo;
  const umbral = datosTemporada.umbral_coleccionable;
  const nota = puntaje >= umbral ? "A" : puntaje >= umbral - 2 ? "B" : "C";
  let imgSrc;
  let mensajeExtra = "";
  let botonDescarga = "";

  if (nota === "A") {
    imgSrc = datosTemporada.coleccionable.imagen_a;
    mensajeExtra = `<p style="color:#2a9d8f; font-weight:600; margin-top:1rem;">🏆 ¡Excelente! Has desbloqueado el coleccionable especial.</p>`;
    botonDescarga = `<a href="${imgSrc}" download style="display:inline-block; margin-top:1rem; background:#e9c46a; padding:0.5rem 1rem; border-radius:0.5rem; color:#333; text-decoration:none; font-weight:bold; font-size:0.9rem;">📥 Descargar</a>`;
  } else if (nota === "B") {
    imgSrc = datosTemporada.coleccionable.imagen_b;
  } else {
    imgSrc = datosTemporada.coleccionable.imagen_c;
  }

  imagenColeccionable.innerHTML = `
    <img src="${imgSrc}" alt="Coleccionable desbloqueado" style="max-width:100%; border-radius:1rem;">
    ${mensajeExtra}
    ${botonDescarga}
  `;

  puntajeFinal.textContent = `Puntaje: ${puntaje} de ${max}`;

  guardarProgreso();           // Guardado local
  guardarProgresoEnNubeTemporada(); // <-- NUEVO, guardado en la nube
}

// --------- NUEVA FUNCIÓN: guardar en Supabase solo este avance de temporada -----------
async function guardarProgresoEnNubeTemporada() {
  // Asegúrate de que supabase esté disponible (por si acaso)
  if (typeof supabase === "undefined") return;

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return;

  // Datos principales para la tabla "progreso"
  const tipo = "temporada";
  const clave = idTemporada;
  const porcentaje = Math.round((puntaje / datosTemporada.puntaje_maximo) * 100);
  let nota = "F";
  if (puntaje >= datosTemporada.umbral_coleccionable) nota = "A";
  else if (puntaje >= datosTemporada.umbral_coleccionable - 2) nota = "B";
  else nota = "C";

  // Guarda o actualiza el progreso de la temporada para este usuario
  const { error } = await supabase
    .from("progreso")
    .upsert([{
      user_id: userId,
      tipo,
      clave,
      nota,
      porcentaje,
      fecha: new Date().toISOString()
    }]);
  if (error) {
    console.error("❌ Error al guardar progreso de temporada:", error.message);
  } else {
    console.log("✅ Progreso de temporada guardado en Supabase.");
  }
}
