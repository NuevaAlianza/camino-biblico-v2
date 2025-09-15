/* ===================== CONFIG / MENTORES ===================== */
window.modoPractica = false;

const MENTORES = [
  { id:"san_juan", nombre:"San Juan Vianney", img:"assets/img/mentor/mentor_cura.png",
    habilidades:[
      "+5 segundos por pregunta","Oración poderosa","Empatía pastoral","+10 segundos por pregunta",
      "Consejo certero","Ánimo inagotable","Discernimiento espiritual",
      "50% de preguntas más fáciles (¡o eso parece!)","Sabiduría inesperada",
      "Fortaleza en la adversidad","Serenidad bajo presión","Memoria bíblica"
    ]},
  { id:"santa_teresa", nombre:"Santa Teresa de Ávila", img:"assets/img/mentor/mentor_teresa.png",
    habilidades:[
      "Paciencia legendaria","+7 segundos por pregunta","Visión espiritual","Alegría contagiosa",
      "Confianza total","Mente estratégica","Puedes pedir pista especial","+2 segundos por pregunta",
      "Oración profunda","Inspiración a prueba de dudas","Paz interior","Valor ante el miedo"
    ]},
  { id:"san_pablo", nombre:"San Pablo", img:"assets/img/mentor/mentor_pablo.png",
    habilidades:[
      "+10 segundos por pregunta","Conversión radical","Resistencia a la adversidad",
      "Predicador incansable","Dominio de la Palabra","+5 segundos por pregunta",
      "Coraje misionero","Sabiduría para responder rápido","Motivación constante",
      "Discernimiento de espíritus","Viajes épicos (¡sin perder el rumbo!)","Citas bíblicas al instante"
    ]},
];

function extraerBonusSegundos(txt){ const m=txt.match(/\+(\d+)\s*seg/i); return m?parseInt(m[1],10):0; }

/* ===================== ESTADO GLOBAL ===================== */
let usuarioActual=null;
let rpgCiclos={}, cicloActual=isoCicloSemana(new Date());
let datosCiclo=null, progresoRPG=null;

let mentorElegido=null, habilidadesMentorPartida=[], bonusTiempoMentor=0;

const preguntasPorNivel=[5,4,3,3,3]; // Niveles 1..5
const EMOJIS_RPG=[{emoji:"😌",hasta:21},{emoji:"🙂",hasta:16},{emoji:"😐",hasta:11},{emoji:"😯",hasta:6},{emoji:"😱",hasta:0}];
let temporizadorActivo=null;

/* ===================== HELPERS TIEMPO/SONIDO ===================== */
function isoCicloSemana(date){
  const d=new Date(date); d.setHours(0,0,0,0);
  d.setDate(d.getDate()+4-(d.getDay()||7));
  const yStart=new Date(d.getFullYear(),0,1);
  const week=Math.ceil((((d-yStart)/86400000)+1)/7);
  return `${d.getFullYear()}-S${week}`;
}

function reproducirSonido(nombre){
  try{ const a=new Audio(`assets/sonidos/${nombre}`); a.play(); }catch(_){}
}
function sonidoFalloAleatorio(){
  const arr=["wrong1.mp3","wrong2.mp3","wrong3.mp3","wrong4.mp3"];
  return arr[Math.floor(Math.random()*arr.length)];
}

