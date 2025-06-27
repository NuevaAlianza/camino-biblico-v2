// ... [todo tu código anterior intacto, hasta mostrarResultado()]

function mostrarResultado() {
  juego.classList.add("oculto");
  resultadoEl.classList.remove("oculto");
  detalleResultado.textContent = `Respondiste correctamente ${puntaje} de ${preguntas.length} preguntas.`;

  guardarProgreso("quiz comentado", temaSelect.value, puntaje, preguntas.length);

  // Sincronizar con Supabase si hay sesión activa
  guardarProgresoEnNube();

  // Obtener nota final para este intento
  const porcentaje = (puntaje / preguntas.length) * 100;
  let nota = "F";
  if (porcentaje >= 90) nota = "A";
  else if (porcentaje >= 75) nota = "B";
  else if (porcentaje >= 60) nota = "C";
  else if (porcentaje >= 40) nota = "D";

  const btnColeccionable = document.getElementById("ver-coleccionables");
  if (["A", "B", "C"].includes(nota)) {
    btnColeccionable.classList.remove("oculto");
    btnColeccionable.addEventListener("click", () => {
      reproducirSonido(sonidoClick);
      if (navigator.vibrate) navigator.vibrate(100);
      window.location.href = "coleccionables-v2.html";
    });
  } else {
    btnColeccionable.classList.add("oculto");
  }
}

// --- ¡Añadir al final del archivo! ---

// Guarda el progreso actual en Supabase para el usuario logueado
async function guardarProgresoEnNube() {
  const local = JSON.parse(localStorage.getItem("progreso") || "{}");
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;

  if (!userId) {
    console.warn("No hay sesión activa.");
    return;
  }

  const { error } = await supabase
    .from("progreso")
    .upsert([{ user_id: userId, progreso: local }]);

  if (error) {
    console.error("❌ Error al guardar progreso en nube:", error.message);
  } else {
    console.log("✅ Progreso guardado en Supabase.");
  }
}
