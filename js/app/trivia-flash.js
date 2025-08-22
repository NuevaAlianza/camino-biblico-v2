let usuarioActual = null;
let preguntasQuiz = []; // (fallback) no se usa salvo emergencia

// Lunes(1) a Sábado(6)
const diasPermitidos = [1,2,3,4,5,6];

const EMOJIS_FLASH = [
  { emoji: "💤", hasta: 17 },
  { emoji: "🙂", hasta: 13 },
  { emoji: "😳", hasta: 9  },
  { emoji: "😬", hasta: 5  },
  { emoji: "🚨", hasta: 0  }
];

let temporizadorActivo = null;
let rpgDataCache = null;

/* ===================== Utilidades ===================== */

function nombreDia(d) { return ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"][d]; }
function diaAIndice(d) { return (d>=1 && d<=6) ? d : 0; } // Lun=1..Sab=6
function pad(n){ return n<10 ? "0"+n : ""+n; }
function ymd(date) { return date.getFullYear()+"-"+pad(date.getMonth()+1)+"-"+pad(date.getDate()); }

// Lunes como inicio de semana
function startOfWeekMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0..6
  const diff = (day === 0 ? -6 : 1 - day); // Mueve a lunes
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

// Semana tipo ISO (YYYY-Sxx) usando jueves como referencia
function cicloSemana(date) {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const thursday = new Date(target);
  thursday.setDate(target.getDate() + (4 - (target.getDay() || 7)));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7);
  return `${thursday.getFullYear()}-S${week}`;
}

function fechaSemanaAnterior(baseDate) {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  d.setDate(d.getDate() - 7);
  return d;
}
function cicloSemanaAnterior(hoy) {
  return cicloSemana(fechaSemanaAnterior(hoy));
}

// Devuelve lunes..sábado de la semana de baseDate
function semanaLunSab(baseDate) {
  const lunes = startOfWeekMonday(baseDate);
  return Array.from({length:6}, (_,i) =>
    new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate()+i)
  );
}

/* ===================== Sonidos ===================== */
function reproducirSonido(nombre) {
  try {
    const audio = new Audio("assets/sonidos/" + nombre);
    audio.play();
  } catch (e) {}
}

/* ===================== Temporizador circular ===================== */
function crearTemporizadorPregunta(duracion, onTimeout, onTick, onEmojiChange) {
  let tiempoRestante = duracion;
  let intervalo;
  let emojiActual = "";

  function actualizarTemporizador() {
    // Círculo SVG
    const circulo = document.getElementById("timer-circular");
    const radio = 40, circunferencia = 2 * Math.PI * radio;
    const progreso = tiempoRestante / duracion;
    if (circulo) {
      circulo.style.strokeDasharray = `${circunferencia}`;
      circulo.style.strokeDashoffset = `${circunferencia * (1 - progreso)}`;
    }

    // Emoji
    const emojiObj = EMOJIS_FLASH.find(e => tiempoRestante > e.hasta) || EMOJIS_FLASH[EMOJIS_FLASH.length - 1];
    if (emojiObj && emojiActual !== emojiObj.emoji) {
      emojiActual = emojiObj.emoji;
      const emojiDiv = document.getElementById("emoji-animado");
      if (emojiDiv) {
        emojiDiv.textContent = emojiActual;
        emojiDiv.className = "emoji-animado" + (emojiActual === "🚨" ? " shake" : "");
        if (onEmojiChange) onEmojiChange(emojiActual);
      }
    }

    // Tiempo texto
    const texto = document.getElementById("timer-text");
    if (texto) texto.textContent = tiempoRestante + "s";
    if (onTick) onTick(tiempoRestante);
  }

  actualizarTemporizador();

  intervalo = setInterval(() => {
    tiempoRestante--;
    actualizarTemporizador();
    if (tiempoRestante <= 0) {
      clearInterval(intervalo);
      if (onTimeout) onTimeout();
    }
  }, 1000);

  temporizadorActivo = {
    detener: () => clearInterval(intervalo),
    getTiempo: () => tiempoRestante
  };
  return temporizadorActivo;
}
function limpiarTemporizadorPregunta() {
  if (temporizadorActivo && temporizadorActivo.detener) temporizadorActivo.detener();
  temporizadorActivo = null;
}

