let coleccionablesData = {};
let progresoGlobal = {};
let usuarioActual = null;

// --- 1. Cargar progreso, usuario y datos de categorías ---
document.addEventListener("DOMContentLoaded", async () => {
  // 1.1 Obtener sesión y metadata
  const { data: sessionData } = await supabase.auth.getSession();
  usuarioActual = sessionData?.session?.user;
  if (!usuarioActual) return; // No logueado
  const meta = usuarioActual?.user_metadata || {};
  const pais = meta.pais || "N/A";
  const ciudad = meta.ciudad || "N/A";
  const parroquia = meta.parroquia || "N/A";

  // 1.2 Cargar categorías y temas (JSON completo)
  coleccionablesData = await fetch('./datos/coleccionables.json').then(res => res.json());

  // 1.3 Cargar progreso individual de quizzes comentados
  const { data: progresoRows } = await supabase
    .from("progreso")
    .select("*")
    .eq("user_id", usuarioActual.id);

  // Procesar progreso a objeto (por categoría/tema)
  progresoGlobal = { categorias: {}, historial: [] };
  progresoRows.forEach(row => {
    if (row.tipo === "quiz comentado") {
      const categoria = row.categoria || "Sin Categoría";
      if (!progresoGlobal.categorias[categoria]) progresoGlobal.categorias[categoria] = {};
      progresoGlobal.categorias[categoria][row.clave] = {
        nota: row.nota,
        porcentaje: row.porcentaje,
        fecha: row.fecha
      };
    }
    progresoGlobal.historial.push(row);
  });

  // --- Render visual ---
  mostrarDashboardAnimado();
  mostrarBarrasPorCategoria();
  await mostrarRanking({ pais, ciudad, parroquia });
  mostrarHistorialPartidas();
  mostrarLogrosRapidos();
});

// --- 2. Mini dashboard animado ---
function mostrarDashboardAnimado() {
  const cont = document.getElementById("progreso-resumen");
  let totalTemas = 0;
  for (const categoria in coleccionablesData) {
    if (categoria.toLowerCase() === "logros") continue;
    totalTemas += Object.keys(coleccionablesData[categoria]).length;
  }
  const categorias = Object.values(progresoGlobal.categorias || {});
  const temasJugados = categorias.reduce((a, b) => a + Object.keys(b).length, 0);
  const notas = categorias.flatMap(cat => Object.values(cat).map(x => (x.nota || "").toUpperCase()));
  const notasNum = notas.map(n => n === "A" ? 3 : n === "B" ? 2 : n === "C" ? 1 : 0);
  const notaProm = notasNum.length ? (notasNum.reduce((a, b) => a + b, 0) / notasNum.length) : 0;
  let letraProm = "-";
  if (notaProm >= 2.5) letraProm = "A";
  else if (notaProm >= 1.5) letraProm = "B";
  else if (notaProm > 0) letraProm = "C";

  cont.innerHTML = `
    <div class="dashboard-resumen">
      <div class="dashboard-icon">📊</div>
      <div class="dashboard-metrics">
        <h2>Resumen general</h2>
        <p><b>${temasJugados}</b> de <b>${totalTemas}</b> temas jugados</p>
        <p>Nota promedio: <b>${letraProm}</b></p>
        <div class="dashboard-bar"><div class="dashboard-bar-inner" style="width:${(temasJugados / totalTemas) * 100}%"></div></div>
      </div>
    </div>
  `;
}

// --- 3. Barras visuales por categoría ---
function mostrarBarrasPorCategoria() {
  const cont = document.getElementById("progreso-categorias");
  let html = `<h3>Progreso por categoría</h3>`;
  for (const categoria in coleccionablesData) {
    if (categoria.toLowerCase() === "logros") continue;
    const temasTotales = Object.keys(coleccionablesData[categoria]).length;
    const progresoCats = Object.keys(progresoGlobal.categorias || {});
    const catKey = progresoCats.find(
      c => c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() ===
        categoria.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    );
    const temasJ = catKey ? progresoGlobal.categorias[catKey] : {};
    const jugados = Object.keys(temasJ).length;
    const notas = Object.values(temasJ).map(x => (x.nota || "").toUpperCase());
    const notasNum = notas.map(n => n === "A" ? 3 : n === "B" ? 2 : n === "C" ? 1 : 0);
    const prom = notasNum.length ? (notasNum.reduce((a, b) => a + b, 0) / notasNum.length) : 0;
    let letra = "-";
    if (prom >= 2.5) letra = "A";
    else if (prom >= 1.5) letra = "B";
    else if (prom > 0) letra = "C";

    html += `
      <div class="categoria-bar-row" title="Has completado ${jugados} de ${temasTotales} temas. Promedio: ${letra}">
        <div class="categoria-nombre">${categoria}</div>
        <div class="categoria-bar-outer">
          <div class="categoria-bar-inner" style="width:0%" data-meta="${(jugados / temasTotales) * 100}"></div>
        </div>
        <div class="categoria-bar-meta">${jugados}/${temasTotales} <span>${letra}</span></div>
      </div>
    `;
  }
  cont.innerHTML = html;
  setTimeout(() => {
    document.querySelectorAll('.categoria-bar-inner').forEach(bar => {
      bar.style.width = bar.dataset.meta + "%";
    });
  }, 120);
}

