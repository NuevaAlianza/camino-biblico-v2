let usuarioActual = null; // Declaración global

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Obtener la sesión del usuario
  const { data: sessionData } = await supabase.auth.getSession();
  usuarioActual = sessionData?.session?.user;

  // Valida user id correctamente (según estructura de supabase.auth)
  const userId = usuarioActual?.id || usuarioActual?.user?.id;
  if (!userId) {
    document.getElementById("progreso-resumen").innerHTML = "<p>Inicia sesión para ver tu progreso.</p>";
    document.getElementById("progreso-ranking").style.display = "none";
    document.getElementById("progreso-ranking-parroquia").style.display = "none";
    document.getElementById("progreso-historial").style.display = "none";
    return;
  }

  document.getElementById("progreso-ranking").style.display = "";
  document.getElementById("progreso-ranking-parroquia").style.display = "";
  document.getElementById("progreso-historial").style.display = "";

  // Llama funciones pasando userId si es necesario
  await mostrarDashboardResumen(userId);
  await mostrarRankingGlobal(userId);
  await mostrarRankingSemanalParroquia();
  await mostrarHistorialPartidas(userId);
});

// --- 1. Dashboard Resumen ---
async function mostrarDashboardResumen(userId) {
  const { data: [resumen], error } = await supabase
    .from("resumen_ranking")
    .select("*")
    .eq("user_id", userId);

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
async function mostrarRankingGlobal(userId) {
  const { data: rankingGlobal } = await supabase
    .from("resumen_ranking")
    .select("user_id, nombre, xp_global")
    .order("xp_global", { ascending: false })
    .limit(10);

  let html = `<h3>Top 10 Global</h3><ol>`;
  rankingGlobal.forEach((u, i) => {
    html += `<li${u.user_id === userId ? ' class="yo"' : ''}>#${i+1} ${u.nombre || u.user_id.slice(0,8)} – ${u.xp_global} XP</li>`;
  });
  html += `</ol>`;
  document.getElementById("progreso-ranking").innerHTML = html;
}

// --- 3. Ranking Semanal por Parroquia (XP promedio) ---
async function mostrarRankingSemanalParroquia() {
  // 1. Calcula el inicio de la semana (lunes)
  const hoy = new Date();
  const primerDiaSemana = new Date(hoy.setDate(hoy.getDate() - hoy.getDay() + 1));
  primerDiaSemana.setHours(0,0,0,0);

  // Usa sólo la fecha en formato "YYYY-MM-DD"
  const fechaFiltro = primerDiaSemana.toISOString().slice(0, 10);

  // Consulta usando sólo la fecha
  const { data: progresoSemana, error } = await supabase
    .from("rpg_progreso")
    .select("user_id, xp, parroquia, parroquia_id, fecha_juego")
    .gte("fecha_juego", fechaFiltro);

  if (error) {
    console.error("Error al consultar rpg_progreso:", error);
    document.getElementById("progreso-ranking-parroquia").innerHTML = `<p>Error al cargar ranking parroquial.</p>`;
    return;
  }

  // Resto del procesamiento igual...
  const parroquias = {};
  (progresoSemana || []).forEach(row => {
    const id = row.parroquia_id || "SinID";
    if (!parroquias[id]) parroquias[id] = { nombre: row.parroquia || "Sin nombre", xp: 0, count: 0 };
    parroquias[id].xp += row.xp || 0;
    parroquias[id].count++;
  });

  const ranking = Object.values(parroquias)
    .map(p => ({ ...p, xpPromedio: p.count ? p.xp / p.count : 0 }))
    .sort((a, b) => b.xpPromedio - a.xpPromedio);

  let html = `<h3>Ranking semanal parroquial (XP promedio)</h3><ol>`;
  ranking.forEach((p, i) => {
    html += `<li>#${i + 1} ${p.nombre} – ${p.xpPromedio.toFixed(1)} XP/promedio (${p.count} jugador${p.count === 1 ? '' : 'es'})</li>`;
  });
  html += "</ol>";
  document.getElementById("progreso-ranking-parroquia").innerHTML = html;
}


  // 6. Ordena por XP promedio
  const ranking = Object.values(parroquias)
    .map(p => ({ ...p, xpPromedio: p.count ? p.xp/p.count : 0 }))
    .sort((a, b) => b.xpPromedio - a.xpPromedio);

  // 7. Renderiza el ranking
  let html = `<h3>Ranking semanal parroquial (XP promedio)</h3><ol>`;
  ranking.forEach((p, i) => {
    html += `<li>#${i+1} ${p.nombre} – ${p.xpPromedio.toFixed(1)} XP/promedio (${p.count} jugador${p.count === 1 ? '' : 'es'})</li>`;
  });
  html += "</ol>";
  document.getElementById("progreso-ranking-parroquia").innerHTML = html;
}


// --- 4. (Opcional) Historial de partidas (solo últimos 10) ---
async function mostrarHistorialPartidas(userId) {
  const { data: partidas } = await supabase
    .from("progreso")
    .select("tipo, clave, nota, porcentaje, fecha")
    .eq("user_id", userId)
    .order("fecha", { ascending: false })
    .limit(10);

  let html = `<h3>Historial reciente</h3><ul>`;
  (partidas || []).forEach(part => {
    html += `<li>${part.tipo} – ${part.clave || ""} <span>${part.nota || "-"} (${part.porcentaje || "-"}%)</span> <small>${new Date(part.fecha).toLocaleDateString()}</small></li>`;
  });
  html += "</ul>";
  document.getElementById("progreso-historial").innerHTML = html;
}
