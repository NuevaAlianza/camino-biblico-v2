// Simulación: Aquí cargarías desde fetch("datos/hall_of_fame.json"), por ahora va el objeto directo
const hallOfFameData = {
  "temporadas": [
    {
      "id": "T1",
      "nombre": "Temporada 1 – Génesis",
      "fecha_inicio": "2025-07-01",
      "fecha_fin": "2025-09-30",
      "descripcion": "Inicio del Hall of Fame. Primeros rankings de Camino Bíblico.",
      "top_xp": [
        {"user_id": "u001", "nombre": "Lucía Pérez", "xp": 2450, "pais": "RD", "ciudad": "Santiago", "parroquia": "San Pablo"},
        {"user_id": "u002", "nombre": "Juan Torres", "xp": 2320, "pais": "RD", "ciudad": "La Vega", "parroquia": "Cristo Rey"},
        // ... más jugadores
      ],
      "top_subgrupos": [
        {"subgrupo_id": 1, "nombre": "Jóvenes San Pablo", "xp_promedio": 1530, "participantes": 18, "ciudad": "Santiago", "parroquia": "San Pablo"},
        // ...
      ],
      "top_ciudades": [
        {"ciudad": "Santiago", "xp_promedio": 1435, "participantes": 44},
        // ...
      ],
      "top_parroquias": [
        {"parroquia": "San Pablo", "xp_promedio": 1478, "participantes": 29, "ciudad": "Santiago"},
        // ...
      ]
    }
    // ...más temporadas
  ]
};

// --- Render dinámico ---

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('hall-season-select');
  const info = document.getElementById('hall-season-info');
  const sections = document.getElementById('hall-sections');

  // 1. Rellenar el select de temporadas
  hallOfFameData.temporadas.forEach((t, i) => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.nombre;
    select.appendChild(opt);
  });

  // 2. Mostrar la temporada seleccionada al cargar
  select.value = hallOfFameData.temporadas[0].id;
  renderSeason(hallOfFameData.temporadas[0]);

  // 3. Al cambiar temporada, renderizar
  select.addEventListener('change', e => {
    const temporada = hallOfFameData.temporadas.find(t => t.id === e.target.value);
    if (temporada) renderSeason(temporada);
  });

  // --- Render principal ---
  function renderSeason(temporada) {
    // Info de la temporada (fechas, descripción)
    info.innerHTML = `
      <div class="season-info">
        <div><b>${temporada.nombre}</b></div>
        <div class="season-dates">${temporada.fecha_inicio} &ndash; ${temporada.fecha_fin}</div>
        <div class="season-desc">${temporada.descripcion || ''}</div>
      </div>
    `;

    // Secciones de ranking
    let html = '';
    // Top 10 jugadores
    if (temporada.top_xp) {
      html += `
        <section class="hall-section">
          <h2 class="hall-section-title">🏆 Top 10 Jugadores</h2>
          <div class="hall-ranking">
            ${temporada.top_xp.map((p, i) => `
              <div class="ranking-row${i === 0 ? ' top-1' : i === 1 ? ' top-2' : i === 2 ? ' top-3' : ''}">
                <span class="ranking-pos">${i + 1}</span>
                <span class="ranking-medal">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''}</span>
                <span class="ranking-name">${p.nombre}</span>
                <span class="ranking-xp">${p.xp} XP</span>
                <span class="ranking-group">${p.parroquia}</span>
              </div>
            `).join('')}
          </div>
        </section>
      `;
    }
    // Mejores subgrupos
    if (temporada.top_subgrupos) {
      html += `
        <section class="hall-section">
          <h2 class="hall-section-title">👥 Mejores Subgrupos</h2>
          <div class="hall-ranking">
            ${temporada.top_subgrupos.map((g, i) => `
              <div class="ranking-row${i === 0 ? ' top-1' : i === 1 ? ' top-2' : i === 2 ? ' top-3' : ''}">
                <span class="ranking-pos">${i + 1}</span>
                <span class="ranking-medal">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''}</span>
                <span class="ranking-name">${g.nombre}</span>
                <span class="ranking-xp">${g.xp_promedio} XP</span>
                <span class="ranking-group">${g.participantes} part.</span>
              </div>
            `).join('')}
          </div>
        </section>
      `;
    }
    // Mejores ciudades
    if (temporada.top_ciudades) {
      html += `
        <section class="hall-section">
          <h2 class="hall-section-title">🏙️ Mejores Ciudades</h2>
          <div class="hall-ranking">
            ${temporada.top_ciudades.map((c, i) => `
              <div class="ranking-row${i === 0 ? ' top-1' : i === 1 ? ' top-2' : i === 2 ? ' top-3' : ''}">
                <span class="ranking-pos">${i + 1}</span>
                <span class="ranking-medal">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''}</span>
                <span class="ranking-name">${c.ciudad}</span>
                <span class="ranking-xp">${c.xp_promedio} XP</span>
                <span class="ranking-group">${c.participantes} part.</span>
              </div>
            `).join('')}
          </div>
        </section>
      `;
    }
    // Mejores parroquias
    if (temporada.top_parroquias) {
      html += `
        <section class="hall-section">
          <h2 class="hall-section-title">⛪ Mejores Parroquias</h2>
          <div class="hall-ranking">
            ${temporada.top_parroquias.map((p, i) => `
              <div class="ranking-row${i === 0 ? ' top-1' : i === 1 ? ' top-2' : i === 2 ? ' top-3' : ''}">
                <span class="ranking-pos">${i + 1}</span>
                <span class="ranking-medal">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''}</span>
                <span class="ranking-name">${p.parroquia}</span>
                <span class="ranking-xp">${p.xp_promedio} XP</span>
                <span class="ranking-group">${p.ciudad}</span>
              </div>
            `).join('')}
          </div>
        </section>
      `;
    }
    sections.innerHTML = html;
  }
});
