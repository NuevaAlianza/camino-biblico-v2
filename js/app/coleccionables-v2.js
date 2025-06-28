let coleccionablesData = {};
let temporadasData = [];
let progresoGlobal = null;

// 1. Cargar progreso sincronizado (adaptado para local/cloud)
async function cargarProgresoUsuario() {
  if (window.supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (userId) {
      const { data, error } = await supabase
        .from("progreso")
        .select("progreso")
        .eq("user_id", userId)
        .single();
      if (!error && data?.progreso) {
        progresoGlobal = data.progreso;
        return;
      }
    }
  }
  progresoGlobal = JSON.parse(localStorage.getItem("progreso")) || { categorias: {}, temporadas: {} };
}

// 2. Inicialización principal
(async function init() {
  [coleccionablesData, temporadasData] = await Promise.all([
    fetch('./datos/coleccionables.json').then(res => res.json()),
    fetch('./datos/temporadas.json').then(res => res.json())
  ]);
  await cargarProgresoUsuario();
  mostrarResumenCategorias();
})();

// 3. Mostrar resumen categorías
function mostrarResumenCategorias() {
  // Alternancia de vistas
  document.getElementById("resumen-categorias").classList.remove("oculto");
  document.getElementById("vista-personajes").classList.add("oculto");
  // (Opcional) Si tienes una sección de logros, aquí la puedes mostrar igual

  const resumen = document.getElementById("resumen-categorias");
  resumen.innerHTML = "";

  const progreso = progresoGlobal || { categorias: {}, temporadas: {} };
  const progresoCategorias = progreso.categorias || {};

  for (const categoria in coleccionablesData) {
    if (categoria === "logros") continue;
    const temas = coleccionablesData[categoria];
    const total = Object.keys(temas).length;

    const progresoCategoriaKey = Object.keys(progresoCategorias).find(
      cat => cat.toLowerCase() === categoria.toLowerCase()
    );
    const progresoTemas = progresoCategoriaKey ? progresoCategorias[progresoCategoriaKey] : {};

    const notas = Object.entries(temas)
      .map(([tema]) => {
        const temaProgresoKey = Object.keys(progresoTemas).find(
          t => t.toLowerCase() === tema.toLowerCase()
        );
        const nota = temaProgresoKey ? progresoTemas[temaProgresoKey]?.nota : "";
        return (nota || "").toUpperCase();
      })
      .filter(n => ["A", "B", "C"].includes(n));

    const desbloqueados = notas.length;

    let promedio = "-";
    if (notas.length > 0) {
      const suma = notas.reduce((acc, n) => acc + (n === "A" ? 3 : n === "B" ? 2 : 1), 0);
      const media = Math.round(suma / notas.length);
      promedio = media === 3 ? "A" : media === 2 ? "B" : "C";
    }

    const porcentaje = Math.round((desbloqueados / total) * 100);

    const card = document.createElement("div");
    card.className = "card-categoria";
    card.innerHTML = `
      <h2>${categoria} (${desbloqueados}/${total})</h2>
      <p>Nota promedio: ${promedio}</p>
      <div class="progreso">
        <div class="progreso-barra" style="width: ${porcentaje}%"></div>
      </div>
    `;
    card.addEventListener("click", () => mostrarPersonajes(categoria));
    resumen.appendChild(card);
  }

  // Temporadas
  const card = document.createElement("div");
  card.className = "card-categoria";
  card.innerHTML = `
    <h2>Temporadas</h2>
    <p>Coleccionables especiales por evento</p>
    <div class="progreso"><div class="progreso-barra" style="width:100%"></div></div>
  `;
  card.addEventListener("click", () => mostrarPersonajes("Temporadas"));
  resumen.appendChild(card);

  mostrarResumenLogros(); // Si tienes logros especiales
}