/* ===================== Racha semanal (desde trivia_flash) ===================== */
// Obtiene intentos de la semana (Lun–Sab) actual
async function obtenerIntentosSemanaActual(ciclo) {
  const { data } = await supabase
    .from("trivia_flash")
    .select("fecha, dia_idx, aciertos, xp_obtenido")
    .eq("user_id", usuarioActual.id)
    .eq("ciclo_semana", ciclo)
    .order("fecha", { ascending: true });
  return data || [];
}

// Calcula racha (consecutivos desde lunes hacia adelante, sin huecos)
function calcularRachaSemanal(intentos) {
  const jugados = new Set((intentos || []).map(i => i.dia_idx)); // 1..6
  let racha = 0;
  for (let d=1; d<=6; d++) {
    if (jugados.has(d)) racha++;
    else break;
  }
  return racha;
}

// Renderiza la barra de semana (6 segmentos) con info por día
function renderBarraSemana(intentos, baseDate) {
  const dias = semanaLunSab(baseDate); // 6 fechas
  const map = new Map((intentos||[]).map(i => [i.dia_idx, i])); // dia_idx->row
  const hoy = new Date();
  const hoyYmd = ymd(hoy);

  return `
    <div class="semana-wrap">
      <div class="semana-grid">
        ${dias.map((d,i) => {
          const idx = i+1; // 1..6
          const y = ymd(d);
          const row = map.get(idx);
          const estado = row ? "jugado" : (y < hoyYmd ? "no-jugado" : "pendiente");
          const tip = row ? `${nombreDia(d.getDay())} • ${row.aciertos}/${idx === 6 ? 12 : 5} • ${row.xp_obtenido} XP`
                          : `${nombreDia(d.getDay())} • ${estado.replace('-',' ')}`;
          return `
            <div class="semana-dia ${estado}" title="${tip}">
              <span class="dia-label">${["L","M","X","J","V","S"][i]}</span>
            </div>`;
        }).join("")}
      </div>
    </div>
  `;
}

// Muestra racha en UI para la semana del 'hoy'
async function mostrarRachaSemanalUI(ciclo, hoy) {
  const intentos = await obtenerIntentosSemanaActual(ciclo);
  const racha = calcularRachaSemanal(intentos);
  const barra = renderBarraSemana(intentos, hoy);
  const cont = document.getElementById("trivia-flash-estado");

  // Limpia bloques previos para evitar duplicados
  const prev = cont.querySelector('.resumen-semanal');
  if (prev) prev.remove();

  cont.insertAdjacentHTML('beforeend', `
    <div class="resumen-semanal">
      <div class="resumen-titulo">Racha semanal (L–S)</div>
      ${barra}
      <div class="resumen-datos">Racha: <b>${racha}</b> · Jugados: <b>${intentos.length}</b> · XP: <b>${(intentos||[]).reduce((a,b)=>a+(b.xp_obtenido||0),0)}</b></div>
    </div>
  `);
}

// (Domingo) Muestra resumen de la semana que termina
async function mostrarResumenSemanal(ciclo, hoy) {
  await mostrarRachaSemanalUI(ciclo, hoy);
  document.getElementById("trivia-flash-estado").innerHTML += `
    <div class="domingo-msg">
      Hoy es <b>domingo</b>: revisa tu desempeño de la semana y prepárate para la próxima.
    </div>`;
}

/* ===================== Adaptador RPG ===================== */

function seleccionarUnicos(arr, n) {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, Math.min(n, copia.length));
}

function adaptarPreguntaRPGaFlash(q) {
  // q: {pregunta, opciones: [..], respuesta}
  const opciones = Array.isArray(q.opciones) ? [...q.opciones] : [];
  if (!opciones.includes(q.respuesta)) opciones.unshift(q.respuesta);
  const distractores = opciones.filter(op => op !== q.respuesta);
  while (distractores.length < 3) distractores.push("(otra opción)");
  const dist = seleccionarUnicos(distractores, 3);
  return {
    pregunta: q.pregunta,
    respuesta: q.respuesta,
    opcion_1: dist[0],
    opcion_2: dist[1],
    opcion_3: dist[2]
  };
}