function crearTemporizadorPregunta(duracion, onTimeout, onTick){
  let t=duracion; let st=null; let curEmoji="";
  function tick(){
    // SVG
    const c=document.getElementById("timer-circular");
    const r=40, C=2*Math.PI*r, prog=t/duracion;
    if (c){ c.style.strokeDasharray=`${C}`; c.style.strokeDashoffset=`${C*(1-prog)}`; }

    // emoji
    const e = EMOJIS_RPG.find(x=>t>x.hasta) || EMOJIS_RPG.at(-1);
    if (e && e.emoji!==curEmoji){
      curEmoji=e.emoji;
      const el=document.getElementById("emoji-animado");
      if (el){ el.textContent=curEmoji; el.className="emoji-animado"+(curEmoji==="😱"?" shake":""); }
    }
    const txt=document.getElementById("timer-text");
    if (txt) txt.textContent=`${t}s`;
    if (onTick) onTick(t);
  }
  tick();
  st=setInterval(()=>{
    t--; tick();
    if (t<=0){ clearInterval(st); onTimeout&&onTimeout(); }
  },1000);
  temporizadorActivo={detener:()=>clearInterval(st), getTiempo:()=>t};
  return temporizadorActivo;
}
function limpiarTemporizadorPregunta(){ if (temporizadorActivo?.detener) temporizadorActivo.detener(); temporizadorActivo=null; }

/* ===================== SUPABASE: PROGRESO ===================== */
// Tabla rpg_progreso con columnas añadidas: estado TEXT, vidas_restantes INT
async function cargarProgresoRPG(){
  const { data: sessionData }=await supabase.auth.getSession();
  usuarioActual=sessionData?.session?.user;
  const userId=usuarioActual?.id; if(!userId) return null;
  const { data } = await supabase.from("rpg_progreso").select("*").eq("user_id",userId).eq("ciclo",cicloActual).maybeSingle();
  return data||null;
}

// Upsert de progreso “en curso”
async function guardarParcial({nivelMax, xp, vidasRestantes}){
  if (window.modoPractica) return; // no guardar en práctica
  const { data: sessionData }=await supabase.auth.getSession();
  const user= sessionData?.session?.user; if(!user) return;
  const meta=user.user_metadata||{};
  await supabase.from("rpg_progreso").upsert([{
    user_id:user.id,
    ciclo:cicloActual,
    nivel_max: nivelMax,
    rango: null,
    xp: xp,
    completado:false,
    estado:"en curso",
    vidas_restantes: vidasRestantes,
    fecha_juego: new Date().toISOString(),
    pais: meta.pais||null, ciudad: meta.ciudad||null, parroquia: meta.parroquia||null
  }]);
}

// Finalizar: bloquea y cierra la partida
async function guardarFinal({nivelMax, xp, rango}){
  if (window.modoPractica) return; // no guardar en práctica
  const { data: sessionData }=await supabase.auth.getSession();
  const user= sessionData?.session?.user; if(!user) return;
  const meta=user.user_metadata||{};
  await supabase.from("rpg_progreso").upsert([{
    user_id:user.id,
    ciclo:cicloActual,
    nivel_max:nivelMax,
    rango:rango,
    xp:xp,
    completado:true,
    estado:"terminado",
    vidas_restantes: 0,
    fecha_juego:new Date().toISOString(),
    pais: meta.pais||null, ciudad: meta.ciudad||null, parroquia: meta.parroquia||null
  }]);
}

/* ===================== UI INICIAL ===================== */
document.addEventListener("DOMContentLoaded", async ()=>{
  const { data: sessionData }=await supabase.auth.getSession();
  usuarioActual=sessionData?.session?.user;
  if (!usuarioActual){
    document.getElementById("bienvenida-stats").innerHTML=`
      <div class="panel-mensaje">
        <h2>Inicia sesión para jugar la Trivia RPG.</h2>
        <button onclick="window.location.reload()">Recargar sesión</button>
      </div>`;
    document.getElementById("btn-comenzar").style.display="none";
    document.getElementById("btn-continuar").style.display="none";
    return;
  }

  // Cargar preguntas del ciclo
  const res=await fetch("datos/rpg-preguntas.json"); const json=await res.json();
  rpgCiclos=json.ciclos||{}; datosCiclo=rpgCiclos[cicloActual];
  if (!datosCiclo){ mostrarSinCiclo(); return; }

  await prepararPantallaBienvenida();
  document.getElementById("menu-rpg").classList.remove("oculto");
  inicializarRPG();
});

