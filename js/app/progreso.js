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
 // mostrarBarrasPorCategoria();//
  await mostrarRanking({ pais, ciudad, parroquia });
  mostrarHistorialPartidas();
  mostrarLogrosRapidos();

// <-- Aquí la llamada al nuevo ranking de parroquia:
  await mostrarRankingParroquiaAvanzado();
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



// --- 4. Ranking visual moderno ---
async function mostrarRanking({ pais, ciudad, parroquia }) {
  const cont = document.getElementById("progreso-ranking");
  cont.innerHTML = `<h3>Tu Ranking</h3><div id="rankings"></div>`;

  // --- 1. Consulta XP RPG ---
  const queryRPG = async (campo, valor) => {
    let q = supabase
      .from("rpg_progreso")
      .select("user_id, xp, pais, ciudad, parroquia")
      .eq("completado", true);
    if (campo && valor && valor !== "N/A") q = q.eq(campo, valor);
    const { data, error } = await q;
    if (error) {
      console.error("Error ranking RPG:", error.message);
      return [];
    }
    const xpPorUsuario = {};
    (data || []).forEach(row => {
      if (!xpPorUsuario[row.user_id]) xpPorUsuario[row.user_id] = 0;
      xpPorUsuario[row.user_id] += row.xp || 0;
    });
    return xpPorUsuario;
  };

// --- 2. Consulta XP Trivia Flash ---
const queryTrivia = async (campo, valor) => {
  let q = supabase
    .from("trivia_flash")
    .select("user_id, xp_obtenido");

  // Trivia Flash no guarda país/ciudad, así que ignora filtros
  // pero puedes dejar el argumento para mantener la firma igual

  const { data, error } = await q;
  if (error) {
    console.error("Error ranking Trivia:", error.message);
    return [];
  }
  const xpPorUsuario = {};
  (data || []).forEach(row => {
    if (!xpPorUsuario[row.user_id]) xpPorUsuario[row.user_id] = 0;
    xpPorUsuario[row.user_id] += row.xp_obtenido || 0;
  });
  return xpPorUsuario;
};


  // --- 3. Carga y combina ambos rankings ---
  // Global
  const xpRPGGlobal = await queryRPG();
  const xpTriviaGlobal = await queryTrivia();
  const usuarios = new Set([...Object.keys(xpRPGGlobal), ...Object.keys(xpTriviaGlobal)]);
  const global = [...usuarios].map(user_id => ({
    user_id,
    xp: (xpRPGGlobal[user_id] || 0) + (xpTriviaGlobal[user_id] || 0)
  })).sort((a, b) => b.xp - a.xp);

  // País
  const xpRPGPais = await queryRPG("pais", pais);
  const xpTriviaPais = await queryTrivia(); // Trivia Flash no tiene país/ciudad, así que filtra en el renderizado
  const usuariosPais = Object.keys(xpRPGPais); // Solo los que tienen RPG en ese país
  const porPais = usuariosPais.map(user_id => ({
    user_id,
    xp: (xpRPGPais[user_id] || 0) + (xpTriviaPais[user_id] || 0)
  })).sort((a, b) => b.xp - a.xp);

  // Ciudad
  const xpRPGCiudad = await queryRPG("ciudad", ciudad);
  const usuariosCiudad = Object.keys(xpRPGCiudad);
  const porCiudad = usuariosCiudad.map(user_id => ({
    user_id,
    xp: (xpRPGCiudad[user_id] || 0) + (xpTriviaGlobal[user_id] || 0)
  })).sort((a, b) => b.xp - a.xp);

  // Parroquia
  const xpRPGParroquia = await queryRPG("parroquia", parroquia);
  const usuariosParroquia = Object.keys(xpRPGParroquia);
  const porParroquia = usuariosParroquia.map(user_id => ({
    user_id,
    xp: (xpRPGParroquia[user_id] || 0) + (xpTriviaGlobal[user_id] || 0)
  })).sort((a, b) => b.xp - a.xp);

  // --- 4. Posiciones y XP del usuario actual ---
  const miUsuario = global.find(r => r.user_id === usuarioActual.id);
  const xpTotal = miUsuario ? miUsuario.xp : 0;
  const posGlobal = global.findIndex(r => r.user_id === usuarioActual.id) + 1;
  const posPais = porPais.findIndex(r => r.user_id === usuarioActual.id) + 1;
  const posCiudad = porCiudad.findIndex(r => r.user_id === usuarioActual.id) + 1;
  const posParroquia = porParroquia.findIndex(r => r.user_id === usuarioActual.id) + 1;
  const puestoParroquia = posParroquia > 0 ? `#${posParroquia} de ${porParroquia.length}` : "-";

  // Tarjetas visuales
  document.getElementById("rankings").innerHTML = `
    <div class="ranking-grid">
      <div class="ranking-card global">
        <div class="ranking-emoji">🌎</div>
        <div class="ranking-label">Global</div>
        <div class="ranking-pos">#${posGlobal > 0 ? posGlobal : '-'}</div>
        <div class="ranking-total">de ${global.length}</div>
      </div>
      <div class="ranking-card pais">
        <div class="ranking-emoji">🇩🇴</div>
        <div class="ranking-label">País</div>
        <div class="ranking-pos">#${posPais > 0 ? posPais : '-'}</div>
        <div class="ranking-total">de ${porPais.length}</div>
        <div class="ranking-extra">${pais}</div>
      </div>
      <div class="ranking-card ciudad">
        <div class="ranking-emoji">🏙️</div>
        <div class="ranking-label">Ciudad</div>
        <div class="ranking-pos">#${posCiudad > 0 ? posCiudad : '-'}</div>
        <div class="ranking-total">de ${porCiudad.length}</div>
        <div class="ranking-extra">${ciudad}</div>
      </div>
      <div class="ranking-card parroquia">
        <div class="ranking-emoji">⛪</div>
        <div class="ranking-label">Parroquia</div>
        <div class="ranking-pos">#${posParroquia > 0 ? posParroquia : '-'}</div>
        <div class="ranking-total">de ${porParroquia.length}</div>
        <div class="ranking-extra">${parroquia}</div>
      </div>
    </div>
  `;

  // Panel resumen usuario
  mostrarPanelResumenUsuario(xpTotal, posGlobal, puestoParroquia);
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

function obtenerNivelPorA(totalA) {
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

// En tu dashboard o resumen:
function mostrarNivelTitulo(totalA) {
  const { nivel, titulo } = obtenerNivelPorA(totalA);
  const cont = document.getElementById("progreso-nivel");
  cont.innerHTML = `
    <div class="nivel-titulo">
      <span class="nivel-label">Nivel:</span>
      <span class="nivel-num">${nivel}</span>
      <span class="nivel-titulo-nombre">${titulo}</span>
      <div class="nivel-progreso">Coleccionables A: <b>${totalA}</b> / 60</div>
      ${nivel === 11 ? `<div class="nivel-premio">🏆 ¡Coleccionable especial desbloqueado!</div>` : ""}
    </div>
  `;
}
// Asume que ya tienes usuarioActual y que usuarioActual.subgrupo_id está disponible
async function mostrarRankingSubgrupo() {
  const cont = document.getElementById("progreso-ranking-subgrupo");
  if (!usuarioActual?.subgrupo_id) {
    cont.innerHTML = "<div>No tienes subgrupo asignado.</div>";
    return;
  }
  const { data: subgrupoRanking, error } = await supabase
    .from("usuarios")
    .select("id, nombre, subgrupo_id, subgrupos(nombre), rpg_progreso(xp)")
    .eq("subgrupo_id", usuarioActual.subgrupo_id);

  if (error) {
    cont.innerHTML = "<div>Error al cargar ranking de subgrupo.</div>";
    return;
  }

  // Calcular XP total por usuario y ordenar
  const ranking = subgrupoRanking.map(u => ({
    id: u.id,
    nombre: u.nombre,
    xp: (u.rpg_progreso || []).reduce((a, b) => a + (b.xp || 0), 0),
    subgrupo: u.subgrupos?.nombre || ""
  })).sort((a, b) => b.xp - a.xp);

  // Buscar posición actual
  const posUsuario = ranking.findIndex(r => r.id === usuarioActual.id) + 1;

  cont.innerHTML = `
    <h3>Ranking de tu subgrupo (${ranking[0]?.subgrupo || ""})</h3>
    <div class="ranking-subgrupo-list">
      ${ranking.map((r, i) => `
        <div class="ranking-row${r.id === usuarioActual.id ? " actual" : ""}">
          <span class="pos">#${i+1}</span>
          <span class="nombre">${r.nombre || "Anónimo"}</span>
          <span class="xp">${r.xp} XP</span>
          ${r.id === usuarioActual.id ? "<span class='tuyo'>(Tú)</span>" : ""}
        </div>
      `).join("")}
    </div>
    <div class="posicion-propia">Tu puesto: #${posUsuario} de ${ranking.length}</div>
  `;
}
// Al final del DOMContentLoaded, después de cargar progreso y usuario:
document.addEventListener("DOMContentLoaded", async () => {
  // ...tu código actual...

  // Calcula el totalA (cantidad de "A") como ya lo haces
  let totalA = 0;
  for (const cat in progresoGlobal.categorias) {
    const temas = progresoGlobal.categorias[cat];
    totalA += Object.values(temas).filter(t => t.nota === "A").length;
  }

  mostrarNivelTitulo(totalA);
  await mostrarRankingSubgrupo();
});

function mostrarPanelResumenUsuario(xpTotal, puestoGlobal, puestoParroquia) {
  const cont = document.getElementById("progreso-nivel");
  const nombre = usuarioActual?.user_metadata?.nombre || usuarioActual?.email || "Sin nombre";
  const ultimaFecha = progresoGlobal.historial.length
    ? new Date(progresoGlobal.historial[progresoGlobal.historial.length - 1].fecha).toLocaleDateString()
    : "-";
  const totalA = Object.values(progresoGlobal.categorias || {})
    .flatMap(cat => Object.values(cat).filter(t => t.nota === "A")).length;
  const { nivel, titulo } = obtenerNivelPorA(totalA);

  // Simple animación (fade-in, puedes mejorarla con CSS)
  cont.innerHTML = `
    <div class="panel-mi-progreso fade-in">
      <div><b>👤 Usuario:</b> ${nombre}</div>
      <div><b>📅 Última participación:</b> ${ultimaFecha}</div>
      <div><b>🟡 XP total:</b> <span class="xp-anim">${xpTotal}</span></div>
      <div><b>🌍 Puesto global:</b> #${puestoGlobal}</div>
      <div><b>⛪ Puesto parroquia:</b> ${puestoParroquia}</div>
      <div><b>Nivel:</b> ${nivel} <span class="titulo-nivel">(${titulo})</span></div>
      <div><b>Coleccionables “A”:</b> ${totalA}</div>
      <div class="progreso-cabecera-btns">
        <button onclick="window.location.href='coleccionables-v2.html'">Ver coleccionables</button>
        <button onclick="window.location.href='ranking.html'">Ver mi ranking</button>
      </div>
    </div>
  `;
  // Animación de XP (sube el número suavemente)
  const elXP = cont.querySelector('.xp-anim');
  let xpAnim = 0;
  const step = Math.ceil(xpTotal / 40) || 1;
  const anim = setInterval(() => {
    xpAnim += step;
    if (xpAnim >= xpTotal) {
      elXP.textContent = xpTotal;
      clearInterval(anim);
    } else {
      elXP.textContent = xpAnim;
    }
  }, 18);
}
async function mostrarRankingParroquiaAvanzado() {
  const cont = document.getElementById("progreso-ranking-parroquia");
  cont.innerHTML = "<div>Cargando ranking parroquial...</div>";

  // 1. Traer todos los usuarios y sus XP (rpg_progreso)
  const { data: usuarios, error } = await supabase
    .from("usuarios")
    .select("id, nombre, parroquia_id, parroquia_nombre, subgrupo, rpg_progreso(xp)");

  if (error) {
    cont.innerHTML = "<div>Error al cargar datos de parroquias.</div>";
    return;
  }

  // 2. Calcular XP total y XP promedio por parroquia (solo usuarios activos)
  const parroquias = {};
  usuarios.forEach(u => {
    const xp = (u.rpg_progreso || []).reduce((a, b) => a + (b.xp || 0), 0);
    if (!parroquias[u.parroquia_id]) {
      parroquias[u.parroquia_id] = {
        nombre: u.parroquia_nombre,
        usuarios: [],
        xpTotal: 0,
        activos: 0 // Solo los que tienen xp > 0
      };
    }
    parroquias[u.parroquia_id].usuarios.push({...u, xp});
    parroquias[u.parroquia_id].xpTotal += xp;
    if (xp > 0) parroquias[u.parroquia_id].activos++;
  });

  // Calcula XP promedio SOLO de miembros activos
  Object.values(parroquias).forEach(p => {
    p.xpPromedio = p.activos ? p.xpTotal / p.activos : 0;
  });

  // Arrays ordenados por XP total y XP promedio
  const parroquiasArr = Object.values(parroquias);
  const xpTotalRank = [...parroquiasArr].sort((a, b) => b.xpTotal - a.xpTotal);
  const xpPromRank = [...parroquiasArr].sort((a, b) => b.xpPromedio - a.xpPromedio);

  // Encuentra tu parroquia
  const miParroquiaID = usuarioActual?.user_metadata?.parroquia_id || usuarioActual?.parroquia_id;
  const posTotal = xpTotalRank.findIndex(p => p.usuarios.some(u => u.parroquia_id === miParroquiaID)) + 1;
  const posProm = xpPromRank.findIndex(p => p.usuarios.some(u => u.parroquia_id === miParroquiaID)) + 1;
  const miParroquiaTotal = xpTotalRank[posTotal - 1];
  const miParroquiaProm = xpPromRank[posProm - 1];

  // 3. Subgrupos de tu parroquia (solo miembros activos)
  const usuariosMiParroquia = miParroquiaTotal ? miParroquiaTotal.usuarios.filter(u => u.xp > 0) : [];
  const subgrupos = {};
  usuariosMiParroquia.forEach(u => {
    const nombre = u.subgrupo || "Sin subgrupo";
    if (!subgrupos[nombre]) subgrupos[nombre] = { xpTotal: 0, count: 0 };
    subgrupos[nombre].xpTotal += u.xp;
    subgrupos[nombre].count++;
  });
  // Promedios de subgrupos (solo los que tengan miembros activos)
  const subgruposArr = Object.entries(subgrupos)
    .map(([nombre, sg]) => ({
      nombre,
      xpPromedio: sg.count ? sg.xpTotal / sg.count : 0,
      count: sg.count
    }))
    .sort((a, b) => b.xpPromedio - a.xpPromedio);

  // 4. Render visual avanzado
  cont.innerHTML = `
    <div class="ranking-parroquia-tarjeta">
      <h3>🏆 Parroquia: <b>${miParroquiaTotal?.nombre || "Sin parroquia"}</b></h3>
      <div>
        <b>XP total:</b> <span>${miParroquiaTotal?.xpTotal || 0}</span>
        &nbsp;–&nbsp; Puesto <b>#${posTotal > 0 ? posTotal : '-'}</b> de ${xpTotalRank.length}
      </div>
      <div>
        <b>XP promedio:</b> <span>${miParroquiaProm?.xpPromedio?.toFixed(1) || 0}</span>
        &nbsp;–&nbsp; Puesto <b>#${posProm > 0 ? posProm : '-'}</b> de ${xpPromRank.length}
      </div>
      <div class="ranking-nota">(El promedio y ranking solo consideran miembros activos de cada parroquia)</div>
    </div>
    <div class="subgrupos-ranking">
      <h4>🧑‍🤝‍🧑 Subgrupos de tu parroquia (XP promedio)</h4>
      <ul>
        ${subgruposArr.length
          ? subgruposArr.map((sg, idx) => `
            <li>
              <b>#${idx+1}</b> ${sg.nombre} – 
              <span>${sg.xpPromedio.toFixed(1)} XP</span>
              <small>(${sg.count} miembro${sg.count > 1 ? "s" : ""})</small>
            </li>
          `).join("")
          : "<li>No hay miembros activos en subgrupos.</li>"
        }
      </ul>
    </div>
  `;
}
