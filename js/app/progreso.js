// --- 0. Variables globales ---
let progresoGlobal = {};
let usuarioActual = null;
let rankingData = { global: null, pais: null, ciudad: null, parroquia: null };
let coleccionablesData = {}; // <-- NUEVO: coleccionables se cargan antes

// --- 1. Cargar coleccionables y progreso ---
document.addEventListener("DOMContentLoaded", async () => {
  // 1.1 Cargar coleccionables.json primero
  await fetch('./datos/coleccionables.json')
    .then(res => res.json())
    .then(data => { coleccionablesData = data; });

  // 1.2 Obtener sesión y metadata
  const { data: sessionData } = await supabase.auth.getSession();
  usuarioActual = sessionData?.session?.user;
  const meta = usuarioActual?.user_metadata || {};
  const pais = meta.pais || "N/A";
  const ciudad = meta.ciudad || "N/A";
  const parroquia = meta.parroquia || "N/A";

  // 1.3 Progreso individual
  const { data: progresoRows } = await supabase
    .from("progreso")
    .select("*")
    .eq("user_id", usuarioActual.id);

  // Procesar progreso a objeto (por categoría/tema)
  progresoGlobal = { categorias: {}, historial: [] };
  progresoRows.forEach(row => {
    // Solo tipo quiz comentado o temporada
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

  // 1.4 Mostrar módulos visuales
  mostrarResumenGeneral();
  mostrarProgresoCategorias();
  await mostrarRanking({ pais, ciudad, parroquia });
  mostrarHistorialPartidas();
  mostrarLogrosRapidos();
});

// --- Utilidad para contar total de temas dinámicamente ---
function contarTemasColeccionables(coleccionablesData) {
  let total = 0;
  for (const categoria in coleccionablesData) {
    if (categoria.toLowerCase() === "logros") continue; // omitir logros
    total += Object.keys(coleccionablesData[categoria]).length;
  }
  return total;
}

// --- Utilidad: total por categoría (dinámico) ---
function contarTemasPorCategoria(coleccionablesData, categoria) {
  if (!coleccionablesData[categoria]) return 0;
  return Object.keys(coleccionablesData[categoria]).length;
}

// --- 2. Resumen general ---
function mostrarResumenGeneral() {
  const cont = document.getElementById("progreso-resumen");
  const categorias = Object.values(progresoGlobal.categorias || {});
  const temasJugados = categorias.reduce((a, b) => a + Object.keys(b).length, 0);

  const totalTemas = contarTemasColeccionables(coleccionablesData);

  // Nota promedio
  const notas = categorias.flatMap(cat => Object.values(cat).map(x => (x.nota || "").toUpperCase()));
  const notasNum = notas.map(n => n === "A" ? 3 : n === "B" ? 2 : n === "C" ? 1 : 0);
  const notaProm = notasNum.length ? (notasNum.reduce((a, b) => a + b, 0) / notasNum.length) : 0;
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
        <div class="barra-progreso" style="width:${(temasJugados / totalTemas) * 100}%"></div>
      </div>
    </div>
  `;
}

// --- 3. Progreso por categoría (ahora DINÁMICO) ---
function mostrarProgresoCategorias() {
  const cont = document.getElementById("progreso-categorias");
  cont.innerHTML = `<h3>Progreso por categoría</h3>`;

  // Recorremos las categorías de coleccionables (no solo las jugadas)
  for (const categoria in coleccionablesData) {
    if (categoria.toLowerCase() === "logros") continue;
    const temasColeccionable = coleccionablesData[categoria];
    const total = Object.keys(temasColeccionable).length;

    // Progreso del usuario en esta categoría
    const temasUsuario = (progresoGlobal.categorias[categoria] || {});
    const jugados = Object.keys(temasUsuario).length;
    const notas = Object.values(temasUsuario).map(x => x.nota);
    const notasNum = notas.map(n => n === "A" ? 3 : n === "B" ? 2 : n === "C" ? 1 : 0);
    const notaProm = notasNum.length ? Math.round(notasNum.reduce((a, b) => a + b, 0) / notasNum.length) : 0;
    let letraProm = "-";
    if (notaProm >= 3) letraProm = "A";
    else if (notaProm == 2) letraProm = "B";
    else if (notaProm == 1) letraProm = "C";

    cont.innerHTML += `
      <div class="panel panel-categoria">
        <h4>${categoria} (${jugados}/${total})</h4>
        <p>Promedio: <b>${letraProm}</b></p>
        <div class="barra-categoria">
          <div class="barra-progreso" style="width:${(jugados / total) * 100}%"></div>
        </div>
      </div>
    `;
  }
}

// --- 4. Ranking (global, país, ciudad, parroquia) ---
// (Sin cambios, solo asegúrate de llamarlo después de cargar todo)

// --- 5. Historial de partidas ---
// (Sin cambios)

// --- 6. Logros rápidos ---
// (Sin cambios)