async function cargarPreguntasDesdeRPG(prevCiclo, diaIdx, cantidadDeseada) {
  // Carga y cachea rpg-preguntas.json
  if (!rpgDataCache) {
    const res = await fetch('datos/rpg-preguntas.json');
    if (!res.ok) throw new Error('No se pudo cargar rpg-preguntas.json');
    const json = await res.json();
    rpgDataCache = json?.ciclos || {};
  }

  // Buscar el ciclo exacto; si no existe, fallback al ciclo válido más cercano hacia atrás
  let cicloObjetivo = prevCiclo;
  if (!rpgDataCache[cicloObjetivo]) {
    const keys = Object.keys(rpgDataCache).sort();
    // toma el último <= prevCiclo; si ninguno, el último disponible
    let elegido = null;
    for (let i = keys.length - 1; i >= 0; i--) {
      if (keys[i] <= prevCiclo) { elegido = keys[i]; break; }
    }
    if (!elegido) elegido = keys[keys.length - 1];
    cicloObjetivo = elegido;
  }

  const niveles = rpgDataCache[cicloObjetivo]?.niveles || {};
  const mapaNivelPorDia = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: 'mix' };
  const nivelKey = mapaNivelPorDia[diaIdx] || 'mix';

  let pool = [];
  if (nivelKey === 'mix') {
    Object.keys(niveles).forEach(k => { pool = pool.concat(niveles[k] || []); });
  } else {
    pool = niveles[nivelKey] || [];
  }
  if (pool.length < cantidadDeseada) {
    Object.keys(niveles).forEach(k => { if (k !== nivelKey) pool = pool.concat(niveles[k] || []); });
  }

  const seleccion = seleccionarUnicos(pool, cantidadDeseada).map(adaptarPreguntaRPGaFlash);
  return { preguntas: seleccion, cicloObjetivo };
}

/* ===================== Flujo principal ===================== */

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Obtener sesión y usuario
  const { data: sessionData } = await supabase.auth.getSession();
  usuarioActual = sessionData?.session?.user;
  if (!usuarioActual) {
    document.getElementById("trivia-flash-estado").innerHTML = "<b>Inicia sesión para jugar Trivia Flash.</b>";
    return;
  }

  // 2. Día de la semana + banner
  const hoy = new Date();
  const diaSemana = hoy.getDay(); // 0..6
  const diaNombre = nombreDia(diaSemana);
  const idx6 = diaAIndice(diaSemana); // 1..6 o 0 si domingo
  const ciclo = cicloSemana(hoy);
  const prevCiclo = cicloSemanaAnterior(hoy);

  const esSabado = idx6 === 6;
  const totalPreguntasDia = esSabado ? 12 : 5;

  let banner = "";
  if (diasPermitidos.includes(diaSemana)) {
    banner = `
    <div class="flash-banner activo">
      <span class="pill-dia">Día ${idx6}/6</span>
      <span class="txt">Trivia Flash – ${diaNombre}${esSabado ? " (Repaso XL: 12 preguntas + bonus por racha)" : ""}</span>
      <span class="pill-ciclo">${ciclo} ← refuerzo de ${prevCiclo}</span>
    </div>`;
  } else {
    banner = `
    <div class="flash-banner inactivo">
      <span class="pill-dia">Domingo</span>
      <span class="txt">Resumen semanal</span>
      <span class="pill-ciclo">${ciclo}</span>
    </div>`;
  }
  document.getElementById("trivia-flash-estado").innerHTML = banner;

  // Muestra barra/racha siempre que se entra
  await mostrarRachaSemanalUI(ciclo, hoy);

  // Si domingo: solo resumen, no juego
  if (!diasPermitidos.includes(diaSemana)) return;

  // 3. Verificar si ya jugó hoy
  const hoyStr = ymd(hoy);
  const { data: jugoHoy } = await supabase
    .from("trivia_flash")
    .select("id")
    .eq("user_id", usuarioActual.id)
    .eq("fecha", hoyStr)
    .maybeSingle();

  // Fallback local por si el insert previo falló pero ya jugó
  const lockKey = `flash-lock-${usuarioActual.id}-${hoyStr}`;

  if (jugoHoy || localStorage.getItem(lockKey) === "1") {
    document.getElementById("trivia-flash-estado").innerHTML +=
      "<b>¡Ya jugaste Trivia Flash hoy!<br>Vuelve el próximo día habilitado.</b>";
    mostrarHistorial();
    return;
  }

  // 4. Tomar preguntas desde el RPG de la semana anterior
  let preguntasSeleccionadas = [];
  let cicloUsado = prevCiclo;

  try {
    const { preguntas, cicloObjetivo } = await cargarPreguntasDesdeRPG(prevCiclo, idx6, totalPreguntasDia);
    preguntasSeleccionadas = preguntas;
    cicloUsado = cicloObjetivo;
  } catch (e) {
    console.error("Error cargando RPG, fallback a quiz.json", e);
    await cargarPreguntasQuiz(); // opcional como respaldo
    preguntasSeleccionadas = seleccionarUnicos(preguntasQuiz, totalPreguntasDia);
  }

  if (!preguntasSeleccionadas.length) {
    document.getElementById("trivia-flash-estado").innerHTML += "<b>No hay preguntas disponibles. Contacta al administrador.</b>";
    return;
  }

  // 5. Iniciar juego
  iniciarTriviaFlash(preguntasSeleccionadas, diaSemana, cicloUsado, idx6);
});

