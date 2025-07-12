let usuarioActual = null;
let usuarioMeta = {};

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Obtener sesión y metadata del usuario
  const { data: sessionData } = await supabase.auth.getSession();
  usuarioActual = sessionData?.session?.user;
  usuarioMeta = usuarioActual?.user_metadata || {};

  // 2. Asigna eventos a las pestañas
  document.getElementById("btn-ranking-global").onclick = () => cargarRanking("global");
  document.getElementById("btn-ranking-ciudad").onclick = () => cargarRanking("ciudad");
  document.getElementById("btn-ranking-parroquia").onclick = () => cargarRanking("parroquia");

  // 3. Por defecto muestra el global
  cargarRanking("global");
});

// --- Lógica para cargar el ranking según el filtro ---
async function cargarRanking(tipo) {
  // Visual: activa/desactiva tabs
  document.querySelectorAll(".ranking-tabs button").forEach(btn => btn.classList.remove("tab-active"));
  document.getElementById("btn-ranking-" + tipo).classList.add("tab-active");

  // 1. Query a Supabase según tipo
  let filtro = {};
  if (tipo === "ciudad" && usuarioMeta.ciudad) filtro.ciudad = usuarioMeta.ciudad;
  if (tipo === "parroquia" && usuarioMeta.parroquia) filtro.parroquia = usuarioMeta.parroquia;

  // 2. Carga XP RPG + XP Trivia Flash por usuario
  // 2.1 RPG progreso
  const { data: rpgRows } = await supabase
    .from("rpg_progreso")
    .select("user_id, xp, pais, ciudad, parroquia")
    .eq("completado", true);

  // 2.2 Trivia flash
  const { data: flashRows } = await supabase
    .from("trivia_flash")
    .select("user_id, xp_obtenido");

  // 2.3 Suma XP total por usuario, filtrando por ciudad/parroquia si aplica
  const xpPorUsuario = {};

  (rpgRows || []).forEach(row => {
    // Filtrado según pestaña
    if (filtro.ciudad && row.ciudad !== filtro.ciudad) return;
    if (filtro.parroquia && row.parroquia !== filtro.parroquia) return;
    if (!xpPorUsuario[row.user_id]) xpPorUsuario[row.user_id] = 0;
    xpPorUsuario[row.user_id] += row.xp || 0;
  });

  (flashRows || []).forEach(row => {
    // Nota: Trivia flash no tiene ciudad/parroquia, pero el usuario sí
    if (filtro.ciudad || filtro.parroquia) {
      // No sumes flash si el usuario no está en rpgRows del filtro actual
      const tieneRPG = (rpgRows || []).find(r =>
        r.user_id === row.user_id &&
        (!filtro.ciudad || r.ciudad === filtro.ciudad) &&
        (!filtro.parroquia || r.parroquia === filtro.parroquia)
      );
      if (!tieneRPG) return;
    }
    if (!xpPorUsuario[row.user_id]) xpPorUsuario[row.user_id] = 0;
    xpPorUsuario[row.user_id] += row.xp_obtenido || 0;
  });

  // 3. Consulta nombres de usuario para mostrar
  const userIds = Object.keys(xpPorUsuario);
  let nombresPorId = {};
  if (userIds.length) {
    const { data: usuariosRows } = await supabase
      .from("usuarios")
      .select("id, nombre")
      .in("id", userIds);
    (usuariosRows || []).forEach(u => {
      nombresPorId[u.id] = u.nombre || "Sin nombre";
    });
  }

  // 4. Ordena y muestra el ranking
  const ranking = userIds
    .map(id => ({ id, xp: xpPorUsuario[id], nombre: nombresPorId[id] || "Sin nombre" }))
    .sort((a, b) => b.xp - a.xp);

  // Busca posición del usuario actual
  const miPos = ranking.findIndex(r => r.id === usuarioActual.id) + 1;

  // Render visual
  const panel = document.getElementById("ranking-panel");
  panel.innerHTML = `
    <table class="tabla-ranking">
      <thead>
        <tr>
          <th>Puesto</th>
          <th>Nombre</th>
          <th>XP</th>
        </tr>
      </thead>
      <tbody>
        ${ranking.map((r, i) => `
          <tr class="${r.id === usuarioActual.id ? "es-actual" : ""}">
            <td>#${i+1}</td>
            <td>${r.nombre}</td>
            <td>${r.xp}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="mi-ranking-resumen">
      <b>Tu puesto:</b> #${miPos || "-"}<br>
      <b>Tu XP total:</b> ${ranking.find(r => r.id === usuarioActual.id)?.xp || 0}
    </div>
  `;
}
