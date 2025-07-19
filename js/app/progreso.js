let usuarioActual = null; // Declaración global

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Obtener la sesión del usuario
  const { data: sessionData } = await supabase.auth.getSession();
  usuarioActual = sessionData?.session?.user;
  const userId = usuarioActual?.id || usuarioActual?.user?.id;
  if (!userId) {
    document.getElementById("progreso-resumen").innerHTML = "<p>Inicia sesión para ver tu progreso.</p>";
    document.getElementById("progreso-ranking").style.display = "none";
    document.getElementById("progreso-ranking-parroquia").style.display = "none";
    document.getElementById("progreso-ranking-subgrupo").style.display = "none";
    document.getElementById("progreso-historial").style.display = "none";
    document.getElementById("progreso-nivel").style.display = "none";
    document.getElementById("progreso-logros").style.display = "none";
    return;
  }

  document.getElementById("progreso-ranking").style.display = "";
  document.getElementById("progreso-ranking-parroquia").style.display = "";
  document.getElementById("progreso-ranking-subgrupo").style.display = "";
  document.getElementById("progreso-historial").style.display = "";
  document.getElementById("progreso-nivel").style.display = "";
  document.getElementById("progreso-logros").style.display = "";

  // Render
  await mostrarDashboardResumen(userId);
  await mostrarNivelYLogros(userId);
  await mostrarRankingGlobal(userId);
  await mostrarRankingSemanalParroquia();
  await mostrarRankingSubgrupo(userId);
  await mostrarHistorialPartidas(userId);
  });