function mostrarSinCiclo(){
  document.getElementById("menu-rpg").innerHTML=`
    <div class="panel-mensaje">
      <h2>No hay Trivia RPG programada para esta semana.</h2>
      <p>Vuelve la próxima semana ✨</p>
    </div>`;
  document.getElementById("btn-comenzar").style.display="none";
  document.getElementById("btn-continuar").style.display="none";
}

async function prepararPantallaBienvenida(){
  progresoRPG=await cargarProgresoRPG();
  const bloqueado = progresoRPG && (
    progresoRPG.estado==="terminado" ||
    progresoRPG.completado===true ||
    progresoRPG.xp>0 ||
    (progresoRPG.vidas_restantes??3) < 3 ||
    (progresoRPG.nivel_max??1) > 1
  );

  const cont=document.getElementById("bienvenida-stats");

  if (bloqueado && progresoRPG.estado!=="terminado"){
    // Jugó y salió: mostrar cierre y XP parcial
    cont.innerHTML=`
      <div class="panel-bienvenida">
        <div class="rpg-bienvenido">Sesión cerrada</div>
        <p>Ya iniciaste tu aventura esta semana. Al salir, tu progreso quedó registrado.</p>
        <p><b>XP acumulada:</b> ${progresoRPG.xp||0} · <b>Nivel alcanzado:</b> ${progresoRPG.nivel_max||1}</p>
        <small>Podrás jugar de nuevo la próxima semana.</small>
      </div>`;
    document.getElementById("btn-comenzar").style.display="none";
    document.getElementById("btn-continuar").style.display="none";
    return;
  }

  if (progresoRPG?.estado==="terminado" || progresoRPG?.completado){
    cont.innerHTML=`
      <div class="panel-bienvenida">
        <div class="rpg-bienvenido">¡Trivia de esta semana completada!</div>
        <p>Rango: <b>${progresoRPG.rango||"-"}</b> · XP: <b>${progresoRPG.xp||0}</b></p>
        <small>Puedes usar el <b>modo práctica</b> (no suma XP).</small>
        <button id="btn-modo-practica" class="btn-secundario">Modo práctica</button>
      </div>`;
    document.getElementById("btn-comenzar").style.display="none";
    document.getElementById("btn-continuar").style.display="none";
    document.getElementById("btn-modo_practica")?.remove();
    document.getElementById("btn-modo-practica").onclick=()=>{
      window.modoPractica=true;
      mentorElegido=null; habilidadesMentorPartida=[]; bonusTiempoMentor=0;
      mostrarSelectorMentor();
    };
    return;
  }

  // Libre para jugar
  cont.innerHTML=`
    <div class="panel-bienvenida">
      <div class="rpg-bienvenido">¡Bienvenido a la Aventura RPG!</div>
      <div class="rpg-avanza">Elige un mentor y comienza. Recuerda: tienes <b>3 vidas</b>.</div>
      <button id="btn-elegir-mentor" class="btn-principal">Elegir mentor</button>
      <button id="btn-modo-practica" class="btn-secundario">Modo práctica</button>
    </div>`;
  document.getElementById("btn-elegir-mentor").onclick=mostrarSelectorMentor;
  document.getElementById("btn-modo-practica").onclick=()=>{
    window.modoPractica=true; mostrarSelectorMentor();
  };
}

/* ===================== INICIO / CONTINUAR ===================== */
let juegoActual=null;