// 4. Mostrar personajes (solo en el área de personajes, nunca en resumen)
function mostrarPersonajes(categoriaActual) {
  const vistaPersonajes = document.getElementById("vista-personajes");
  const resumenCategorias = document.getElementById("resumen-categorias");

  // **SOLO una vista visible**
  resumenCategorias.classList.add("oculto");
  vistaPersonajes.classList.remove("oculto");

  const titulo = document.getElementById("titulo-categoria");
  const contenedor = document.getElementById("personajes-categoria");

  contenedor.classList.remove("fade-in");
  contenedor.classList.add("fade-out");

  setTimeout(() => {
    contenedor.innerHTML = "";
    titulo.textContent = categoriaActual;

    let temas;
    if (categoriaActual === "Temporadas") {
      temas = {};
      const progreso = progresoGlobal || {};
      const progresoTemporadas = progreso.temporadas || {};
      temporadasData.forEach(temp => {
        const nota = progresoTemporadas[temp.id]?.nota || "F";
        temas[temp.coleccionable.nombre] = {
          img_a: temp.coleccionable.imagen_a,
          img_b: temp.coleccionable.imagen_b,
          img_c: temp.coleccionable.imagen_c,
          descripcion: temp.descripcion || "",
          nota: nota
        };
      });
    } else {
      temas = coleccionablesData[categoriaActual] || {};
    }

    const progreso = progresoGlobal || { categorias: {}, temporadas: {} };
    const progresoCategorias = progreso.categorias || {};
    const progresoCategoriaKey = Object.keys(progresoCategorias).find(
      cat => cat.toLowerCase() === categoriaActual.toLowerCase()
    );
    const progresoTemas = categoriaActual === "Temporadas"
      ? progreso.temporadas
      : (progresoCategoriaKey ? progresoCategorias[progresoCategoriaKey] : {});

    for (const tema in temas) {
      const info = temas[tema];
      let nota;
      if (categoriaActual === "Temporadas" || categoriaActual === "Logros") {
        nota = info.nota;
      } else {
        nota = progresoTemas[tema]?.nota || "F";
      }
      let ruta = "assets/img/coleccionables/bloqueado.png";
      if (nota === "A") ruta = info.img_a;
      else if (nota === "B") ruta = info.img_b;
      else if (nota === "C") ruta = info.img_c;

      const card = document.createElement("div");
      card.className = "card-personaje";
      card.innerHTML = `
        <img src="${ruta}" alt="${tema}" />
        <h3>${tema}</h3>
        <p class="nota">Nota: ${nota}</p>
      `;
      card.addEventListener("click", () => {
        if (["A", "B", "C"].includes(nota) && ruta !== "assets/img/coleccionables/bloqueado.png") {
          mostrarModal({ tema, nota, rutaImagen: ruta, descripcion: info.descripcion || "" });
        }
      });
      contenedor.appendChild(card);
    }
    contenedor.classList.remove("fade-out");
    contenedor.classList.add("fade-in");
  }, 150);

  // Permite cambiar de categoría usando la rueda del mouse
  const todas = [...Object.keys(coleccionablesData), "Temporadas"];
  const i = todas.indexOf(categoriaActual);

  vistaPersonajes.onwheel = (e) => {
    if (e.deltaY > 30 && i < todas.length - 1) mostrarPersonajes(todas[i + 1]);
    else if (e.deltaY < -30 && i > 0) mostrarPersonajes(todas[i - 1]);
  };
}

// Botón volver al resumen
document.getElementById("volver-resumen").addEventListener("click", () => {
  document.getElementById("vista-personajes").classList.add("oculto");
  document.getElementById("resumen-categorias").classList.remove("oculto");
});

// Modal
function mostrarModal({ tema, nota, rutaImagen, descripcion = "" }) {
  const modal = document.getElementById("modal-detalle");
  document.getElementById("modal-imagen").src = rutaImagen;
  document.getElementById("modal-nombre").textContent = tema;
  document.getElementById("modal-nota").textContent = `Nota obtenida: ${nota}`;
  document.getElementById("modal-info").textContent = descripcion;

  const btn = document.getElementById("descargar-img");
  if (nota === "A") {
    btn.style.display = "inline-block";
    btn.href = rutaImagen;
  } else {
    btn.style.display = "none";
  }

  modal.classList.remove("oculto");
  modal.classList.add("activo");
  document.onkeydown = (ev) => { if (ev.key === "Escape") cerrarModal(); };
}
function cerrarModal() {
  const modal = document.getElementById("modal-detalle");
  modal.classList.add("oculto");
  modal.classList.remove("activo");
  document.onkeydown = null;
}
document.getElementById("cerrar-modal").addEventListener("click", cerrarModal);
document.getElementById("modal-detalle").addEventListener("click", (e) => {
  if (e.target.id === "modal-detalle") cerrarModal();
});

// (Puedes dejar la función de logros si la usas igual, pero el punto clave es la alternancia de vistas)
function mostrarResumenLogros() {
  // ... (tu código de logros, si aplica)
}


