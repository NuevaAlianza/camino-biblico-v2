let coleccionablesData = {};
let temporadasData = [];
let progresoGlobal = null;

// ---- 1. Carga inicial de datos ----
Promise.all([
  fetch('./datos/coleccionables.json').then(res => res.json()),
  fetch('./datos/temporadas.json').then(res => res.json())
]).then(([coleccionables, temporadas]) => {
  coleccionablesData = coleccionables;
  temporadasData = temporadas;
  cargarProgresoUsuario().then(() => {
    mostrarResumenCategorias();
  });
});

// ---- 2. Cargar progreso desde Supabase para usuario activo ----
async function cargarProgresoUsuario() {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) {
    progresoGlobal = { categorias: {}, temporadas: {} };
    return;
  }

  // --- Leer progreso por usuario ---
  const { data: progresoRows, error } = await supabase
    .from("progreso")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error("Error al cargar progreso:", error.message);
    progresoGlobal = { categorias: {}, temporadas: {} };
    return;
  }

  // Procesar progreso a objeto compatible
  let categorias = {};
  let temporadas = {};
  for (const row of progresoRows) {
    if (row.tipo === "quiz comentado") {
      const tema = row.clave;
      let categoria = null;
      for (const cat in coleccionablesData) {
        if (coleccionablesData[cat]?.[tema]) {
          categoria = cat;
          break;
        }
      }
      if (categoria) {
        if (!categorias[categoria]) categorias[categoria] = {};
        categorias[categoria][tema] = {
          nota: row.nota,
          porcentaje: row.porcentaje,
          estado: "completado"
        };
      }
    }
    if (row.tipo === "temporada") {
      temporadas[row.clave] = {
        nota: row.nota,
        porcentaje: row.porcentaje,
        estado: "completado"
      };
    }
  }
  progresoGlobal = {
    categorias,
    temporadas
  };
}