function inicializarRPG(){
  document.getElementById("btn-logros").onclick=()=>mostrarLogros();
  document.getElementById("btn-comenzar").onclick=()=>{
    if (!usuarioActual) return alert("Inicia sesión.");
    if (!mentorElegido) return mostrarSelectorMentor();
    juegoActual={ nivel:1, vidas:3, pregunta:0, preguntasNivel:null, xp:0 };
    mostrarNivel();
  };
  document.getElementById("btn-continuar").onclick=()=>{
    if (!usuarioActual) return alert("Inicia sesión.");
    if (!mentorElegido) return mostrarSelectorMentor();
    if (!juegoActual) juegoActual={ nivel:1, vidas:3, pregunta:0, preguntasNivel:null, xp:0 };
    mostrarNivel();
  };

  // Ocultar pantallas de juego al inicio
  document.getElementById("juego-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.add("oculto");
  document.getElementById("logros-rpg").classList.add("oculto");
}

/* ===================== MENTOR ===================== */
function mezclarArray(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }

function mostrarSelectorMentor(){
  let html=`<div id="modal-mentor" class="modal-mentor"><h2>Elige tu mentor</h2><div class="mentores-lista">`;
  MENTORES.forEach(m=>{
    const picks=mezclarArray([...m.habilidades]).slice(0,3);
    html+=`
      <div class="mentor-card" data-id="${m.id}">
        <img src="${m.img}" alt="${m.nombre}" class="mentor-img"/>
        <h3>${m.nombre}</h3>
        <ul>${picks.map(h=>`<li>${h}</li>`).join("")}</ul>
        <button class="btn-seleccionar-mentor" data-id="${m.id}">Elegir</button>
      </div>`;
  });
  html+=`</div><button id="cerrar-mentor" class="btn-cerrar">Cancelar</button></div>`;
  const ov=document.createElement("div");
  ov.id="overlay-mentor";
  ov.style="position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:1000;display:flex;align-items:center;justify-content:center;";
  ov.innerHTML=html;
  document.body.appendChild(ov);
  document.getElementById("cerrar-mentor").onclick=()=>document.body.removeChild(ov);
  ov.querySelectorAll(".btn-seleccionar-mentor").forEach(b=>{
    b.onclick=()=>{
      const id=b.dataset.id;
      mentorElegido=MENTORES.find(x=>x.id===id);
      habilidadesMentorPartida=mezclarArray([...mentorElegido.habilidades]).slice(0,3);
      bonusTiempoMentor=habilidadesMentorPartida.reduce((s,h)=>s+extraerBonusSegundos(h),0);
      document.body.removeChild(ov);
      // Mostrar mini confirmación
      const cont=document.getElementById("bienvenida-stats");
      cont.innerHTML=`
        <div class="panel-bienvenida">
          <div class="rpg-bienvenido">Mentor elegido:</div>
          <div class="mentor-seleccionado">
            <img src="${mentorElegido.img}" alt="${mentorElegido.nombre}" style="width:90px;height:90px;border-radius:50%;margin:8px 0;">
            <div><strong>${mentorElegido.nombre}</strong></div>
          </div>
          <button id="btn-iniciar-aventura" class="btn-principal">Iniciar aventura</button>
        </div>`;
      document.getElementById("btn-iniciar-aventura").onclick=()=>{
        document.getElementById("menu-rpg").classList.remove("oculto");
        document.getElementById("btn-comenzar").click();
      };
    };
  });
}

/* ===================== JUEGO: NIVELES/PREGUNTAS ===================== */
function mostrarNivel(){
  const wrap=document.getElementById("juego-rpg");
  wrap.classList.remove("oculto");
  document.getElementById("menu-rpg").classList.add("oculto");
  document.getElementById("resultados-rpg").classList.add("oculto");
  document.getElementById("logros-rpg").classList.add("oculto");

  const nivel=juegoActual.nivel;
  const key=String(nivel);
  const total=preguntasPorNivel[nivel-1]||3;
  const niveles = datosCiclo?.niveles||{};
  if (!Array.isArray(niveles[key])||!niveles[key].length){
    wrap.innerHTML=`<div class="panel-mensaje"><h2>Sin preguntas para el nivel ${nivel}</h2><p>Verifica rpg-preguntas.json</p><button onclick="window.location.reload()">Volver</button></div>`;
    return;
  }

  // Selección y shuffle de opciones
  if (!juegoActual.preguntasNivel || juegoActual.preguntasNivel.length!==total){
    const base=mezclarArray([...niveles[key]]).slice(0,total).map(p=>{
      const ops=[...p.opciones]; // ya vienen como array
      return {...p, opciones: mezclarArray(ops)};
    });
    juegoActual.preguntasNivel=base; juegoActual.pregunta=0;
  }

  renderPregunta();

  function renderPregunta(){
    const i=juegoActual.pregunta||0;
    const p=juegoActual.preguntasNivel[i];
    if (!p){
      // Subió de nivel
      juegoActual.nivel++;
      // Guardado parcial: subir nivel_max
      const nuevoNivelMax = Math.max(progresoRPG?.nivel_max||1, juegoActual.nivel-1);
      guardarParcial({ nivelMax: nuevoNivelMax, xp: juegoActual.xp, vidasRestantes: juegoActual.vidas }).then(()=>{});
      if (juegoActual.nivel>preguntasPorNivel.length){
        terminarAventura(true); // completó todo
      }else{
        mostrarIntermedioNivel(juegoActual.nivel, juegoActual.vidas, renderPregunta, mostrarNivel);
      }
      return;
    }

    wrap.innerHTML=`
      <div class="temporizador-panel">
        <svg width="90" height="90" class="temporizador-svg">
          <circle cx="45" cy="45" r="40" stroke="#f4a261" stroke-width="7" fill="none" id="timer-circular"></circle>
        </svg>
        <span id="emoji-animado" class="emoji-animado">😌</span>
        <div id="timer-text" class="timer-text">25s</div>
      </div>
      <div class="panel-pregunta">
        <div class="rpg-info">
          <span class="rpg-nivel">Nivel: ${juegoActual.nivel}</span>
          <span class="rpg-vidas">${"❤️".repeat(juegoActual.vidas)}</span>
        </div>
        <div class="rpg-pregunta"><b>${p.pregunta}</b></div>
        <div class="rpg-opciones">
          ${p.opciones.map((op,idx)=>`<button class="rpg-btn-op" data-i="${idx}">${op}</button>`).join("")}
        </div>
        <small>Tienes ${3} vidas en total. ¡Suerte!</small>
      </div>
    `;

    limpiarTemporizadorPregunta();
    reproducirSonido("go.mp3");
    crearTemporizadorPregunta(25+bonusTiempoMentor,
      // Timeout → pierde vida, guarda parcial
      ()=>{
        juegoActual.vidas--;
        // guardado parcial (ya perdió vida ⇒ queda bloqueado si sale)
        guardarParcial({ nivelMax: Math.max(progresoRPG?.nivel_max||1, juegoActual.nivel), xp: juegoActual.xp, vidasRestantes: juegoActual.vidas }).then(()=>{});
        if (juegoActual.vidas<=0) { terminarAventura(false); return; }
        // anim vidas
        const v=document.querySelector(".rpg-vidas");
        if (v){ v.classList.add("shake"); setTimeout(()=>v.classList.remove("shake"),400); }
        juegoActual.pregunta=i+1; renderPregunta();
      },
      // Ticks para sonidos
      (t)=>{ if (t===13) reproducirSonido("halfway.mp3"); if (t===5) reproducirSonido("warning.mp3"); }
    );

    // Clicks
    wrap.querySelectorAll(".rpg-btn-op").forEach(btn=>{
      btn.onclick=()=>{
        limpiarTemporizadorPregunta();
        const correcta = p.opciones[btn.dataset.i]==p.respuesta;
        if (correcta){
          btn.classList.add("acierto");
          reproducirSonido("correcto.mp3");
          juegoActual.xp += (juegoActual.nivel*1);
          // guardado parcial (avanzó = también bloquea si sale)
          guardarParcial({ nivelMax: Math.max(progresoRPG?.nivel_max||1, juegoActual.nivel), xp: juegoActual.xp, vidasRestantes: juegoActual.vidas }).then(()=>{});
        }else{
          btn.classList.add("fallo");
          reproducirSonido(sonidoFalloAleatorio());
          juegoActual.vidas--;
          guardarParcial({ nivelMax: Math.max(progresoRPG?.nivel_max||1, juegoActual.nivel), xp: juegoActual.xp, vidasRestantes: juegoActual.vidas }).then(()=>{});
          const v=document.querySelector(".rpg-vidas");
          if (v){ v.classList.add("shake"); setTimeout(()=>v.classList.remove("shake"),400); }
        }
        setTimeout(()=>{
          if (juegoActual.vidas<=0){ terminarAventura(false); return; }
          juegoActual.pregunta=i+1; renderPregunta();
        },650);
      };
    });
  }
}

function mostrarIntermedioNivel(nivel, vidas, cbPregunta, cbNivel){
  const box=document.getElementById("juego-rpg");
  const frases=[
    "¡Vas con todo!","¡Gran avance!","¡Excelente ritmo!","¡Casi en la cima!","¡Último empujón!"
  ];
  box.innerHTML=`
    <div class="panel-mensaje-nivel">
      <h2>🎉 ¡Subiste al nivel ${nivel}!</h2>
      <p>${frases[nivel-2]||"¡Sigue así!"}</p>
      <p>Vidas restantes: <b>${vidas}</b></p>
      <button id="btn-seguir-nivel">Continuar</button>
    </div>`;
  document.getElementById("btn-seguir-nivel").onclick=cbNivel;
}

/* ===================== FIN PARTIDA ===================== */
function obtenerRango(nivel, completo){
  if (completo) return "Maestro de la Palabra";
  if (nivel>=5) return "Sabio de las Escrituras";
  if (nivel===4) return "Guerrero de la Fe";
  if (nivel===3) return "Explorador Bíblico";
  if (nivel===2) return "Principiante";
  return "Principiante";
}

async function terminarAventura(completo=false){
  document.getElementById("juego-rpg").classList.add("oculto");
  const panel=document.getElementById("resultados-rpg");
  panel.classList.remove("oculto");

  const rango = obtenerRango(juegoActual.nivel, completo);
  if (!window.modoPractica){
    await guardarFinal({
      nivelMax: Math.max(progresoRPG?.nivel_max||1, completo ? preguntasPorNivel.length : juegoActual.nivel),
      xp: juegoActual.xp,
      rango
    });
  }

  panel.innerHTML=`
    <h2>${completo?"¡Completaste la Trivia!":"Fin de la aventura"}</h2>
    <p>Rango: <b>${rango}</b></p>
    <p>XP ganada: <b>${juegoActual.xp}</b></p>
    <div class="msg-epico">${window.modoPractica?"(Modo práctica: no se guardó progreso)": "Vuelve la próxima semana para un nuevo reto."}</div>
    <button onclick="window.location.reload()">Volver al inicio</button>
    <button id="btn-compartir-resultado" class="compartir-btn">Compartir resultado</button>
  `;
  setTimeout(()=>{
    document.getElementById("btn-compartir-resultado").onclick=()=>{
      const msg = `${completo?"🏆 ¡Completé la Trivia Bíblica RPG!":"Jugué la Trivia Bíblica RPG"}\nRango: ${rango}\nXP: ${juegoActual.xp}\n¿Te atreves a superarme?`;
      if (navigator.share) navigator.share({title:"Resultado RPG", text:msg, url:location.href});
      else { navigator.clipboard.writeText(msg); alert("¡Copiado!"); }
    };
  },50);
}

/* ===================== LOGROS (placeholder) ===================== */
function mostrarLogros(){
  document.getElementById("menu-rpg").classList.add("oculto");
  document.getElementById("juego-rpg").classList.add("oculto");
  const box=document.getElementById("logros-rpg");
  box.classList.remove("oculto");
  box.innerHTML=`<h2>Logros RPG (próximamente)</h2><button onclick="window.location.reload()">Volver</button>`;
}