// --- Dashboard Resumen ---
async function mostrarDashboardResumen(userId) {
  const { data: [resumen], error } = await supabase
    .from("resumen_ranking")
    .select("*")
    .eq("user_id", userId);

  if (error || !resumen) {
    document.getElementById("progreso-resumen").innerHTML = "<p>Error cargando tu progreso.</p>";
    return;
  }
  const nombre = resumen.nombre || usuarioActual.email || "Sin nombre";
  const avatar = nombre.trim().charAt(0).toUpperCase() || "👤";
  const temasTotales = resumen.temas_totales || 60; // O ajusta a tu máximo real

  // Barra de progreso de temas jugados
  const temasJugados = resumen.total_partidas_progreso || 0;
  const porcentajeTemas = temasTotales ? Math.round((temasJugados / temasTotales) * 100) : 0;

  document.getElementById("progreso-resumen").innerHTML = `
    <div class="dashboard-resumen" style="gap:1.2em;">
      <div class="dashboard-icon">${avatar}</div>
      <div class="dashboard-metrics">
        <h2>${nombre}</h2>
        <p><b>XP total:</b> ${resumen.xp_global || 0}</p>
        <p><b>Nivel:</b> ${resumen.nivel || "-"} (${nivelPorA(resumen.total_a_progreso || 0).titulo})</p>
        <p><b>Nota promedio:</b> ${resumen.nota_promedio_progreso ? calcularLetraProm(resumen.nota_promedio_progreso) : "-"}</p>
        <p><b>Temas jugados:</b> ${temasJugados} / ${temasTotales}</p>
        <div class="dashboard-bar"><div class="dashboard-bar-inner" style="width:${porcentajeTemas}%;"></div></div>
        <p><b>Última participación:</b> ${resumen.fecha_ultimo_juego ? new Date(resumen.fecha_ultimo_juego).toLocaleDateString() : "-"}</p>
      </div>
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
function nivelPorA(totalA) {
  if (totalA >= 60) return { nivel: 11, titulo: "Campeón Legendario" };
  if (totalA >= 51) return { nivel: 10, titulo: "Maestro" };
  if (totalA >= 41) return { nivel: 9, titulo: "Discípulo Fiel" };
  if (totalA >= 36) return { nivel: 8, titulo: "Maestro Joven" };
  if (totalA >= 31) return { nivel: 7, titulo: "Sabio en Camino" };
  if (totalA >= 26) return { nivel: 6, titulo: "Perseverante" };
  if (totalA >= 21) return { nivel: 5, titulo: "Investigador" };
  if (totalA >= 16) return { nivel: 4, titulo: "Estudioso" };
  if (totalA >= 11) return { nivel: 3, titulo: "Explorador" };
  if (totalA >= 6)  return { nivel: 2, titulo: "Aprendiz" };
  if (totalA >= 0)  return { nivel: 1, titulo: "Principiante" };
  return { nivel: 0, titulo: "Sin nivel" };
}

// --- Logros rápidos y nivel ---
async function mostrarNivelYLogros(userId) {
  // Desde resumen_ranking
  const { data: [resumen] } = await supabase
    .from("resumen_ranking")
    .select("total_a_progreso")
    .eq("user_id", userId);

  const totalA = resumen?.total_a_progreso || 0;
  const { nivel, titulo } = nivelPorA(totalA);

  document.getElementById("progreso-nivel").innerHTML = `
    <div class="nivel-titulo">
      <span class="nivel-label">Nivel:</span>
      <span class="nivel-num">${nivel}</span>
      <span class="nivel-titulo-nombre">${titulo}</span>
      <div class="nivel-progreso">Coleccionables A: <b>${totalA}</b> / 60</div>
      ${nivel === 11 ? `<div class="nivel-premio">🏆 ¡Coleccionable especial desbloqueado!</div>` : ""}
    </div>
  `;

  // Logros rápidos
  document.getElementById("progreso-logros").innerHTML = `
    <h3>Logros rápidos</h3>
    <div class="logros-grid">
      <div class="logro-card">🏅 <div>${totalA} temas <b>A</b></div></div>
      <div class="logro-card">🥇 <div>Nivel <b>${nivel}</b>: ${titulo}</div></div>
    </div>
  `;
}

// --- Ranking Global (Top 10 XP) ---
async function mostrarRankingGlobal(userId) {
  const { data: rankingGlobal } = await supabase
    .from("resumen_ranking")
    .select("user_id, nombre, xp_global")
    .order("xp_global", { ascending: false })
    .limit(10);

  let html = `<h3>Top 10 Global</h3><ol style="text-align:center;">`;
  (rankingGlobal || []).forEach((u, i) => {
    html += `<li${u.user_id === userId ? ' class="yo"' : ''}>#${i + 1} ${u.nombre || u.user_id.slice(0, 8)} – ${u.xp_global} XP</li>`;
  });
  html += `</ol>`;
  document.getElementById("progreso-ranking").innerHTML = html;
}

// --- Ranking semanal parroquia ---
async function mostrarRankingSemanalParroquia() {
  // Lunes de esta semana
  const hoy = new Date();
  const primerDiaSemana = new Date(hoy.setDate(hoy.getDate() - hoy.getDay() + 1));
  primerDiaSemana.setHours(0, 0, 0, 0);
  const fechaFiltro = primerDiaSemana.toISOString().slice(0, 10);

  // Query
  const { data: progresoSemana, error } = await supabase
    .from("rpg_progreso")
    .select("user_id, xp, parroquia, fecha_juego")
    .gte("fecha_juego", fechaFiltro);

  if (error) {
    document.getElementById("progreso-ranking-parroquia").innerHTML = `<p>Error al cargar ranking parroquial.</p>`;
    return;
  }
  // Agrupa por parroquia
  const parroquias = {};
  (progresoSemana || []).forEach(row => {
    const id = row.parroquia || "SinID";
    if (!parroquias[id]) parroquias[id] = { nombre: row.parroquia || "Sin nombre", xp: 0, count: 0 };
    parroquias[id].xp += row.xp || 0;
    parroquias[id].count++;
  });
  const ranking = Object.values(parroquias)
    .map(p => ({ ...p, xpPromedio: p.count ? p.xp / p.count : 0 }))
    .sort((a, b) => b.xpPromedio - a.xpPromedio);

  let html = `<h3>Ranking semanal parroquial (XP promedio)</h3><ol style="text-align:center;">`;
  ranking.forEach((p, i) => {
    html += `<li>#${i + 1} ${p.nombre} – ${p.xpPromedio.toFixed(1)} XP/promedio (${p.count} jugador${p.count === 1 ? '' : 'es'})</li>`;
  });
  html += "</ol>";
  document.getElementById("progreso-ranking-parroquia").innerHTML = html;
}