// --- 4. Ranking visual (con debug de arrays) ---
async function mostrarRanking({ pais, ciudad, parroquia }) {
  const cont = document.getElementById("progreso-ranking");
  cont.innerHTML = `<h3>Tu Ranking</h3><div id="rankings"></div>`;

  // --- Consulta todos los registros (filtro según corresponde) ---
  const queryRanking = async (campo, valor) => {
    let q = supabase
      .from("rpg_progreso")
      .select("user_id, xp, pais, ciudad, parroquia")
      .eq("completado", true);
    if (campo && valor && valor !== "N/A") q = q.eq(campo, valor);

    const { data, error } = await q;
    if (error) {
      console.error("Error al consultar ranking:", error.message);
      return [];
    }
    // Agrupar por usuario, sumar XP total
    const xpPorUsuario = {};
    (data || []).forEach(row => {
      if (!xpPorUsuario[row.user_id]) xpPorUsuario[row.user_id] = 0;
      xpPorUsuario[row.user_id] += row.xp || 0;
    });
    return Object.entries(xpPorUsuario)
      .map(([user_id, xp]) => ({ user_id, xp }))
      .sort((a, b) => b.xp - a.xp);
  };

  // Ranking global
  const global = await queryRanking();
  const porPais = await queryRanking("pais", pais);
  const porCiudad = await queryRanking("ciudad", ciudad);
  const porParroquia = await queryRanking("parroquia", parroquia);

  // --- Debug para ver en consola ---
  console.log("Ranking Global:", global);
  console.log("Ranking País:", porPais, "Pais:", pais);
  console.log("Ranking Ciudad:", porCiudad, "Ciudad:", ciudad);
  console.log("Ranking Parroquia:", porParroquia, "Parroquia:", parroquia);

  // Busca posición del usuario actual en cada ranking
  const posGlobal = global.findIndex(r => r.user_id === usuarioActual.id) + 1;
  const posPais = porPais.findIndex(r => r.user_id === usuarioActual.id) + 1;
  const posCiudad = porCiudad.findIndex(r => r.user_id === usuarioActual.id) + 1;
  const posParroquia = porParroquia.findIndex(r => r.user_id === usuarioActual.id) + 1;

  document.getElementById("rankings").innerHTML = `
    <div class="ranking-panel">
      <p>🌎 Global: <b>#${posGlobal > 0 ? posGlobal : '-'}</b> de ${global.length}</p>
      <p>🇩🇴 País: <b>#${posPais > 0 ? posPais : '-'}</b> de ${porPais.length} (${pais})</p>
      <p>🏙️ Ciudad: <b>#${posCiudad > 0 ? posCiudad : '-'}</b> de ${porCiudad.length} (${ciudad})</p>
      <p>⛪ Parroquia: <b>#${posParroquia > 0 ? posParroquia : '-'}</b> de ${porParroquia.length} (${parroquia})</p>
    </div>
  `;
}

// --- 5. Historial de partidas ---
function mostrarHistorialPartidas() {
  const cont = document.getElementById("progreso-historial");
  const partidas = progresoGlobal.historial || [];
  let html = `<h3>Historial de partidas</h3><ul class="historial-lista">`;
  partidas.slice(-10).reverse().forEach(part => {
    html += `<li>${part.tipo} – ${part.clave || ""} <span>${part.nota || "-"} (${part.porcentaje || "-"}%)</span> <small>${new Date(part.fecha).toLocaleDateString()}</small></li>`;
  });
  html += "</ul>";
  cont.innerHTML = html;
}

// --- 6. Logros rápidos visuales ---
function mostrarLogrosRapidos() {
  const cont = document.getElementById("progreso-logros");
  let totalA = 0, categoriasA = 0;
  for (const cat in progresoGlobal.categorias) {
    const temas = progresoGlobal.categorias[cat];
    const numA = Object.values(temas).filter(t => t.nota === "A").length;
    totalA += numA;
    const allA = Object.values(temas).length &&
      Object.values(temas).every(t => t.nota === "A");
    if (allA && Object.values(temas).length > 0) categoriasA++;
  }
  cont.innerHTML = `
    <h3>Logros rápidos</h3>
    <div class="logros-grid">
      <div class="logro-card">🏅 <div>${totalA} temas <b>A</b></div></div>
      <div class="logro-card">🥇 <div>${categoriasA} categoría(s) <b>todas A</b></div></div>
    </div>
  `;
}

