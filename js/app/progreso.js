// ====== Helpers & State ======
let usuarioActual = null;
let cacheResumen = null;

const SLIDES = [
  "slide-ranking-global",
  "slide-ranking-parroquia",
  "slide-ranking-subgrupos-parroquia",
  "slide-ranking-subgrupo"
];

const $ = (id) => document.getElementById(id);
const safe = (t) => (t ?? "").toString().replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const fmtFecha = (d) => new Date(d).toLocaleDateString('es-DO');

function setLoading(id, msg="Cargando...") {
  const el = $(id);
  if (el) el.innerHTML = `<div class="loading">${safe(msg)}</div>`;
}

// ====== Data access ======
async function getResumen(userId) {
  if (cacheResumen) return cacheResumen;
  const { data, error } = await supabase
    .from("resumen_ranking")
    .select("*")
    .eq("user_id", userId);
  if (error || !data?.length) throw new Error("No se pudo cargar resumen_ranking");
  cacheResumen = data[0];
  return cacheResumen;
}

// ====== Nivel por “A” (mapeo existente) ======
function nivelPorA(totalA) {
  if (totalA >= 60) return { nivel: 11, titulo: "Campeón Legendario" };
  if (totalA >= 51) return { nivel: 10, titulo: "Maestro" };
  if (totalA >= 41) return { nivel: 9,  titulo: "Discípulo Fiel" };
  if (totalA >= 36) return { nivel: 8,  titulo: "Maestro Joven" };
  if (totalA >= 31) return { nivel: 7,  titulo: "Sabio en Camino" };
  if (totalA >= 26) return { nivel: 6,  titulo: "Perseverante" };
  if (totalA >= 21) return { nivel: 5,  titulo: "Investigador" };
  if (totalA >= 16) return { nivel: 4,  titulo: "Estudioso" };
  if (totalA >= 11) return { nivel: 3,  titulo: "Explorador" };
  if (totalA >= 6)  return { nivel: 2,  titulo: "Aprendiz" };
  if (totalA >= 0)  return { nivel: 1,  titulo: "Principiante" };
  return { nivel: 0, titulo: "Sin nivel" };
}

// ====== UI: Dashboard y Nivel ======
async function mostrarDashboardResumen(userId, resumen) {
  const el = $("progreso-resumen");
  if (!el) return;

  const nombre = resumen?.nombre || usuarioActual?.email || "Sin nombre";
  const avatar = safe(nombre.trim().charAt(0).toUpperCase()) || "👤";
  const temasTotales = resumen?.temas_totales || 60;
  const temasJugados = resumen?.total_partidas_progreso || 0;
  const porcentajeTemas = temasTotales ? Math.round((temasJugados / temasTotales) * 100) : 0;

  el.innerHTML = `
    <div class="dashboard-resumen" style="gap:1.2em;">
      <div class="dashboard-icon">${avatar}</div>
      <div class="dashboard-metrics">
        <h2>${safe(nombre)}</h2>
        <p><b>XP total:</b> ${resumen?.xp_global ?? 0}</p>
        <p><b>Nivel:</b> ${resumen?.nivel || "-"} (${nivelPorA(resumen?.total_a_progreso || 0).titulo})</p>
        <p><b>Nota promedio:</b> ${resumen?.nota_promedio_progreso ?? "-"}</p>
        <p><b>Temas jugados:</b> ${temasJugados} / ${temasTotales}</p>
        <div class="dashboard-bar"><div class="dashboard-bar-inner" style="width:${porcentajeTemas}%;"></div></div>
        <p><b>Última participación:</b> ${resumen?.fecha_ultimo_juego ? fmtFecha(resumen.fecha_ultimo_juego) : "-"}</p>
      </div>
    </div>
  `;
}

async function mostrarNivel(userId, resumen) {
  const el = $("progreso-nivel");
  if (!el) return;

  const totalA = resumen?.total_a_progreso || 0;
  const { nivel, titulo } = nivelPorA(totalA);

  el.innerHTML = `
    <div class="nivel-titulo">
      <span class="nivel-label">Nivel:</span>
      <span class="nivel-num">${nivel}</span>
      <span class="nivel-titulo-nombre">${safe(titulo)}</span>
      <div class="nivel-progreso">Coleccionables A: <b>${totalA}</b> / 60</div>
      ${nivel === 11 ? `<div class="nivel-premio">🏆 ¡Coleccionable especial desbloqueado!</div>` : ""}
    </div>
  `;
}

