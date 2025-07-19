let usuarioActual = null; // Declaración global

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Obtener la sesión del usuario
  const { data: sessionData } = await supabase.auth.getSession();
  usuarioActual = sessionData?.session?.user;
  const userId = usuarioActual?.id || usuarioActual?.user?.id;
  if (!userId) {
    ocultarTodosLosRankings();
    document.getElementById("progreso-resumen").innerHTML = "<p>Inicia sesión para ver tu progreso.</p>";
    return;
  }

  

  // Render
  await mostrarDashboardResumen(userId);
  await mostrarNivelYLogros(userId);
  await mostrarRankingGlobal(userId);
  await mostrarRankingParroquia(userId);
  await mostrarRankingSubgrupo(userId);
  await mostrarHistorialPartidas(userId);
});

function ocultarTodosLosSlidesRanking() {
  document.getElementById("slide-ranking-global").style.display = "none";
  document.getElementById("slide-ranking-parroquia").style.display = "none";
  document.getElementById("slide-ranking-subgrupo").style.display = "none";
  document.getElementById("slide-historial").style.display = "none";
  document.getElementById("slide-logros").style.display = "none";
}

function mostrarTodosLosSlidesRanking() {
  document.getElementById("slide-ranking-global").style.display = "";
  document.getElementById("slide-ranking-parroquia").style.display = "";
  document.getElementById("slide-ranking-subgrupo").style.display = "";
  document.getElementById("slide-historial").style.display = "";
  document.getElementById("slide-logros").style.display = "";
}


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
  const temasTotales = resumen.temas_totales || 60; // Ajusta a tu máximo real
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
}
const logrosSlide = document.getElementById("slide-logros");
if (logrosSlide) {
  logrosSlide.innerHTML = `
    <h3>Logros rápidos</h3>
    <div class="logros-grid">
      <div class="logro-card">🏅 <div>${totalA} temas <b>A</b></div></div>
      <div class="logro-card">🥇 <div>Nivel <b>${nivel}</b>: ${titulo}</div></div>
    </div>
  `;
} else {
  console.warn('No se encontró el elemento #slide-logros');
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

// --- Ranking parroquial (XP promedio por parroquia) ---
async function mostrarRankingParroquia(userId) {
  // Obtén todas las parroquias con usuarios
  const { data: parroquiasAll } = await supabase
    .from("resumen_ranking")
    .select("parroquia_id, parroquia_nombre, xp_global, user_id")
    .not("parroquia_id", "is", null);

  if (!parroquiasAll || parroquiasAll.length === 0) {
    document.getElementById("progreso-ranking-parroquia").innerHTML = "<p>No hay datos parroquiales aún.</p>";
    return;
  }

  // Agrupa por parroquia_id
  const parroquiaMap = {};
  parroquiasAll.forEach(row => {
    if (!parroquiaMap[row.parroquia_id]) {
      parroquiaMap[row.parroquia_id] = {
        nombre: row.parroquia_nombre || `Parroquia ${row.parroquia_id}`,
        xp: 0,
        count: 0
      };
    }
    parroquiaMap[row.parroquia_id].xp += row.xp_global || 0;
    parroquiaMap[row.parroquia_id].count++;
  });

  const ranking = Object.entries(parroquiaMap)
    .map(([id, p]) => ({
      id,
      nombre: p.nombre,
      xpPromedio: p.count ? p.xp / p.count : 0,
      count: p.count
    }))
    .sort((a, b) => b.xpPromedio - a.xpPromedio);

  let html = `<h3>Ranking parroquial (XP promedio)</h3><ol style="text-align:center;">`;
  ranking.forEach((p, i) => {
    html += `<li>#${i + 1} ${p.nombre} – ${p.xpPromedio.toFixed(1)} XP/promedio (${p.count} jugador${p.count === 1 ? '' : 'es'})</li>`;
  });
  html += "</ol>";
  document.getElementById("progreso-ranking-parroquia").innerHTML = html;
}

// --- Ranking de subgrupo (XP total por subgrupo) ---
async function mostrarRankingSubgrupo(userId) {
  // 1. Saca tu subgrupo
  const { data: [resumenPropio] } = await supabase
    .from("resumen_ranking")
    .select("subgrupo")
    .eq("user_id", userId);

  const subgrupoId = resumenPropio?.subgrupo;
  const cont = document.getElementById("progreso-ranking-subgrupo");
  cont.innerHTML = "<div>Cargando ranking de subgrupo...</div>";

  if (!subgrupoId) {
    cont.innerHTML = "<div>No tienes subgrupo asignado.</div>";
    return;
  }

  // 2. Obtén todos los usuarios de ese subgrupo
  const { data: miembros } = await supabase
    .from("resumen_ranking")
    .select("user_id, nombre, xp_global")
    .eq("subgrupo", subgrupoId);

  if (!miembros || miembros.length === 0) {
    cont.innerHTML = "<div>No hay datos de tu subgrupo.</div>";
    return;
  }

  // 3. Ranking
  const ranking = miembros
    .map(u => ({
      id: u.user_id,
      nombre: u.nombre || u.user_id.slice(0,8),
      xp: u.xp_global || 0
    }))
    .sort((a, b) => b.xp - a.xp);

  const miPos = ranking.findIndex(r => r.id === userId) + 1;
  cont.innerHTML = `
    <h3>Ranking de tu subgrupo <span style="color:#2a9d8f;">#${subgrupoId}</span></h3>
    <div class="ranking-subgrupo-list">
      ${ranking.map((r, i) => `
        <div class="ranking-row${r.id === userId ? " actual" : ""}">
          <span class="pos">#${i+1}</span>
          <span class="nombre">${r.nombre}</span>
          <span class="xp">${r.xp} XP</span>
          ${r.id === userId ? "<span class='tuyo'>(Tú)</span>" : ""}
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
// --- SLIDER DE SECCIONES ---
const slideIds = [
  "slide-ranking-global",
  "slide-ranking-parroquia",
  "slide-ranking-subgrupo",
  "slide-historial",
  "slide-logros"
];
let progresoSlideActual = 0;

function mostrarSlideProgreso(idx) {
  slideIds.forEach((id, i) => {
    const slide = document.getElementById(id);
    if (!slide) return;
    slide.classList.toggle("visible", i === idx);
  });

  // Actualiza los bullets
  const bullets = document.getElementById("progreso-bullets");
  if (bullets) {
    bullets.innerHTML = slideIds.map((_, i) =>
      `<button type="button" class="${i === idx ? 'active' : ''}" onclick="mostrarSlideProgreso(${i})"></button>`
    ).join("");
  }
  progresoSlideActual = idx;
}

// Hace visible el primero al cargar
document.addEventListener("DOMContentLoaded", () => mostrarSlideProgreso(0));
// Expón función global para los bullets
window.mostrarSlideProgreso = mostrarSlideProgreso;
}
