function normalizar(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}


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
        // Limpia progreso local antes de entrar
        localStorage.removeItem("progreso");
        localStorage.removeItem("rpg_progreso");
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
        localStorage.removeItem("rpg_progreso");
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
    // --- normaliza todo lo que se compara en ranking y XP ---
    const pais = normalizar(document.getElementById('reg-pais').value);
    const ciudad = normalizar(document.getElementById('reg-ciudad').value);
    const parroquia = normalizar(document.getElementById('reg-parroquia').value);

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
        // Limpia progreso local al iniciar sesión antes de cargar datos del usuario
        localStorage.removeItem("progreso");
        localStorage.removeItem("rpg_progreso");
        mensaje.textContent = "Inicio de sesión exitoso.";
        window.location.href = "menu.html";
      }
    });
  }
});

// --- 3. Lógica para el Duelo de Fe (Reto VS) ---

async function prepararRetoDiario() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert("Debes iniciar sesión para participar en el Duelo.");
            return;
        }

        const userId = session.user.id;
        const hoy = new Date().toISOString().split('T')[0];

        // Verificar si el usuario ya jugó hoy
        const { data: yaJugado } = await supabase
            .from('resultados_retos')
            .select('id')
            .eq('user_id', userId)
            .eq('fecha_reto', hoy)
            .maybeSingle();

        if (yaJugado) {
            alert("Ya has completado el reto de hoy. ¡Mira el ranking para ver tu posición!");
            window.location.href = 'reto-vs.html?ver_ranking=true';
            return;
        }

        // Cargar 5 preguntas (puedes añadir filtros por dificultad o categoría aquí)
        const { data: preguntas, error } = await supabase
            .from('preguntas')
            .select('*')
            .limit(5);

        if (error || !preguntas) throw error;

        // Guardar preguntas en localStorage para la siguiente pantalla
        localStorage.setItem('preguntas_duelo_activa', JSON.stringify(preguntas));
        window.location.href = 'reto-vs.html';

    } catch (err) {
        console.error("Error al preparar el reto:", err);
        alert("Hubo un error al conectar con el servidor de retos.");
    }
}

// Escuchar el clic del botón en el menú (asegúrate de que el botón tenga la clase o ID correcto)
document.addEventListener('click', (e) => {
    if (e.target.closest('.rpg') || e.target.id === 'btn-duelo') {
        prepararRetoDiario();
    }
});
