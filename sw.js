// --- sw.js (service worker) ---

const CACHE_VERSION = 'v6.10'; // Cambia este número cuando actualices archivos
const CACHE_NAME = `camino-biblico-${CACHE_VERSION}`;
const FILES_TO_CACHE = [
  './index.html',
  './menu.html',
  './quiz.html',
  './coleccionables-v2.html',
  './rpg2.html',
  './temporada.html',
  './mi-progreso.html',
  './login.html',
  './manifest.json',
  './perfil.html',
  './aleatorio-grupal.html',

'./trivia-flash.html',
  // CSS
  './css/estilos.css',
  './css/coleccionables-v2.css',
  './css/menu.css',
  './css/progreso.css',
  './css/quiz.css',
  './css/rpg.css',
  './css/rpg2.css',
  './css/aleatorio-grupal.css',
  './css/temporada.css',
  // JS
  './js/app/aleatorio-grupal.js',
  './js/app/coleccionables-v2.js',
  './js/app/progreso.js',
  './js/app/temporada.js',
  './js/auth.js',
  './js/progreso.js',
  './js/quiz.js',
  './js/rpg2.js',
  './js/app/instalar-pwa.js',
  './supabase.js',
  './js/app/trivia-flash.js',
  './js/app/temporada.js',  
  // Datos JSON
  './datos/coleccionables.json',
  './datos/quiz.json',
  './datos/rpg-preguntas.json',
  './datos/temporadas.json',
  // Sonidos
  './assets/sonidos/inicio.mp3',
  './assets/sonidos/warning.mp3',
  './assets/sonidos/end.mp3',
  './assets/sonidos/click.mp3',
  './assets/sonidos/correcto.mp3',
  './assets/sonidos/incorrecto.mp3',
  // Iconos e imágenes clave
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/favicon.ico',
  './assets/icons/icon-maskable.png',
];

// --- Instalación: cachea los archivos ---
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        for (const url of FILES_TO_CACHE) {
          try {
            await cache.add(url);
          } catch (err) {
            console.error('Error cacheando', url, err);
          }
        }
      })
      .then(() => self.skipWaiting())
  );
});


// --- Activación: elimina cachés viejos ---
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// --- Intercepta las solicitudes (offline-first) ---
self.addEventListener('fetch', (e) => {
  // Solo GET y solo http(s)
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;

  e.respondWith(
    caches.match(e.request)
      .then(response => response || fetch(e.request))
      .catch(() => {
        // Puedes personalizar una página offline aquí si quieres
        if (e.request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

// --- Opción: forzar actualización de service worker ---
// (Puedes hacer que se actualice automáticamente sin recargar el sitio.)
// self.addEventListener('message', (event) => {
//   if (event.data === 'skipWaiting') self.skipWaiting();
// });
