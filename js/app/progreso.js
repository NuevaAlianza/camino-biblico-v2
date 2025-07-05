// --- 0. Variables globales ---
let progresoGlobal = {};
let usuarioActual = null;
let rankingData = { global: null, pais: null, ciudad: null, parroquia: null };

// --- 1. Cargar progreso y datos de usuario ---
document.addEventListener("DOMContentLoaded", async () => {
  // 1.1 Obtener sesión y metadata
  const { data: sessionData } = await supabase.auth.getSession();
  usuarioActual = sessionData?.session?.user;
  const meta = usuarioActual?.user_metadata || {};
  const pais = meta.pais || "N/A";
  const ciudad = meta.ciudad || "N/A";
  const parroquia = meta.parroquia || "N/A";

  // 1.2 Progreso individual
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

  // 1.3 Mostrar módulos visuales
  mostrarResumenGeneral();
  mostrarProgresoCategorias();
  await mostrarRanking({ pais, ciudad, parroquia });
  mostrarHistorialPartidas();
  mostrarLogrosRapidos();
});

// --- 2. Resumen general ---
function mostrarResumenGeneral() {
  const cont = document.getElementById("progreso-resumen");
  const categorias = Object.values(progresoGlobal.categorias || {});
  const temasJugados = categorias.reduce((a, b) => a + Object.keys(b).length, 0);
  // Ajusta el total de temas según tu base de datos
  const totalTemas = 40; // <-- Cambia por tu total real

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

// --- 3. Progreso por categoría ---
function mostrarProgresoCategorias() {
  const cont = document.getElementById("progreso-categorias");
  cont.innerHTML = `<h3>Progreso por categoría</h3>`;
  for (const cat in progresoGlobal.categorias) {
    const temas = progresoGlobal.categorias[cat];
    const total = Object.keys(temas).length;
    const notas = Object.values(temas).map(x => x.nota);
    const notasNum = notas.map(n => n === "A" ? 3 : n === "B" ? 2 : n === "C" ? 1 : 0);
    const notaProm = notasNum.length ? Math.round(notasNum.reduce((a,b)=>a+b,0)/notasNum.length) : 0;
    let letraProm = "-";
    if (notaProm >= 3) letraProm = "A";
    else if (notaProm == 2) letraProm = "B";
    else if (notaProm == 1) letraProm = "C";

    cont.innerHTML += `
      <div class="panel panel-categoria">
        <h4>${cat} (${total})</h4>
        <p>Promedio: <b>${letraProm}</b></p>
        <div class="barra-categoria">
          <div class="barra-progreso" style="width:${(total/10)*100}%"></div>
        </div>
      </div>
    `;
  }
}

// --- 4. Ranking (global, país, ciudad, parroquia) ---
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

  // Busca posición del usuario actual en cada ranking
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

// --- 6. Logros rápidos (ejemplo visual) ---
function mostrarLogrosRapidos() {
  const cont = document.getElementById("progreso-logros");
  cont.innerHTML = `<h3>Logros rápidos</h3>
    <p>Ejemplo: <b>5 temas A</b>, <b>todos los temas en una categoría con A</b>, etc.</p>
    <p>Este módulo puede expandirse mostrando imágenes y más detalles.</p>
  `;
}

