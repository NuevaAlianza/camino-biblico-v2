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
    console.error("❌ Error al guardar progreso:", error.message);
  } else {
    console.log("✅ Progreso guardado en Supabase.");
  }
}

// Carga el progreso desde Supabase y lo guarda en localStorage
async function cargarProgresoDesdeNube() {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;

  if (!userId) {
    console.warn("No hay sesión activa.");
    return;
  }

  const { data, error } = await supabase
    .from("progreso")
    .select("progreso")
    .eq("user_id", userId)
    .maybeSingle(); 

  if (error) {
    console.warn("No se pudo cargar progreso:", error.message);
  } else if (data?.progreso) {
    localStorage.setItem("progreso", JSON.stringify(data.progreso));
    console.log("✅ Progreso sincronizado desde Supabase.");
  } else {
    console.log("ℹ️ No hay progreso previo guardado en la nube.");
  }
}