// ====== Rankings ======

// Top Global (preparado para paginación si la activas)
async function mostrarRankingGlobal(userId, { page = 0, size = 10 } = {}) {
  const el = $("slide-ranking-global");
  if (!el) return;

  const from = page * size;
  const to   = from + size - 1;

  const { data, count, error } = await supabase
    .from("resumen_ranking")
    .select("user_id, nombre, xp_global", { count: 'exact' })
    .order("xp_global", { ascending: false })
    .range(from, to);

  if (error) {
    el.innerHTML = "<p>Error cargando ranking global.</p>";
    return;
  }

  el.innerHTML = `
    <h3>Top Global</h3>
    <div class="ranking-subgrupo-list">
      ${(data || []).map((u, i) => `
        <div class="ranking-row${u.user_id === userId ? " actual" : ""}">
          <span class="pos">#${from + i + 1}</span>
          <span class="nombre">${safe(u.nombre || u.user_id?.slice(0,8))}</span>
          <span class="xp">${u.xp_global ?? 0} XP</span>
          ${u.user_id === userId ? "<span class='tuyo'>(Tú)</span>" : ""}
        </div>
      `).join("")}
    </div>
    ${
      typeof count === 'number' && count > size
        ? `<div class="pager">
             <button ${page<=0?'disabled':''} onclick="cambiarPaginaGlobal(${Math.max(0,page-1)})">Anterior</button>
             <span>Página ${page+1} de ${Math.ceil(count/size)}</span>
             <button ${from+data.length>=count?'disabled':''} onclick="cambiarPaginaGlobal(${page+1})">Siguiente</button>
           </div>`
        : ""
    }
  `;

  // expone paginator si lo usas
  window.cambiarPaginaGlobal = async (p) => {
    setLoading("slide-ranking-global");
    await mostrarRankingGlobal(userId, { page: p, size });
  };
}

// Ranking por parroquia (desde vista agregada)
async function mostrarRankingParroquia() {
  const el = $("slide-ranking-parroquia");
  if (!el) return;

  const { data, error } = await supabase
    .from("v_ranking_parroquias")
    .select("*");

  if (error) {
    el.innerHTML = "<p>Error cargando ranking parroquial.</p>";
    return;
  }

  el.innerHTML = `
    <h3>Ranking parroquial (XP promedio)</h3>
    <div class="ranking-subgrupo-list">
      ${ (data || []).map((p, i) => `
        <div class="ranking-row">
          <span class="pos">#${i + 1}</span>
          <span class="nombre">${safe(p.parroquia_nombre)}</span>
          <span class="xp">${Number(p.xp_promedio).toFixed(1)} XP/prom.</span>
          <span class="miembros">(${p.jugadores} jugador${p.jugadores===1?'':'es'})</span>
        </div>
      `).join("") }
    </div>
  `;
}