// ---- 3. Mostrar resumen principal ----
function mostrarResumenCategorias() {
  document.getElementById("resumen-categorias").classList.remove("oculto");
  document.getElementById("vista-personajes").classList.add("oculto");

  const resumen = document.getElementById("resumen-categorias");
  resumen.innerHTML = "";

  const progreso = progresoGlobal || { categorias: {}, temporadas: {} };
  const progresoCategorias = progreso.categorias || {};

  // --- Tarjetas de todas las categorías normales ---
  for (const categoria in coleccionablesData) {
    if (categoria === "logros") continue; // Agregado luego como categoría especial
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

  // --- Tarjeta especial para "Logros" ---
  const cardLogros = document.createElement("div");
  cardLogros.className = "card-categoria";
  cardLogros.innerHTML = `
    <h2>Logros</h2>
    <p>Desbloquea logros especiales</p>
    <div class="progreso"><div class="progreso-barra" style="width:100%"></div></div>
  `;
  cardLogros.addEventListener("click", () => mostrarPersonajes("Logros"));
  resumen.appendChild(cardLogros);

  // --- Tarjeta especial para "Temporadas" ---
  const cardTemp = document.createElement("div");
  cardTemp.className = "card-categoria";
  cardTemp.innerHTML = `
    <h2>Temporadas</h2>
    <p>Coleccionables especiales por evento</p>
    <div class="progreso"><div class="progreso-barra" style="width:100%"></div></div>
  `;
  cardTemp.addEventListener("click", () => mostrarPersonajes("Temporadas"));
  resumen.appendChild(cardTemp);
}

// ---- 4. Mostrar los personajes/temas de una categoría (galería visual) ----
function mostrarPersonajes(categoriaActual) {
  const vistaPersonajes = document.getElementById("vista-personajes");
  const resumenCategorias = document.getElementById("resumen-categorias");
  const titulo = document.getElementById("titulo-categoria");
  const contenedor = document.getElementById("personajes-categoria");

  resumenCategorias.classList.add("oculto");
  vistaPersonajes.classList.remove("oculto");

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
    } else if (categoriaActual === "Logros") {
      temas = {};
      const progreso = progresoGlobal || { categorias: {}, historial: [] };
      const progresoCategorias = progreso.categorias || {};

      const logros = coleccionablesData.logros || {};
      const completosPorCategoria = logros.completos_por_categoria || {};
      const totalesPorA = logros.totales_por_a || {};

      let totalA = 0;
      let completados = [];

      for (const categoriaLogro in completosPorCategoria) {
        const categoriaReal = Object.keys(coleccionablesData).find(
          c => c.toLowerCase() === categoriaLogro.toLowerCase()
        );
        if (!categoriaReal) continue;

        const temasCat = coleccionablesData[categoriaReal];
        const progresoTemas = progresoCategorias[categoriaReal] || {};

        const todosA = Object.keys(temasCat).every(t => (progresoTemas[t]?.nota || "") === "A");
        if (todosA) completados.push(categoriaLogro);

        totalA += Object.values(progresoTemas).filter(p => p.nota === "A").length;
      }

      for (const categoria in completosPorCategoria) {
        const logrado = completados.includes(categoria);
        temas[categoria] = {
          img_a: logrado ? completosPorCategoria[categoria] : "assets/img/coleccionables/bloqueado.png",
          descripcion: logrado
            ? `Completaste todos los temas de "${categoria}" con nota A.`
            : `Completa todos los temas de "${categoria}" con nota A para desbloquear.`,
          nota: logrado ? "A" : "F"
        };
      }
      for (const nStr in totalesPorA) {
        const n = parseInt(nStr);
        const logrado = totalA >= n;
        const nombre = `Logro ${n} A`;
        temas[nombre] = {
          img_a: logrado ? totalesPorA[nStr] : "assets/img/coleccionables/bloqueado.png",
          descripcion: logrado
            ? `¡Has alcanzado ${n} temas con nota A!`
            : `Alcanza ${n} temas con nota A para desbloquear.`,
          nota: logrado ? "A" : "F"
        };
      }
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

    contenedor.className = "galeria-coleccionables";

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

      let clase = "tarjeta-coleccionable bloqueado";
      let etiqueta = `<span class="etiqueta-nota nota-bloqueado">🔒</span>`;
      if (nota === "A") {
        clase = "tarjeta-coleccionable a";
        etiqueta = `<span class="etiqueta-nota nota-a">A</span>`;
      } else if (nota === "B") {
        clase = "tarjeta-coleccionable b";
        etiqueta = `<span class="etiqueta-nota nota-b">B</span>`;
      } else if (nota === "C") {
        clase = "tarjeta-coleccionable c";
        etiqueta = `<span class="etiqueta-nota nota-c">C</span>`;
      }

      const card = document.createElement("div");
      card.className = clase;
      card.innerHTML = `
        <img src="${ruta}" alt="${tema}" />
        <h3>${tema}</h3>
        ${etiqueta}
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

  // --- Swipe móvil para cambiar de categoría ---
  // Todas las categorías posibles (incluyendo Logros y Temporadas)
  const todas = [...Object.keys(coleccionablesData), "Logros", "Temporadas"];
  const i = todas.indexOf(categoriaActual);
  let x0 = null;
  vistaPersonajes.ontouchstart = (e) => { x0 = e.touches[0].clientX; };
  vistaPersonajes.ontouchend = (e) => {
    if (x0 === null) return;
    let dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 45) {
      if (dx < 0 && i < todas.length - 1) mostrarPersonajes(todas[i + 1]);
      else if (dx > 0 && i > 0) mostrarPersonajes(todas[i - 1]);
    }
    x0 = null;
  };

  // Scroll por rueda en PC (opcional)
  vistaPersonajes.onwheel = (e) => {
    if (e.deltaY > 30 && i < todas.length - 1) mostrarPersonajes(todas[i + 1]);
    else if (e.deltaY < -30 && i > 0) mostrarPersonajes(todas[i - 1]);
  };
}

// --- Swipe móvil para cambiar categoría ---
let x0 = null;
vistaPersonajes.ontouchstart = (e) => { x0 = e.touches[0].clientX; };
vistaPersonajes.ontouchend = (e) => {
  if (x0 === null) return;
  let dx = e.changedTouches[0].clientX - x0;
  if (Math.abs(dx) > 45) {
    if (dx < 0 && i < todas.length - 1) mostrarPersonajes(todas[i + 1]);
    else if (dx > 0 && i > 0) mostrarPersonajes(todas[i - 1]);
  }
  x0 = null;
};



// ---- 5. Modal de detalle ----
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
  document.onkeydown = (ev) => {
    if (ev.key === "Escape") cerrarModal();
  };
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
document.getElementById("volver-resumen").addEventListener("click", () => {
  document.getElementById("vista-personajes").classList.add("oculto");
  document.getElementById("resumen-categorias").classList.remove("oculto");
});
