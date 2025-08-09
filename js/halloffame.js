// js/halloffame.js
let hallOfFameData = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const select = document.getElementById('hall-season-select');
  const info = document.getElementById('hall-season-info');
  const sections = document.getElementById('hall-sections');

  info.innerHTML = '<p class="muted">Cargando datos…</p>';

  try {
    const res = await fetch('datos/hall_of_fame.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    hallOfFameData = await res.json();
  } catch (err) {
    console.error(err);
    info.innerHTML = '<p class="error">Error al cargar los datos del ranking.</p>';
    return;
  }

  const temporadas = Array.isArray(hallOfFameData?.temporadas) ? hallOfFameData.temporadas : [];
  if (!temporadas.length) {
    info.innerHTML = '<p class="muted">Aún no hay temporadas para mostrar.</p>';
    return;
  }

  // Rellenar select
  select.replaceChildren();
  const frag = document.createDocumentFragment();
  for (const t of temporadas) {
    const opt = document.createElement('option');
    opt.value = String(t.id ?? '');
    opt.textContent = t?.nombre ?? '(sin nombre)';
    frag.appendChild(opt);
  }
  select.appendChild(frag);

  // Selección inicial: URL ?season / #hash / localStorage / primera
  const urlId = getSeasonFromURL();
  const savedId = localStorage.getItem('hof:season');
  const inicial =
    temporadas.find(t => String(t.id) === urlId) ??
    temporadas.find(t => String(t.id) === savedId) ??
    temporadas[0];

  select.value = String(inicial.id);
  renderSeason(inicial, info, sections);

  // Cambios del usuario
  select.addEventListener('change', e => {
    const val = String(e.target.value);
    localStorage.setItem('hof:season', val);
    updateURLSeason(val);
    const temporada = temporadas.find(t => String(t.id) === val);
    if (temporada) renderSeason(temporada, info, sections);
  });

  // Deep-link (hash o query) reactivo
  window.addEventListener('hashchange', () => {
    const h = getSeasonFromURL();
    if (!h) return;
    const temporada = temporadas.find(t => String(t.id) === h);
    if (temporada) {
      select.value = String(temporada.id);
      localStorage.setItem('hof:season', String(temporada.id));
      renderSeason(temporada, info, sections);
    }
  });
}

/* ---------- Render ---------- */

function renderSeason(temporada, info, sections) {
  // Cabecera
  info.replaceChildren();
  const box = el('div', 'season-info');
  const title = el('div', null, null, true);
  title.innerHTML = `<b>${escapeHtml(temporada?.nombre ?? '(Sin nombre)')}</b>`;
  const dates = el('div', 'season-dates', `${temporada?.fecha_inicio ?? '—'} – ${temporada?.fecha_fin ?? '—'}`);
  const desc = el('div', 'season-desc', temporada?.descripcion ?? '');
  box.append(title, dates, desc);
  info.appendChild(box);

  // Secciones
  sections.replaceChildren();

  // Por si el backend no ordena por XP
  const byXpDesc = (a, b) => (Number(b?.xp ?? b?.xp_promedio ?? 0) - Number(a?.xp ?? a?.xp_promedio ?? 0));

  renderRankingSection({
    container: sections,
    titulo: '🏆 Top 10 Jugadores',
    items: (temporada?.top_xp ?? []).slice().sort(byXpDesc).slice(0, 10),
    mapRow: (p, i) => {
      const li = baseRow(i);
      addSpan(li, 'ranking-name', p?.nombre ?? '—');
      addSpan(li, 'ranking-xp', `${nf().format(Number(p?.xp ?? 0))} XP`);
      addSpan(li, 'ranking-group', p?.parroquia ? String(p.parroquia) : '');
      const { str, aria } = estrellas(Number(p?.nivel_rango ?? 0));
      const st = addSpan(li, 'ranking-stars', str);
      st.setAttribute('aria-label', aria);
      addSpan(li, 'ranking-rango', p?.rango ?? '—');
      const pr = Number(p?.porcentaje);
      addSpan(li, 'ranking-porcentaje', Number.isFinite(pr) ? `(${pf().format(pr / 100)})` : '');
      return li;
    }
  });

  renderRankingSection({
    container: sections,
    titulo: '👥 Mejores Subgrupos',
    items: (temporada?.top_subgrupos ?? []).slice().sort(byXpDesc),
    mapRow: (g, i) => {
      const li = baseRow(i);
      addSpan(li, 'ranking-name', g?.nombre ?? '—');
      addSpan(li, 'ranking-xp', `${nf().format(Number(g?.xp_promedio ?? 0))} XP`);
      addSpan(li, 'ranking-group', `${nf().format(Number(g?.participantes ?? 0))} part.`);
      return li;
    }
  });

  renderRankingSection({
    container: sections,
    titulo: '🏙️ Mejores Ciudades',
    items: (temporada?.top_ciudades ?? []).slice().sort(byXpDesc),
    mapRow: (c, i) => {
      const li = baseRow(i);
      addSpan(li, 'ranking-name', c?.ciudad ?? '—');
      addSpan(li, 'ranking-xp', `${nf().format(Number(c?.xp_promedio ?? 0))} XP`);
      addSpan(li, 'ranking-group', `${nf().format(Number(c?.participantes ?? 0))} part.`);
      return li;
    }
  });

  renderRankingSection({
    container: sections,
    titulo: '⛪ Mejores Parroquias',
    items: (temporada?.top_parroquias ?? []).slice().sort(byXpDesc),
    mapRow: (p, i) => {
      const li = baseRow(i);
      addSpan(li, 'ranking-name', p?.parroquia ?? '—');
      addSpan(li, 'ranking-xp', `${nf().format(Number(p?.xp_promedio ?? 0))} XP`);
      addSpan(li, 'ranking-group', `${nf().format(Number(p?.participantes ?? 0))} part.`);
      return li;
    }
  });
}

