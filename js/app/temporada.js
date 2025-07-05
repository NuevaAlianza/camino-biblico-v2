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
