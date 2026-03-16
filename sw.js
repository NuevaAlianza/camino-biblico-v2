// =============================================================
// sw.js — Camino Bíblico v2 · Service Worker
// Actualizado: archivos unificados (quiz, wordle, junior)
// =============================================================

const CACHE_VERSION = 'v10.4';
const CACHE_NAME    = `camino-biblico-${CACHE_VERSION}`;

const FILES_TO_CACHE = [
  // ── Páginas HTML ──────────────────────────────────────────
  './index.html',
  './login.html',
  './menu.html',
  './quiz.html',          // reemplaza: rpg.html, rpg2.html, trivia-flash.html,
                          //            reto-vs.html, temporada.html, aleatorio.html
  './wordle.html',
  './junior.html',        // nuevo
  './mi-progreso.html',
  './perfil.html',
  './ranking.html',
  './hall_of_fame.html',
  './coleccionables-v2.html',
  './manifest.json',

  // ── CSS ───────────────────────────────────────────────────
  './css/quiz.css',       // unificado (arena + mundos)
  './css/wordle.css',
  './css/junior.css',     // nuevo
  './css/menu.css',
  './css/progreso.css',
  './css/hof.css',
  './css/ranking.css',
  './css/coleccionables-v2.css',

  // ── JavaScript ────────────────────────────────────────────
  './js/quiz.js',
  './js/wordle.js',
  './js/junior.js',       // nuevo
  './js/auth.js',
  './js/progreso.js',
  './js/halloffame.js',
  './js/app/progreso.js',
  './js/app/ranking.js',
  './js/app/coleccionables-v2.js',
  './js/app/instalar-pwa.js',
  './supabase.js',

  // ── Datos JSON ────────────────────────────────────────────
  './datos/wordle-semanas.json',   // banco anual de palabras
  './datos/coleccionables.json',
  './datos/temporadas.json',
  // NOTA: quiz.json y rpg-preguntas.json ya no se usan
  //       (preguntas vienen de Supabase por nivel)

  // ── Sonidos ───────────────────────────────────────────────
  './assets/sonidos/click.mp3',
  './assets/sonidos/correcto.mp3',
  './assets/sonidos/incorrecto.mp3',
  './assets/sonidos/go.mp3',
  './assets/sonidos/start.mp3',
  './assets/sonidos/inicio.mp3',
  './assets/sonidos/end.mp3',
  './assets/sonidos/warning.mp3',
  './assets/sonidos/halfway.mp3',
  './assets/sonidos/nota_a.mp3',
  './assets/sonidos/nota_b.mp3',
  './assets/sonidos/nota_c.mp3',
  './assets/sonidos/resultado_alto.mp3',
  './assets/sonidos/resultado_medio.mp3',
  './assets/sonidos/resultado_bajo.mp3',
  './assets/sonidos/wrong1.mp3',
  './assets/sonidos/wrong2.mp3',
  './assets/sonidos/wrong3.mp3',
  './assets/sonidos/wrong4.mp3',
  // background.mp3 y background2.mp3 se excluyen del precaché
  // (son pesados y se cargan bajo demanda)

  // ── Iconos PWA ────────────────────────────────────────────
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-192-maskable.png',
  './assets/icons/icon-512-maskable.png',
  './assets/icons/favicon.ico',
  './assets/icons/favicon.png',
];

// ─── Instalación ─────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const url of FILES_TO_CACHE) {
        try {
          await cache.add(url);
        } catch (err) {
          // No bloquear la instalación si un archivo falla
          console.warn('[SW] No se pudo cachear:', url);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// ─── Activación: eliminar cachés viejos ──────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k  => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch: estrategia según tipo de recurso ─────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  const url = new URL(e.request.url);

  // Supabase y CDN → siempre red, sin cachear
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('cdn.jsdelivr.net')
  ) {
    return;
  }

  // favicon.ico en raíz del dominio → ignorar (GitHub Pages no lo sirve ahí)
  if (url.pathname === '/favicon.ico') {
    e.respondWith(new Response(null, { status: 204 }));
    return;
  }

  // wordle-semanas.json → network-first (se actualiza con frecuencia)
  if (url.pathname.includes('wordle-semanas.json')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Todo lo demás → cache-first con fallback a red
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Solo cachear respuestas completas (status 200)
        // Las respuestas 206 (partial/range) no se pueden cachear
        if (
          res.ok &&
          res.status === 200 &&
          url.origin === self.location.origin
        ) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      });
    }).catch(() => {
      if (e.request.destination === 'document') {
        return caches.match('./index.html');
      }
    })
  );
});

// ─── Mensaje para forzar actualización desde la app ──────────
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
