let hallOfFameData = null;

document.addEventListener('DOMContentLoaded', async () => {
  const select = document.getElementById('hall-season-select');
  const info = document.getElementById('hall-season-info');
  const sections = document.getElementById('hall-sections');

  try {
    const response = await fetch("datos/hall_of_fame.json");
    hallOfFameData = await response.json();
  } catch (error) {
    info.innerHTML = "<p>Error al cargar los datos del ranking.</p>";
    return;
  }

  // Rellenar select
  hallOfFameData.temporadas.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.nombre;
    select.appendChild(opt);
  });

  // Mostrar primera temporada
  select.value = hallOfFameData.temporadas[0].id;
  renderSeason(hallOfFameData.temporadas[0]);

  // Cambiar temporada
  select.addEventListener('change', e => {
    const temporada = hallOfFameData.temporadas.find(t => t.id === e.target.value);
    if (temporada) renderSeason(temporada);
  });

  function generarEstrellas(nivel) {
    const max = 6;
    return Array.from({ length: max }, (_, i) => (i < nivel ? '⭐' : '☆')).join('');
  }

  function renderSeason(temporada) {
    info.innerHTML = `
      <div class="season-info">
        <div><b>${temporada.nombre}</b></div>
        <div class="season-dates">${temporada.fecha_inicio} &ndash; ${temporada.fecha_fin}</div>
        <div class="season-desc">${temporada.descripcion || ''}</div>
      </div>
    `;

    let html = '';

    if (temporada.top_xp?.length) {
      html += `
        <section class="hall-section">
          <h2 class="hall-section-title">🏆 Top 10 Jugadores</h2>
          <div class="hall-ranking">
            ${temporada.top_xp.map((p, i) => `
              <div class="ranking-row${i < 3 ? ' top-' + (i + 1) : ''}">
                <span class="ranking-pos">${i + 1}</span>
                <span class="ranking-medal">${['🥇', '🥈', '🥉'][i] || ''}</span>
                <span class="ranking-name">${p.nombre}</span>
                <span class="ranking-xp">${p.xp} XP</span>
                <span class="ranking-group">${p.parroquia || ''}</span>
                <span class="ranking-stars">${generarEstrellas(p.nivel_rango || 0)}</span>
                <span class="ranking-rango">${p.rango || '—'}</span>
                <span class="ranking-porcentaje">(${p.porcentaje || 0}%)</span>
              </div>
            `).join('')}
          </div>
        </section>
      `;
    }

    if (temporada.top_subgrupos?.length) {
      html += `
        <section class="hall-section">
          <h2 class="hall-section-title">👥 Mejores Subgrupos</h2>
          <div class="hall-ranking">
            ${temporada.top_subgrupos.map((g, i) => `
              <div class="ranking-row${i < 3 ? ' top-' + (i + 1) : ''}">
                <span class="ranking-pos">${i + 1}</span>
                <span class="ranking-medal">${['🥇', '🥈', '🥉'][i] || ''}</span>
                <span class="ranking-name">${g.nombre}</span>
                <span class="ranking-xp">${g.xp_promedio} XP</span>
                <span class="ranking-group">${g.participantes} part.</span>
              </div>
            `).join('')}
          </div>
        </section>
      `;
    }

    if (temporada.top_ciudades?.length) {
      html += `
        <section class="hall-section">
          <h2 class="hall-section-title">🏙️ Mejores Ciudades</h2>
          <div class="hall-ranking">
            ${temporada.top_ciudades.map((c, i) => `
              <div class="ranking-row${i < 3 ? ' top-' + (i + 1) : ''}">
                <span class="ranking-pos">${i + 1}</span>
                <span class="ranking-medal">${['🥇', '🥈', '🥉'][i] || ''}</span>
                <span class="ranking-name">${c.ciudad}</span>
                <span class="ranking-xp">${c.xp_promedio} XP</span>
                <span class="ranking-group">${c.participantes} part.</span>
              </div>
            `).join('')}
          </div>
        </section>
      `;
    }

    if (temporada.top_parroquias?.length) {
      html += `
        <section class="hall-section">
          <h2 class="hall-section-title">⛪ Mejores Parroquias</h2>
          <div class="hall-ranking">
            ${temporada.top_parroquias.map((p, i) => `
              <div class="ranking-row${i < 3 ? ' top-' + (i + 1) : ''}">
                <span class="ranking-pos">${i + 1}</span>
                <span class="ranking-medal">${['🥇', '🥈', '🥉'][i] || ''}</span>
                <span class="ranking-name">${p.parroquia}</span>
                <span class="ranking-xp">${p.xp_promedio} XP</span>
                <span class="ranking-group">${p.participantes} part.</span>
              </div>
            `).join('')}
          </div>
        </section>
      `;
    }

    sections.innerHTML = html;
  }
});