// Ranking de subgrupos de TU parroquia (RPC)
async function mostrarRankingSubgruposParroquia(userId, resumen) {
  const el = $("slide-ranking-subgrupos-parroquia");
  if (!el) return;

  const parroquiaId = resumen?.parroquia_id;
  if (!parroquiaId) { el.innerHTML = "<p>No tienes parroquia asignada.</p>"; return; }

  const { data, error } = await supabase
    .rpc("ranking_subgrupos_por_parroquia", { p_parroquia_id: parroquiaId });

  if (error) {
    el.innerHTML = "<p>Error cargando subgrupos de tu parroquia.</p>";
    return;
  }

  const ranking = data || [];
  const miSubgrupo = resumen?.subgrupo;
  const miPos = ranking.findIndex(r => r.subgrupo == miSubgrupo) + 1;

  el.innerHTML = `
    <h3>Subgrupos – ${safe(resumen?.parroquia_nombre || 'Parroquia')}</h3>
    <div class="ranking-subgrupo-list">
      ${ranking.map((sg, i) => `
        <div class="ranking-row${sg.subgrupo == miSubgrupo ? " actual" : ""}">
          <span class="pos">#${i + 1}</span>
          <span class="nombre">Subgrupo ${safe(sg.subgrupo)}</span>
          <span class="xp">${Number(sg.xp_promedio).toFixed(1)} XP/prom.</span>
          <span class="miembros">(${sg.miembros} miembro${sg.miembros===1?'':'s'})</span>
          ${sg.subgrupo == miSubgrupo ? "<span class='tuyo'>(Tuyo)</span>" : ""}
        </div>
      `).join("")}
    </div>
    ${miPos ? `<div class="posicion-propia">Tu subgrupo: #${miPos} de ${ranking.length}</div>` : ""}
  `;
}

// Ranking de tu subgrupo (lista de personas por XP)
async function mostrarRankingSubgrupo(userId, resumen) {
  const el = $("slide-ranking-subgrupo");
  if (!el) return;

  const subgrupoId = resumen?.subgrupo;
  if (!subgrupoId) { el.innerHTML = "<div>No tienes subgrupo asignado.</div>"; return; }

  const { data, error } = await supabase
    .from("resumen_ranking")
    .select("user_id, nombre, xp_global")
    .eq("subgrupo", subgrupoId);

  if (error || !data?.length) { el.innerHTML = "<div>No hay datos de tu subgrupo.</div>"; return; }

  const ranking = data
    .map(u => ({ id: u.user_id, nombre: u.nombre || u.user_id?.slice(0,8), xp: u.xp_global || 0 }))
    .sort((a,b)=> b.xp - a.xp);

  const miPos = ranking.findIndex(r => r.id === userId) + 1;

  el.innerHTML = `
    <h3>Tu subgrupo <span style="color:#2a9d8f;">#${safe(subgrupoId)}</span></h3>
    <div class="ranking-subgrupo-list">
      ${ranking.map((r,i)=>`
        <div class="ranking-row${r.id === userId ? " actual" : ""}">
          <span class="pos">#${i+1}</span>
          <span class="nombre">${safe(r.nombre)}</span>
          <span class="xp">${r.xp} XP</span>
          ${r.id === userId ? "<span class='tuyo'>(Tú)</span>" : ""}
        </div>
      `).join("")}
    </div>
    <div class="posicion-propia">Tu puesto: #${miPos} de ${ranking.length}</div>
  `;
}

// ====== Slider ======
let progresoSlideActual = 0;
function mostrarSlideProgreso(idx) {
  SLIDES.forEach((id, i) => {
    const slide = $(id);
    if (!slide) return;
    slide.classList.toggle("visible", i === idx);
  });
  const bullets = $("progreso-bullets");
  if (bullets) {
    bullets.innerHTML = SLIDES.map((_, i) =>
      `<button type="button" class="${i === idx ? 'active' : ''}" onclick="mostrarSlideProgreso(${i})"></button>`
    ).join("");
  }
  progresoSlideActual = idx;
}
window.mostrarSlideProgreso = mostrarSlideProgreso;

// ====== Boot ======
document.addEventListener("DOMContentLoaded", async () => {
  // Estado inicial (skeletons)
  ["progreso-resumen","progreso-nivel",
   "slide-ranking-global","slide-ranking-parroquia",
   "slide-ranking-subgrupos-parroquia","slide-ranking-subgrupo"].forEach(id => setLoading(id));

  // Sesión
  const { data: sessionData } = await supabase.auth.getSession();
  usuarioActual = sessionData?.session?.user;
  const userId = usuarioActual?.id;
  if (!userId) {
    const box = $("progreso-resumen");
    if (box) box.innerHTML = "<p>Inicia sesión para ver tu progreso.</p>";
    // Ocultamos slides si no hay sesión
    SLIDES.forEach(id => { const el = $(id); if (el) el.style.display = "none"; });
    return;
  }

  try {
    const resumen = await getResumen(userId);

    // Cargar en paralelo
    await Promise.all([
      mostrarDashboardResumen(userId, resumen),
      mostrarNivel(userId, resumen),
      mostrarRankingGlobal(userId),              // Top 10 (paginable)
      mostrarRankingParroquia(),                 // Vista agregada
      mostrarRankingSubgruposParroquia(userId, resumen), // RPC
      mostrarRankingSubgrupo(userId, resumen)    // Lista por tu subgrupo
    ]);

    // Mostrar primer slide
    mostrarSlideProgreso(0);
  } catch (e) {
    console.error(e);
    const box = $("progreso-resumen");
    if (box) box.innerHTML = "<p>Error cargando tu progreso.</p>";
  }
});