/* ---------- Sección / filas ---------- */

function renderRankingSection({ container, titulo, items, mapRow }) {
  if (!Array.isArray(items) || items.length === 0) return;

  const section = el('section', 'hall-section');
  const h2 = el('h2', 'hall-section-title', titulo);
  const list = el('ol', 'hall-ranking'); // ol para semántica/lector de pantalla

  const frag = document.createDocumentFragment();
  items.forEach((item, i) => frag.appendChild(mapRow(item, i)));

  list.appendChild(frag);
  section.append(h2, list);
  container.appendChild(section);
}

function baseRow(i) {
  const li = el('li', `ranking-row${i < 3 ? ' top-' + (i + 1) : ''}`);
  addSpan(li, 'ranking-pos', String(i + 1));

  // Medalla con clase para coincidir con tu CSS
  const medalSpan = addSpan(li, 'ranking-medal', medalEmoji(i));
  if (i === 0) medalSpan.classList.add('gold');
  else if (i === 1) medalSpan.classList.add('silver');
  else if (i === 2) medalSpan.classList.add('bronze');

  return li;
}

function addSpan(parent, cls, text) {
  const s = el('span', cls, text ?? '');
  parent.appendChild(s);
  return s;
}

/* ---------- Utilidades ---------- */

function el(tag, cls, text, raw = false) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) {
    if (raw) n.innerHTML = text;
    else n.textContent = text;
  }
  return n;
}

function medalEmoji(i) {
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return '';
}

function estrellas(nivel = 0, max = 6) {
  const filled = Math.max(0, Math.min(max, Number(nivel) || 0));
  const str = '⭐'.repeat(filled) + '☆'.repeat(max - filled);
  return { str, aria: `${filled} de ${max} estrellas` };
}

function escapeHtml(s) {
  return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function nf() { return new Intl.NumberFormat('es-DO'); }
function pf() { return new Intl.NumberFormat('es-DO', { style: 'percent', maximumFractionDigits: 0 }); }

function getSeasonFromURL() {
  const params = new URLSearchParams(location.search);
  const q = params.get('season');
  const hash = location.hash?.replace(/^#/, '') || null;
  return q || hash || null;
}

function updateURLSeason(id) {
  const url = new URL(location.href);
  url.searchParams.set('season', id);
  url.hash = id;
  history.replaceState(null, '', url);
}