async function cargarPreguntasQuiz() {
  if (!preguntasQuiz.length) {
    try {
      const response = await fetch('datos/quiz.json');
      if (!response.ok) throw new Error('No se pudo cargar quiz.json');
      preguntasQuiz = await response.json();
    } catch (error) {
      console.error('Error al cargar quiz.json:', error);
      preguntasQuiz = [];
    }
  }
}

/* ===================== Juego ===================== */

function iniciarTriviaFlash(preguntas, diaSemana, ciclo, idx6) {
  let actual = 0;
  let aciertos = 0;
  let respuestas = [];
  let rachaActual = 0;
  let maxRacha = 0;

  mostrarPregunta();

  function renderProgreso() {
    const total = preguntas.length;
    return `
      <div class="flash-progreso">
        ${Array.from({length: total}).map((_,i)=>`
          <span class="seg ${i < actual ? 'lleno' : ''}"></span>
        `).join("")}
      </div>
    `;
  }

  function renderChipRacha() {
    return `<div class="flash-racha">Racha: <b id="racha-valor">0</b></div>`;
  }

  function actualizarChipRacha() {
    const el = document.getElementById("racha-valor");
    if (el) el.textContent = rachaActual;
  }

  function mostrarPregunta() {
    if (actual >= preguntas.length) return finalizarTrivia();
    const q = preguntas[actual];
    const opciones = [q.respuesta, q.opcion_1, q.opcion_2, q.opcion_3].sort(()=>Math.random()-0.5);

    document.getElementById("trivia-flash-juego").innerHTML = `
      ${renderProgreso()}
      ${renderChipRacha()}
      <div class="temporizador-panel" id="panel-tempo">
        <svg width="90" height="90" class="temporizador-svg">
          <circle cx="45" cy="45" r="40" stroke-width="7" fill="none" id="timer-circular"/>
        </svg>
        <span id="emoji-animado" class="emoji-animado">💤</span>
        <div id="timer-text" class="timer-text">25s</div>
      </div>
      <div class="trivia-pregunta">
        <div class="pregunta">${actual+1}. ${q.pregunta}</div>
        <div class="trivia-opciones">
          ${opciones.map(op=>`
            <button class="trivia-opcion-btn" data-correcta="${op === q.respuesta}">
              ${op}
            </button>
          `).join("")}
        </div>
      </div>
    `;

    actualizarChipRacha();

    limpiarTemporizadorPregunta();
    reproducirSonido("background2.mp3");

    const panel = document.getElementById("panel-tempo");
    const circulo = document.getElementById("timer-circular");
    if (circulo) circulo.setAttribute("stroke", "#39d2c0");

    crearTemporizadorPregunta(
      25,
      () => { // onTimeout
        respuestas.push({ pregunta: q.pregunta, correcta: false, opcion: "(Sin respuesta)" });
        rachaActual = 0; // se corta la racha
        actualizarChipRacha();
        actual++;
        mostrarPregunta();
      },
      (t) => {
        if (t === 15) reproducirSonido("halfway.mp3");
        if (t === 6) reproducirSonido("warning.mp3");

        // Colores del trazo
        if (circulo) {
          let color = "#39d2c0";
          if (t <= 16 && t > 10) color = "#e0c341";
          else if (t <= 10 && t > 5) color = "#f28c28";
          else if (t <= 5) color = "#e23d3d";
          circulo.setAttribute("stroke", color);
        }
        if (panel) panel.classList.toggle("warn", t <= 5);
      },
      (emoji) => {}
    );

    document.querySelectorAll(".trivia-opcion-btn").forEach(btn => {
      btn.onclick = () => {
        // Deshabilitar todos inmediatamente para evitar dobles clics
        document.querySelectorAll(".trivia-opcion-btn").forEach(b => b.disabled = true);

        limpiarTemporizadorPregunta();
        const correcta = btn.dataset.correcta === "true";
        respuestas.push({ pregunta: q.pregunta, correcta, opcion: btn.textContent });
        if (correcta) {
          aciertos++;
          rachaActual++;
          if (rachaActual > maxRacha) maxRacha = rachaActual;
        } else {
          rachaActual = 0; // se corta la racha
        }
        actualizarChipRacha();

        actual++;
        mostrarPregunta();
      };
    });
  }

  function baseXP(total, aciertos) {
    if (total === 5) {
      if (aciertos === 5) return 10;
      if (aciertos === 4) return 5;
      if (aciertos === 3) return 2;
      return 0;
    }
    if (total === 12) {
      if (aciertos === 12) return 20;
      if (aciertos >= 10) return 15; // 10-11
      if (aciertos >= 8)  return 10; // 8-9
      if (aciertos >= 6)  return 5;  // 6-7
      return 0;
    }
    // genérico por si cambias cantidades en el futuro:
    const pct = aciertos / total;
    if (pct >= 1) return 20;
    if (pct >= 0.83) return 15;
    if (pct >= 0.66) return 10;
    if (pct >= 0.5)  return 5;
    return 0;
  }

  function bonusPorRacha(maxRacha, total) {
    // Bonos escalonados por racha máxima de la sesión.
    // 5 preguntas: 3→+2, 4→+3, 5→+5
    if (total === 5) {
      if (maxRacha >= 5) return 5;
      if (maxRacha >= 4) return 3;
      if (maxRacha >= 3) return 2;
      return 0;
    }
    // 12 preguntas (sábado): 3-4:+2, 5-6:+5, 7-8:+9, 9-12:+12
    if (total === 12) {
      if (maxRacha >= 9) return 12;
      if (maxRacha >= 7) return 9;
      if (maxRacha >= 5) return 5;
      if (maxRacha >= 3) return 2;
      return 0;
    }
    // genérico
    if (maxRacha >= Math.ceil(total*0.75)) return 10;
    if (maxRacha >= Math.ceil(total*0.5))  return 6;
    if (maxRacha >= 3) return 2;
    return 0;
  }

  async function finalizarTrivia() {
    document.getElementById("trivia-flash-juego").innerHTML = "";
    const total = preguntas.length;

    let xp = baseXP(total, aciertos);
    const bonus = bonusPorRacha(maxRacha, total);
    xp += bonus;

    let emojiFinal = "😅", msgFinal = "¡Sigue practicando!", sonidoFinal = "resultado_bajo.mp3";
    if (total === 5) {
      if (aciertos >= 3 && aciertos <= 4) { emojiFinal = "😃"; msgFinal = "¡Muy bien, casi lo logras!"; sonidoFinal = "resultado_medio.mp3"; }
      if (aciertos === 5) { emojiFinal = "🥇"; msgFinal = "¡Excelente, eres Flash Pro!"; sonidoFinal = "resultado_alto.mp3"; }
    } else { // 12 preguntas
      if (aciertos >= 6 && aciertos <= 9)  { emojiFinal = "🙂"; msgFinal = "¡Buen repaso!"; sonidoFinal = "resultado_medio.mp3"; }
      if (aciertos >= 10)                  { emojiFinal = "🏆"; msgFinal = "¡Repaso XL impecable!"; sonidoFinal = "resultado_alto.mp3"; }
    }

    reproducirSonido(sonidoFinal);

    document.getElementById("trivia-flash-resultado").innerHTML = `
      <div class="trivia-flash-resultado-msg">
        <span class="emoji-final">${emojiFinal}</span><br>
        <b>${aciertos}</b> de <b>${total}</b> correctas.<br>
        <span class="msg-final">${msgFinal}</span>
      </div>
      <div class="trivia-flash-xp-ganado">
        ${xp > 0 ? `+${xp} XP 🟡` : `Sin XP esta vez 😅`}<br>
        ${bonus > 0 ? `<small>Bonus por racha máxima (${maxRacha}): +${bonus} XP</small>` : ``}
      </div>
    `;

    // Guardar intento (Supabase) + bloqueo local
    const fechaHoy = ymd(new Date());
    const payload = {
      user_id: usuarioActual.id,
      fecha: fechaHoy,
      aciertos,
      xp_obtenido: xp,
      preguntas: respuestas,
      ciclo_semana: ciclo,
      dia_idx: idx6,
      total_preguntas: total,
      max_racha: maxRacha
    };
    const { error } = await supabase.from("trivia_flash").insert([payload]);

    // Lock local (aunque falle insert)
    const lockKey = `flash-lock-${usuarioActual.id}-${fechaHoy}`;
    localStorage.setItem(lockKey, "1");

    if (error) {
      document.getElementById("trivia-flash-resultado").innerHTML += `
        <div class="trivia-flash-resultado-msg error">❌ Hubo un error al guardar tu intento.<br>
        <pre>${error.message}</pre></div>`;
    }

    mostrarBotonCompartir(aciertos, diaSemana, total);
    mostrarHistorial();

    // Refrescar racha/barra
    const hoy = new Date();
    await mostrarRachaSemanalUI(ciclo, hoy);
  }
}

