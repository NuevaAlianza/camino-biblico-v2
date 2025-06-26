document.addEventListener('DOMContentLoaded', () => {
  const registroForm = document.getElementById('registro-form');
  const loginForm = document.getElementById('login-form');
  const mensaje = document.getElementById('mensaje');
  const btnLogout = document.getElementById('btn-logout');

  // 🔐 Mostrar botón de logout si hay sesión activa
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      if (btnLogout) btnLogout.style.display = "block";
    }
  });

  // 🔐 Logout (cerrar sesión)
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("❌ Error al cerrar sesión:", error.message);
      } else {
        localStorage.removeItem("progreso"); // Borra si usas sincronización
        window.location.href = "index.html"; // O redirige donde prefieras
      }
    });
  }

  // ✅ Registro de usuario
  if (registroForm) {
    registroForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('reg-email').value;
      const password = document.getElementById('reg-password').value;
      const nombre = document.getElementById('reg-nombre').value;
      const pais = document.getElementById('reg-pais').value;
      const ciudad = document.getElementById('reg-ciudad').value;
      const parroquia = document.getElementById('reg-parroquia').value;

      console.log("Intentando registrar con:", { email, password });

      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        console.error("❌ Error en signUp:", error);
        mensaje.textContent = `Error: ${error.message}`;
        return;
      }

      const user = data.user;
      if (user) {
        const { error: insertError } = await supabase.from('usuarios').insert({
          id: user.id,
          email,
          nombre,
          pais,
          ciudad,
          parroquia
        });

        if (insertError) {
          console.error("❌ Error al insertar en usuarios:", insertError);
          mensaje.textContent = `Error al guardar datos extra: ${insertError.message}`;
          return;
        }

        mensaje.textContent = "Inicio de sesión exitoso.";
await cargarProgresoDesdeNube();

      }
    });
  }

  // ✅ Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      


      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error("❌ Error en login:", error);
        mensaje.textContent = `Error: ${error.message}`;
      } else {
        mensaje.textContent = "Inicio de sesión exitoso.";
        await cargarProgresoDesdeNube();
        // Aquí cargaremos el progreso en el paso 2
      }
    });
  }
});
