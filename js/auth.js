// --- 1. Detección de confirmación de correo (token en hash) ---
if (window.location.hash && window.location.hash.includes('access_token')) {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const token_type = params.get('token_type') || 'bearer';

  if (access_token && refresh_token) {
    // Guarda la sesión y redirige al menú principal
    supabase.auth.setSession({
      access_token,
      refresh_token,
      token_type
    }).then(({ error }) => {
      if (!error) {
        // Borra el hash de la URL para evitar repetir el proceso
        window.location.hash = '';
        // Redirige al menú principal
        window.location.href = "menu.html";
      } else {
        alert("Ocurrió un problema al confirmar tu correo. Intenta iniciar sesión normalmente.");
      }
    });
  }
}

// --- 2. Lógica estándar de registro, login y logout ---
document.addEventListener('DOMContentLoaded', () => {
  const registroForm = document.getElementById('registro-form');
  const loginForm = document.getElementById('login-form');
  const mensaje = document.getElementById('mensaje');
  const btnLogout = document.getElementById('btn-logout');

  // Mostrar botón de logout si hay sesión activa
  supabase.auth.getSession().then(({ data }) => {
    if (data.session && btnLogout) {
      btnLogout.style.display = "block";
    }
  });

  // Logout (cerrar sesión)
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("❌ Error al cerrar sesión:", error.message);
      } else {
        localStorage.removeItem("progreso");
        window.location.href = "index.html";
      }
    });
  }

  // Registro de usuario con metadata en Auth
  if (registroForm) {
    registroForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('reg-email').value;
      const password = document.getElementById('reg-password').value;
      const nombre = document.getElementById('reg-nombre').value;
      const pais = document.getElementById('reg-pais').value;
      const ciudad = document.getElementById('reg-ciudad').value;
      const parroquia = document.getElementById('reg-parroquia').value;

      mensaje.textContent = "Procesando...";

      // Registro usando metadata de Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nombre, pais, ciudad, parroquia }
        }
      });

      if (error) {
        console.error("❌ Error en signUp:", error);
        mensaje.textContent = `Error: ${error.message}`;
        return;
      }

      mensaje.textContent = "Registro exitoso. Revisa tu correo para confirmar tu cuenta.";
      registroForm.reset();
    });
  }

  // Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      mensaje.textContent = "Procesando...";

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error("❌ Error en login:", error);
        mensaje.textContent = `Error: ${error.message}`;
      } else {
        mensaje.textContent = "Inicio de sesión exitoso.";
        window.location.href = "menu.html";
      }
    });
  }
});
