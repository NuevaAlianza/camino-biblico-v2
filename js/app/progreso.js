// --- Variables globales ---
let coleccionablesData = {};
let progresoGlobal = {};
let usuarioActual = null;

// --- Inicialización ---
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Cargar coleccionables para saber el total por categoría
  coleccionablesData = await fetch('./datos/coleccionables.json').then(res => res.json());

  // 2. Obtener sesión de usuario y metadatos
  const { data: sessionData } = await supabase.auth.getSession();
  usuarioActual = sessionData?.session?.user;
  const meta = usuarioActual?.user_metadata || {};
  const pais = meta.pais || "N/A";
  const ciudad = meta.ciudad || "N/A";
  const parroquia = meta.parroquia || "N/A";

  // 3. Progreso individual desde Supabase
  const { data: progresoRows } = await supabase
    .from("progreso")
    .select("*")
    .eq("user_id", usuarioActual.id);

  // 4. Procesar progreso individual
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
    // Guardar historial
    progresoGlobal.historial.push(row);
  });

  // 5. Mostrar módulos visuales
  mostrarResumenGeneral();
  mostrarProgresoCategoriasCompacto();
  await mostrarRanking({ pais, ciudad, parroquia });
  mostrarHistorialPartidas();
  mostrarLogrosRapidos();
});

// --- 1. Resumen general ---
function mostrarResumenGeneral() {
  const cont = document.getElementById("progreso-resumen");
  // Total dinámico
  let totalTemas = 0;
  for (const categoria in coleccionablesData) {
    if (categoria.toLowerCase() === "logros") continue;
    totalTemas += Object.keys(coleccionablesData[categoria]).length;
  }
  const categorias = Object.values(progresoGlobal.categorias || {});
  const temasJugados = categorias.reduce((a, b) => a + Object.keys(b).length, 0);

  // Nota promedio
  const notas = categorias.flatMap(cat => Object.values(cat).map(x => (x.nota || "").toUpperCase()));
  const notasNum = notas.map(n => n === "A" ? 3 : n === "B" ? 2 : n === "C" ? 1 : 0);
  const notaProm = notasNum.length ? (notasNum.reduce((a,b)=>a+b,0) / notasNum.length) : 0;
  let letraProm = "-";
  if (notaProm >= 2.5) letraProm = "A";
  else if (notaProm >= 1.5) letraProm = "B";
  else if (notaProm > 0) letraProm = "C";

  cont.innerHTML = `
    <div class="panel panel-resumen">
      <h2>Resumen general</h2>
      <p><b>${temasJugados}</b> de <b>${totalTemas}</b> temas jugados</p>
      <p>Nota promedio: <b>${letraProm}</b></p>
      <div class="barra-general">
        <div class="barra-progreso" style="width:${(temasJugados/totalTemas)*100}%"></div>
      </div>
    </div>
  `;
}

// --- 2. Progreso por categoría (estilo barra compacta) ---
function mostrarProgresoCategoriasCompacto() {
  const cont = document.getElementById("progreso-categorias");
  cont.innerHTML = `<h3>Progreso por categoría</h3>`;

  // Ordenar alfabéticamente
  const categorias = Object.keys(coleccionablesData)
    .filter(c => c.toLowerCase() !== "logros")
    .sort();

  categorias.forEach(categoria => {
    const temasTotal = Object.keys(coleccionablesData[categoria]).length;
    const temasUsuario = progresoGlobal.categorias[categoria] || {};
    const jugados = Object.keys(temasUsuario).length;

    // Nota promedio
    const notas = Object.values(temasUsuario).map(x => x.nota);
    const notasNum = notas.map(n => n === "A" ? 3 : n === "B" ? 2 : n === "C" ? 1 : 0);
    const notaProm = notasNum.length ? (notasNum.reduce((a, b) => a + b, 0) / notasNum.length) : 0;
    let letraProm = "-";
    if (notaProm >= 2.5) letraProm = "A";
    else if (notaProm >= 1.5) letraProm = "B";
    else if (notaProm > 0) letraProm = "C";

    // Barra visual
    const porcentaje = Math.round((jugados / temasTotal) * 100);

    cont.innerHTML += `
      <div class="progreso-row">
        <span class="cat-nombre">${categoria.padEnd(12, " ")}</span>
        <span class="barra-externa"><span class="barra-interna" style="width:${porcentaje}%;"></span></span>
        <span class="cat-info">${jugados}/${temasTotal} <b>${letraProm}</b></span>
      </div>
    `;
  });
}

// --- 3. Ranking (global, país, ciudad, parroquia) ---
async function mostrarRanking({ pais, ciudad, parroquia }) {
  const cont = document.getElementById("progreso-ranking");
  cont.innerHTML = `<h3>Tu Ranking</h3><div id="rankings"></div>`;

  // Consultar ranking global
  const queryRanking = async (campo, valor) => {
    let q = supabase
      .from("rpg_progreso")
      .select("user_id, xp, nivel_max, rango, fecha_juego, usuario:usuario_id!inner(nombre, pais, ciudad, parroquia)")
      .eq("completado", true);
    if (campo && valor) q = q.eq(campo, valor);
    q = q.order("xp", { ascending: false });
    return (await q).data || [];
  };

  // Ranking global
  const global = await queryRanking();
  // Ranking por país
  const porPais = pais !== "N/A" ? await queryRanking("usuario.pais", pais) : [];
  // Ranking por ciudad
  const porCiudad = ciudad !== "N/A" ? await queryRanking("usuario.ciudad", ciudad) : [];
  // Ranking por parroquia
  const porParroquia = parroquia !== "N/A" ? await queryRanking("usuario.parroquia", parroquia) : [];

  // Posiciones
  const posGlobal = global.findIndex(r => r.user_id === usuarioActual.id) + 1;
  const posPais = porPais.findIndex(r => r.user_id === usuarioActual.id) + 1;
  const posCiudad = porCiudad.findIndex(r => r.user_id === usuarioActual.id) + 1;
  const posParroquia = porParroquia.findIndex(r => r.user_id === usuarioActual.id) + 1;

  document.getElementById("rankings").innerHTML = `
    <div class="ranking-panel">
      <p>🌎 Global: <b>#${posGlobal || '-'}</b> de ${global.length}</p>
      <p>🇩🇴 País: <b>#${posPais || '-'}</b> de ${porPais.length} (${pais})</p>
      <p>🏙️ Ciudad: <b>#${posCiudad || '-'}</b> de ${porCiudad.length} (${ciudad})</p>
      <p>⛪ Parroquia: <b>#${posParroquia || '-'}</b> de ${porParroquia.length} (${parroquia})</p>
    </div>
  `;
}

// --- 4. Historial de partidas ---
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

// --- 5. Logros rápidos (ejemplo visual, expandible) ---
function mostrarLogrosRapidos() {
  const cont = document.getElementById("progreso-logros");
  cont.innerHTML = `<h3>Logros rápidos</h3>
    <p>Ejemplo: <b>5 temas A</b>, <b>todos los temas en una categoría con A</b>, etc.</p>
    <p>Este módulo puede expandirse mostrando imágenes y más detalles.</p>
  `;
}