/* ===================== Compartir ===================== */
function mostrarBotonCompartir(aciertos, diaSemana, total) {
  let mensaje = `¡Jugué Trivia Flash y logré ${aciertos} de ${total}!\n¿Puedes superarme?`;
  let btn = document.getElementById("btn-flash-compartir");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "btn-flash-compartir";
    btn.className = "flash-compartir-btn";
    document.body.appendChild(btn);
  }
  btn.innerHTML = "Compartir resultado 📣";
  btn.style.display = "block";
  btn.classList.toggle("flash-activo", diasPermitidos.includes(diaSemana));
  btn.classList.add("flash-bounce");

  btn.onclick = () => {
    if (navigator.share) {
      navigator.share({ title: "Trivia Flash", text: mensaje, url: window.location.href });
    } else {
      navigator.clipboard.writeText(mensaje);
      alert("¡Resultado copiado! Puedes pegarlo donde quieras.");
    }
  };
  setTimeout(()=>btn.classList.remove("flash-bounce"), 1600);
}

/* ===================== Historial ===================== */
async function mostrarHistorial() {
  const { data: intentos } = await supabase
    .from("trivia_flash")
    .select("*")
    .eq("user_id", usuarioActual.id)
    .order("fecha", { ascending: false })
    .limit(6);

  document.getElementById("trivia-flash-historial").innerHTML = `
    <h3>Historial Trivia Flash</h3>
    <ul>
      ${(intentos || []).map(i=>`
        <li>${i.fecha}: ${i.aciertos}/${i.total_preguntas || 5} correctas, ${i.xp_obtenido} XP (max racha: ${i.max_racha || 0})</li>
      `).join("")}
    </ul>
  `;
}
