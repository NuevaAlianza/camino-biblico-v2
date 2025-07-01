document.addEventListener('DOMContentLoaded', () => {
  const registroForm = document.getElementById('registro-form');
  const loginForm = document.getElementById('login-form');
  const mensaje = document.getElementById('mensaje');
  const btnLogout = document.getElementById('btn-logout');

  // 🔐 Mostrar botón de logout si hay sesión activa
  supabase.auth.getSession().then(({ data }) => {
    if (data.session && btnLogout) {
      btnLogout.style.display = "block";
    }
  });

  // 🔐 Logout (cerrar sesión)
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

  // ✅ Registro de usuario con metadata en Auth
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

      // Registro usando metadata de Auth (lo mejor)
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
      // Opcional: limpiar el formulario o redirigir
      registroForm.reset();
    });
  }

  // ✅ Login
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
        // Puedes acceder a user_metadata aquí:
        // data.user.user_metadata.nombre, etc.
        window.location.href = "menu.html";
      }
    });
  }
});

