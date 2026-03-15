// auth.js — Camino Bíblico v2
// Maneja: confirmación de correo, login, registro, logout
// NO incluir en menu.html (tiene su propio auth)

function normalizar(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// ── 1. Confirmación de correo por hash ───────────────────────
if (window.location.hash && window.location.hash.includes('access_token')) {
  const params = new URLSearchParams(window.location.hash.substring(1));
  const access_token  = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const token_type    = params.get('token_type') || 'bearer';

  if (access_token && refresh_token) {
    supabase.auth.setSession({ access_token, refresh_token, token_type })
      .then(({ error }) => {
        if (!error) {
          window.location.hash = '';
          localStorage.removeItem("progreso");
          localStorage.removeItem("rpg_progreso");
          window.location.href = "menu.html";
        } else {
          alert("Ocurrió un problema al confirmar tu correo. Intenta iniciar sesión normalmente.");
        }
      });
  }
}

// ── 2. Login, registro y logout ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const registroForm = document.getElementById('registro-form');
  const loginForm    = document.getElementById('login-form');
  const mensaje      = document.getElementById('mensaje');
  const btnLogout    = document.getElementById('btn-logout');

  // Mostrar logout si hay sesión (solo en páginas que tengan el botón)
  if (btnLogout) {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) btnLogout.style.display = "block";
    });

    btnLogout.addEventListener('click', async () => {
      const { error } = await supabase.auth.signOut();
      if (!error) {
        localStorage.removeItem("progreso");
        localStorage.removeItem("rpg_progreso");
        window.location.href = "index.html";
      }
    });
  }

  // Registro
  if (registroForm) {
    registroForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email     = document.getElementById('reg-email').value;
      const password  = document.getElementById('reg-password').value;
      const nombre    = document.getElementById('reg-nombre').value;
      const pais      = normalizar(document.getElementById('reg-pais').value);
      const ciudad    = normalizar(document.getElementById('reg-ciudad').value);
      const parroquia = normalizar(document.getElementById('reg-parroquia').value);

      mensaje.textContent = "Procesando...";
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { nombre, pais, ciudad, parroquia } }
      });

      if (error) {
        mensaje.textContent = `Error: ${error.message}`;
      } else {
        mensaje.textContent = "Registro exitoso. Revisa tu correo para confirmar tu cuenta.";
        registroForm.reset();
      }
    });
  }

  // Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email    = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      mensaje.textContent = "Procesando...";
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        mensaje.textContent = `Error: ${error.message}`;
      } else {
        localStorage.removeItem("progreso");
        localStorage.removeItem("rpg_progreso");
        window.location.href = "menu.html";
      }
    });
  }
});
