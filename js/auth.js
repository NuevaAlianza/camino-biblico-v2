document.addEventListener('DOMContentLoaded', () => {
  const registroForm = document.getElementById('registro-form');
  const loginForm = document.getElementById('login-form');
  const mensaje = document.getElementById('mensaje');

  registroForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const nombre = document.getElementById('reg-nombre').value;
    const pais = document.getElementById('reg-pais').value;
    const ciudad = document.getElementById('reg-ciudad').value;
    const parroquia = document.getElementById('reg-parroquia').value;

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      mensaje.textContent = `Error: ${error.message}`;
    } else {
      const user = data.user;
      if (user) {
        // Guarda datos adicionales en la tabla `usuarios`
        await supabase.from('usuarios').insert({
          id: user.id,
          nombre,
          pais,
          ciudad,
          parroquia
        });
      }
      mensaje.textContent = "Registro exitoso. Revisa tu correo.";
    }
  });

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
      // Redirigir a la app o mostrar nombre
      // window.location.href = "index.html";
    }
  });
});
