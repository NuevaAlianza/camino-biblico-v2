let usuarioActual = null; // Declaración global

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Obtener la sesión del usuario
  const { data: sessionData } = await supabase.auth.getSession();
  usuarioActual = sessionData?.session?.user;

  if (!usuarioActual) {
    // Muestra mensaje si no está logueado y detiene el resto del código
    document.getElementById("progreso-resumen").innerHTML = "<p>Inicia sesión para ver tu progreso.</p>";
    // Puedes ocultar otras secciones si quieres:
    document.getElementById("progreso-ranking").style.display = "none";
    document.getElementById("progreso-ranking-parroquia").style.display = "none";
    document.getElementById("progreso-historial").style.display = "none";
    return;
  }

  // Si hay usuario, muestra todas las secciones (por si estaban ocultas)
  document.getElementById("progreso-ranking").style.display = "";
  document.getElementById("progreso-ranking-parroquia").style.display = "";
  document.getElementById("progreso-historial").style.display = "";

  // 2. Ahora puedes llamar seguro a tus funciones
  await mostrarDashboardResumen();
  await mostrarRankingGlobal();
  await mostrarRankingSemanalParroquia();
  await mostrarHistorialPartidas();
});


// --- 1. Dashboard Resumen ---
async function mostrarDashboardResumen() {
  const { data: [resumen], error } = await supabase
    .from("resumen_ranking")
    .select("*")
    .eq("user_id", usuarioActual.id);

  if (error || !resumen) {
    document.getElementById("progreso-resumen").innerHTML = "<p>Error cargando tu progreso.</p>";
    return;
  }

  document.getElementById("progreso-resumen").innerHTML = `
    <div class="dashboard-resumen">
      <h2>👤 ${resumen.nombre || usuarioActual.email}</h2>
      <div><b>Última participación:</b> ${resumen.fecha_ultimo_juego ? new Date(resumen.fecha_ultimo_juego).toLocaleDateString() : "-"}</div>
      <div><b>XP total:</b> ${resumen.xp_global || 0}</div>
      <div><b>Temas jugados:</b> ${resumen.total_partidas_progreso || 0}</div>
      <div><b>Nota promedio:</b> ${resumen.nota_promedio_progreso ? calcularLetraProm(resumen.nota_promedio_progreso) : "-"}</div>
      <div><b>Coleccionables “A”:</b> ${resumen.total_a_progreso || 0}</div>
      <div><b>% aciertos:</b> ${resumen.porcentaje_promedio_progreso ? resumen.porcentaje_promedio_progreso.toFixed(1) + "%" : "-"}</div>
      <div><b>Nivel:</b> ${resumen.nivel || "-"}</div>
    </div>
  `;
}
function calcularLetraProm(n) {
  if (n >= 95) return "A";
  if (n >= 85) return "B";
  if (n >= 70) return "C";
  if (n > 0) return "D";
  return "-";
}

// --- 2. Ranking Global (Top 10 XP) ---
async function mostrarRankingGlobal() {
  const { data: rankingGlobal } = await supabase
    .from("resumen_ranking")
    .select("user_id, nombre, xp_global")
    .order("xp_global", { ascending: false })
    .limit(10);

  let html = `<h3>Top 10 Global</h3><ol>`;
  rankingGlobal.forEach((u, i) => {
    html += `<li${u.user_id === usuarioActual.id ? ' class="yo"' : ''}>#${i+1} ${u.nombre || u.user_id.slice(0,8)} – ${u.xp_global} XP</li>`;
  });
  html += `</ol>`;
  document.getElementById("progreso-ranking").innerHTML = html;
}

// --- 3. Ranking Semanal por Parroquia (XP promedio) ---
async function mostrarRankingSemanalParroquia() {
  // Inicio de semana (lunes)
  const hoy = new Date();
  const primerDiaSemana = new Date(hoy.setDate(hoy.getDate() - hoy.getDay() + 1));
  primerDiaSemana.setHours(0,0,0,0);

  // Consulta directa a rpg_progreso de la semana
  const { data: progresoSemana } = await supabase
    .from("rpg_progreso")
    .select("user_id, xp, parroquia, parroquia_id, fecha_juego")
    .gte("fecha_juego", primerDiaSemana.toISOString());

  // Agrupa por parroquia
  const parroquias = {};
  (progresoSemana || []).forEach(row => {
    const id = row.parroquia_id || "SinID";
    if (!parroquias[id]) parroquias[id] = { nombre: row.parroquia || "Sin nombre", xp: 0, count: 0 };
    parroquias[id].xp += row.xp || 0;
    parroquias[id].count++;
  });

  // Ordena por XP promedio
  const ranking = Object.values(parroquias)
    .map(p => ({ ...p, xpPromedio: p.count ? p.xp/p.count : 0 }))
    .sort((a, b) => b.xpPromedio - a.xpPromedio);

  // Renderiza el ranking
  let html = `<h3>Ranking semanal parroquial (XP promedio)</h3><ol>`;
  ranking.forEach((p, i) => {
    html += `<li>#${i+1} ${p.nombre} – ${p.xpPromedio.toFixed(1)} XP/promedio (${p.count} jugadores)</li>`;
  });
  html += "</ol>";
  document.getElementById("progreso-ranking-parroquia").innerHTML = html;
}

// --- 4. (Opcional) Historial de partidas (solo últimos 10) ---
async function mostrarHistorialPartidas() {
  const { data: partidas } = await supabase
    .from("progreso")
    .select("tipo, clave, nota, porcentaje, fecha")
    .eq("user_id", usuarioActual.id)
    .order("fecha", { ascending: false })
    .limit(10);

  let html = `<h3>Historial reciente</h3><ul>`;
  (partidas || []).forEach(part => {
    html += `<li>${part.tipo} – ${part.clave || ""} <span>${part.nota || "-"} (${part.porcentaje || "-"}%)</span> <small>${new Date(part.fecha).toLocaleDateString()}</small></li>`;
  });
  html += "</ul>";
  document.getElementById("progreso-historial").innerHTML = html;
}

// --- 5. (Opcional) Llama todo al cargar la página ---
document.addEventListener("DOMContentLoaded", async () => {
  // Aquí asume que tienes usuarioActual cargado
  await mostrarDashboardResumen();
  await mostrarRankingGlobal();
  await mostrarRankingSemanalParroquia();
  await mostrarHistorialPartidas();
});
