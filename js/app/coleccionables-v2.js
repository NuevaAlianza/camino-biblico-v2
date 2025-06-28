let coleccionablesData = {};
let temporadasData = [];
let progresoGlobal = null;

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

(async function init() {
  [coleccionablesData, temporadasData] = await Promise.all([
    fetch('./datos/coleccionables.json').then(res => res.json()),
    fetch('./datos/temporadas.json').then(res => res.json())
  ]);
  await cargarProgresoUsuario();
  mostrarResumenCategorias();
})();

function mostrarResumenCategorias() {
  // Oculta vista de personajes y muestra el resumen
  document.getElementById("vista-personajes").classList.add("oculto");
  document.getElementById("resumen-categorias").classList.remove("oculto");
  document.getElementById("resumen-logros").classList.remove("oculto");

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

  mostrarResumenLogros();
}

function mostrarPersonajes(categoriaActual) {
  // Oculta resumen y muestra personajes
  document.getElementById("resumen-categorias").classList.add("oculto");
  document.getElementById("resumen-logros").classList.add("oculto");
  document.getElementById("vista-personajes").classList.remove("oculto");

  const titulo = document.getElementById("titulo-categoria");
  const contenedor = document.getElementById("personajes-categoria");
  contenedor.innerHTML = ""; // Limpia el contenido anterior
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
}

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
document.getElementById("volver-resumen").addEventListener("click", mostrarResumenCategorias);

function mostrarResumenLogros() {
  // Esta función crea la tarjeta de logros en el resumen, igual que antes.
  const resumen = document.getElementById("resumen-categorias");
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
    const temas = coleccionablesData[categoriaReal];
    const progresoTemas = progresoCategorias[categoriaReal] || {};
    const todosA = Object.keys(temas).every(t => (progresoTemas[t]?.nota || "") === "A");
    if (todosA) completados.push(categoriaLogro);
    totalA += Object.values(progresoTemas).filter(p => p.nota === "A").length;
  }

  coleccionablesData["Logros"] = {};

  for (const categoria in completosPorCategoria) {
    const logrado = completados.includes(categoria);
    coleccionablesData["Logros"][categoria] = {
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
    coleccionablesData["Logros"][nombre] = {
      img_a: logrado ? totalesPorA[nStr] : "assets/img/coleccionables/bloqueado.png",
      descripcion: logrado
        ? `¡Has alcanzado ${n} temas con nota A!`
        : `Alcanza ${n} temas con nota A para desbloquear.`,
      nota: logrado ? "A" : "F"
    };
  }

  const cantidadDesbloqueados = Object.values(coleccionablesData["Logros"]).filter(l => l.nota === "A").length;
  const cantidadTotal = Object.keys(coleccionablesData["Logros"]).length;

  const card = document.createElement("div");
  card.className = "card-categoria";
  card.innerHTML = `
    <h2>🏅 Logros especiales (${cantidadDesbloqueados}/${cantidadTotal})</h2>
    <p>Coleccionables por rendimiento destacado</p>
    <div class="progreso"><div class="progreso-barra" style="width: 100%"></div></div>
  `;
  card.addEventListener("click", () => mostrarPersonajes("Logros"));
  resumen.appendChild(card);
}

