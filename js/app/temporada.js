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
let tiempoRestante = 35;
let timer = null;
let quizFinalizado = false;

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
    document.getElementById("fecha-temporada").textContent = `${formatoFecha(datosTemporada.fecha_inicio)} – ${formatoFecha(datosTemporada.fecha_fin)}`;
    mostrarSolo(inicio); // Solo muestra la sección de inicio
  });

// --- 2. Comenzar quiz ---
btnComenzar.addEventListener("click", () => {
  if (!datosTemporada || !preguntas.length) {
    alert("No hay preguntas para esta temporada.");
    return;
  }
  indicePregunta = 0;
  puntaje = 0;
  quizFinalizado = false;
  mostrarSolo(juego);
  mostrarPregunta();
});

// --- 3. Mostrar pregunta actual ---
function mostrarPregunta() {
  if (quizFinalizado) return; // Evita avances de más

  // Si terminó el quiz
  if (indicePregunta >= preguntas.length) {
    quizFinalizado = true;
    finalizarJuego();
    return;
  }

  if (timer) clearInterval(timer);
  tiempoRestante = 35;
  actualizarBarraTiempo();

  // Inicia el temporizador
  timer = setInterval(() => {
    tiempoRestante--;
    actualizarBarraTiempo();
    if (tiempoRestante <= 0) {
      clearInterval(timer);
      if (!quizFinalizado) {
        indicePregunta++;
        mostrarPregunta();
      }
    }
  }, 1000);

  // Renderiza la pregunta y opciones
  const p = preguntas[indicePregunta];
  preguntaDiv.textContent = p.pregunta;
  opcionesDiv.innerHTML = "";

  let opciones = [p.respuesta, p.opcion_1, p.opcion_2, p.opcion_3].sort(() => Math.random() - 0.5);

  const opcionesCont = document.createElement("div");
  opcionesCont.className = "trivia-opciones";

  opciones.forEach(op => {
    const btn = document.createElement("button");
    btn.className = "trivia-opcion-btn";
    btn.textContent = op;
    btn.onclick = () => {
      if (quizFinalizado) return;
      clearInterval(timer);
      // Deshabilita todas las opciones apenas responde
      opcionesCont.querySelectorAll("button").forEach(b => b.disabled = true);

      if (op === p.respuesta) puntaje++;
      indicePregunta++;
      // Pequeño delay opcional para fluidez visual
      setTimeout(() => mostrarPregunta(), 280);
    };
    opcionesCont.appendChild(btn);
  });

  opcionesDiv.appendChild(opcionesCont);

  // Animación de aparición
  preguntaDiv.classList.remove("fade-in");
  void preguntaDiv.offsetWidth;
  preguntaDiv.classList.add("fade-in");

  opcionesCont.classList.remove("fade-in");
  void opcionesCont.offsetWidth;
  opcionesCont.classList.add("fade-in");

  conteoPregunta.textContent = `Pregunta ${indicePregunta + 1} de ${preguntas.length}`;
}

// --- 4. Barra y contador de tiempo ---
function actualizarBarraTiempo() {
  contador.textContent = `Tiempo: ${tiempoRestante}s`;
  progresoBar.style.width = `${(tiempoRestante / 35) * 100}%`;
  if (tiempoRestante > 19) progresoBar.style.background = '#2a9d8f';
  else if (tiempoRestante > 10) progresoBar.style.background = '#e9c46a';
  else progresoBar.style.background = '#e76f51';
}

// --- 5. Finalizar juego ---
function finalizarJuego() {
  mostrarSolo(final);
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
   // --- AGREGA ESTO ---
    setTimeout(() => {
      confetti({
        particleCount: 180,
        spread: 85,
        origin: { y: 0.7 },
        zIndex: 2000
      });
    }, 400); // Sale tras mostrar el coleccionable
    // --- FIN BLOQUE CONFETI ---
  
  
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

    let botonCompartir = `
    <button id="btn-compartir-temporada" class="btn-principal" style="margin-top:0.8rem;">
      Compartir mi resultado
    </button>
  `;

  imagenColeccionable.innerHTML = `
    <img src="${imgSrc}" alt="Coleccionable desbloqueado" style="max-width:100%; border-radius:1rem;">
    ${mensajeExtra}
    ${botonDescarga}
    ${botonCompartir}
  `;
  setTimeout(() => {
    const btnCompartir = document.getElementById('btn-compartir-temporada');
    if (btnCompartir) {
      btnCompartir.onclick = function() {
        compartirResultadoTemporada(nota, puntaje, datosTemporada.titulo);
      };
    }
  }, 20);


  guardarProgresoEnNubeTemporada();
}

// --- 6. Guardar progreso en Supabase ---
async function guardarProgresoEnNubeTemporada() {
  if (typeof supabase === "undefined") return;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return;

  const tipo = "temporada";
  const clave = idTemporada;
  const porcentaje = Math.round((puntaje / datosTemporada.puntaje_maximo) * 100);
  let nota = "F";
  if (puntaje >= datosTemporada.umbral_coleccionable) nota = "A";
  else if (puntaje >= datosTemporada.umbral_coleccionable - 2) nota = "B";
  else nota = "C";

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
    console.error("❌ Error al guardar progreso de temporada:", error.message);
  } else {
    console.log("✅ Progreso de temporada guardado en Supabase.");
  }
}

// --- 7. Utilidad para formato fecha bonita ---
function formatoFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleDateString("es-ES", {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// --- 8. Función para mostrar solo una sección ---
function mostrarSolo(elementoMostrado) {
  // Oculta todas las secciones
  [inicio, juego, final].forEach(el => el.classList.add("oculto"));
  // Muestra solo la sección correspondiente
  elementoMostrado.classList.remove("oculto");
}
function compartirResultadoTemporada(nota, puntaje, tituloTemporada) {
  const mensaje = `¡Acabo de completar la temporada "${tituloTemporada}" en Camino Bíblico!\n\n`
    + `Puntaje: ${puntaje}\nNota: ${nota}\n`
    + `¿Te atreves a superarme?\n${window.location.href}`;
  if (navigator.share) {
    navigator.share({
      title: `Temporada "${tituloTemporada}" – Camino Bíblico`,
      text: mensaje,
      url: window.location.href
    });
  } else {
    navigator.clipboard.writeText(mensaje);
    alert("¡Resultado copiado! Pega en WhatsApp, Telegram o donde quieras.");
  }
}
