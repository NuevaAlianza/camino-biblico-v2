document.addEventListener('DOMContentLoaded', () => {
  const registroForm = document.getElementById('registro-form');
  const loginForm = document.getElementById('login-form');
  const mensaje = document.getElementById('mensaje');
const btnLogout = document.getElementById('btn-logout');

btnLogout.addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("❌ Error al cerrar sesión:", error.message);
  } else {
    localStorage.removeItem("progreso"); // Opcional
    window.location.href = "index.html"; // O página de login
  }
});

  // Registro
  registroForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const nombre = document.getElementById('reg-nombre').value;
    const pais = document.getElementById('reg-pais').value;
    const ciudad = document.getElementById('reg-ciudad').value;
    const parroquia = document.getElementById('reg-parroquia').value;

    console.log("Intentando registrar con:", { email, password });


    // Crear cuenta en Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      mensaje.textContent = `Error: ${error.message}`;
      return;
    }

    const user = data.user;
    if (user) {
      // Insertar datos adicionales en tabla `usuarios`
      const { error: insertError } = await supabase.from('usuarios').insert({
        id: user.id,
        email,
        nombre,
        pais,
        ciudad,
        parroquia
      });

      if (insertError) {
        mensaje.textContent = `Error al guardar datos extra: ${insertError.message}`;
        return;
      }

      mensaje.textContent = "Registro exitoso.";
    }
  });

  // Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      mensaje.textContent = `Error: ${error.message}`;
    } else {
      mensaje.textContent = "Inicio de sesión exitoso.";
      // Redirigir a la app si quieres:
      // window.location.href = "index.html";
    }
  });
});