// --- Ranking de subgrupo ---
// --- Ranking de subgrupo (versión robusta) ---
async function mostrarRankingSubgrupo() {
  const cont = document.getElementById("progreso-ranking-subgrupo");
  cont.innerHTML = "<div>Cargando ranking de subgrupo...</div>";

  // 1. Obtén SIEMPRE el subgrupo_id directo desde la tabla usuarios
  const { data: usuario, error: errorUsuario } = await supabase
    .from("usuarios")
    .select("subgrupo_id")
    .eq("id", usuarioActual.id)
    .maybeSingle();

  const subgrupoId = usuario?.subgrupo_id;
  if (!subgrupoId || isNaN(Number(subgrupoId))) {
    cont.innerHTML = "<div>No tienes subgrupo asignado.</div>";
    return;
  }

  // 2. Consulta miembros del subgrupo y nombre
  const { data: miembros, error } = await supabase
    .from("usuarios")
    .select("id, nombre, subgrupo_id, rpg_progreso(xp), subgrupos(nombre)")
    .eq("subgrupo_id", Number(subgrupoId));

  if (error || !miembros || miembros.length === 0) {
    cont.innerHTML = "<div>No hay datos de tu subgrupo.</div>";
    return;
  }

  // 3. Saca nombre del subgrupo
  const subgrupoNombre = miembros[0]?.subgrupos?.nombre || "(Sin nombre)";

  // 4. Calcula XP de cada usuario
  const ranking = miembros.map(u => ({
    id: u.id,
    nombre: u.nombre || u.id.slice(0, 8),
    xp: (u.rpg_progreso || []).reduce((a, b) => a + (b.xp || 0), 0)
  })).sort((a, b) => b.xp - a.xp);

  // 5. Posición del usuario actual
  const miPos = ranking.findIndex(r => r.id === usuarioActual.id) + 1;

  // 6. Render
  cont.innerHTML = `
    <h3>Ranking de tu subgrupo <span style="color:#2a9d8f;">${subgrupoNombre}</span></h3>
    <div class="ranking-subgrupo-list">
      ${ranking.map((r, i) => `
        <div class="ranking-row${r.id === usuarioActual.id ? " actual" : ""}">
          <span class="pos">#${i + 1}</span>
          <span class="nombre">${r.nombre}</span>
          <span class="xp">${r.xp} XP</span>
          ${r.id === usuarioActual.id ? "<span class='tuyo'>(Tú)</span>" : ""}
        </div>
      `).join("")}
    </div>
    <div class="posicion-propia">Tu puesto: #${miPos} de ${ranking.length}</div>
  `;
}


// --- Historial de partidas (solo últimos 10) ---
async function mostrarHistorialPartidas(userId) {
  const { data: partidas } = await supabase
    .from("progreso")
    .select("tipo, clave, nota, porcentaje, fecha")
    .eq("user_id", userId)
    .order("fecha", { ascending: false })
    .limit(10);

  let html = `<h3>Historial reciente</h3><ul class="historial-lista">`;
  (partidas || []).forEach(part => {
    html += `<li>${part.tipo} – ${part.clave || ""} <span>${part.nota || "-"} (${part.porcentaje || "-"}%)</span> <small>${new Date(part.fecha).toLocaleDateString()}</small></li>`;
  });
  html += "</ul>";
  document.getElementById("progreso-historial").innerHTML = html;
}

