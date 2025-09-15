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

/* ===================== VARIABLES GLOBALES ===================== */
let usuarioActual=null, progresoRPG=null, datosCiclo=null;
let mentorElegido=null, habilidadesMentorPartida=[], bonusTiempoMentor=0;
let juegoActual=null;
const preguntasPorNivel=[5,4,3,3,3];
const EMOJIS_RPG=[{emoji:"😌",hasta:21},{emoji:"🙂",hasta:16},{emoji:"😐",hasta:11},{emoji:"😯",hasta:6},{emoji:"😱",hasta:0}];
let temporizadorActivo=null;
const cicloActual=obtenerSemanaAnio();

/* ===================== HELPERS ===================== */
function obtenerSemanaAnio(){ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+4-(d.getDay()||7)); const yStart=new Date(d.getFullYear(),0,1); return `${d.getFullYear()}-S${Math.ceil((((d-yStart)/86400000)+1)/7)}`; }
function reproducirSonido(n){ try{ new Audio("assets/sonidos/"+n).play(); }catch{} }
function sonidoFalloAleatorio(){ return ["wrong1.mp3","wrong2.mp3","wrong3.mp3","wrong4.mp3"][Math.floor(Math.random()*4)]; }
function mezclarArray(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }

/* Temporizador circular */
function crearTemporizadorPregunta(duracion,onTimeout,onTick){
  let t=duracion, st=null, curEmoji="";
  function tick(){
    const c=document.getElementById("timer-circular"), r=40,C=2*Math.PI*r, prog=t/duracion;
    if (c){ c.style.strokeDasharray=C; c.style.strokeDashoffset=C*(1-prog); }
    const e=EMOJIS_RPG.find(x=>t>x.hasta)||EMOJIS_RPG.at(-1);
    if (e && e.emoji!==curEmoji){ curEmoji=e.emoji; const el=document.getElementById("emoji-animado"); if(el){ el.textContent=curEmoji; el.className="emoji-animado"+(curEmoji==="😱"?" shake":""); } }
    const txt=document.getElementById("timer-text"); if(txt) txt.textContent=`${t}s`;
    if(onTick) onTick(t);
  }
  tick();
  st=setInterval(()=>{ t--; tick(); if(t<=0){ clearInterval(st); onTimeout&&onTimeout(); }},1000);
  temporizadorActivo={detener:()=>clearInterval(st)}; return temporizadorActivo;
}
function limpiarTemporizadorPregunta(){ if(temporizadorActivo?.detener) temporizadorActivo.detener(); temporizadorActivo=null; }

/* ===================== SUPABASE PROGRESO ===================== */
async function cargarProgresoRPG(){
  const { data: s }=await supabase.auth.getSession(); usuarioActual=s?.session?.user; const id=usuarioActual?.id; if(!id) return null;
  const { data }=await supabase.from("rpg_progreso").select("*").eq("user_id",id).eq("ciclo",cicloActual).maybeSingle();
  return data||null;
}
async function guardarParcial({nivelMax,xp,vidasRestantes}){
  if(window.modoPractica) return;
  const { data: s }=await supabase.auth.getSession(); const u=s?.session?.user; if(!u) return;
  const m=u.user_metadata||{};
  await supabase.from("rpg_progreso").upsert([{
    user_id:u.id,ciclo:cicloActual,nivel_max:nivelMax,rango:null,xp,completado:false,estado:"en curso",vidas_restantes:vidasRestantes,
    fecha_juego:new Date().toISOString(),pais:m.pais||null,ciudad:m.ciudad||null,parroquia:m.parroquia||null
  }],{onConflict:"user_id,ciclo"});
}
async function guardarFinal({nivelMax,xp,rango}){
  if(window.modoPractica) return;
  const { data: s }=await supabase.auth.getSession(); const u=s?.session?.user; if(!u) return;
  const m=u.user_metadata||{};
  await supabase.from("rpg_progreso").upsert([{
    user_id:u.id,ciclo:cicloActual,nivel_max:nivelMax,rango,xp,completado:true,estado:"terminado",vidas_restantes:0,
    fecha_juego:new Date().toISOString(),pais:m.pais||null,ciudad:m.ciudad||null,parroquia:m.parroquia||null
  }],{onConflict:"user_id,ciclo"});
}

/* ===================== UI INICIAL ===================== */
document.addEventListener("DOMContentLoaded",async()=>{
  const { data: s }=await supabase.auth.getSession(); usuarioActual=s?.session?.user;
  if(!usuarioActual){ document.getElementById("bienvenida-stats").innerHTML="<div class='panel-mensaje'><h2>Inicia sesión para jugar la Trivia RPG.</h2></div>"; return; }
  const res=await fetch("datos/rpg-preguntas.json"); const json=await res.json(); datosCiclo=(json.ciclos||{})[cicloActual]; if(!datosCiclo){ mostrarSinCiclo(); return; }
  await prepararPantallaBienvenida(); document.getElementById("menu-rpg").classList.remove("oculto"); inicializarRPG();
});
function mostrarSinCiclo(){ document.getElementById("menu-rpg").innerHTML="<div class='panel-mensaje'><h2>No hay Trivia RPG esta semana.</h2></div>"; }

async function prepararPantallaBienvenida(){
  progresoRPG=await cargarProgresoRPG(); const cont=document.getElementById("bienvenida-stats");
  if(progresoRPG?.estado==="en curso"){ cont.innerHTML=`<div class='panel-bienvenida'><div class='rpg-bienvenido'>Sesión cerrada</div><p>XP acumulada: ${progresoRPG.xp||0} · Nivel: ${progresoRPG.nivel_max||1}</p><small>Podrás jugar la próxima semana.</small></div>`; return; }
  if(progresoRPG?.estado==="terminado"||progresoRPG?.completado){ cont.innerHTML=`<div class='panel-bienvenida'><div class='rpg-bienvenido'>Trivia completada</div><p>Rango: ${progresoRPG.rango||"-"} · XP: ${progresoRPG.xp||0}</p><button id='btn-modo-practica' class='btn-secundario'>Modo práctica</button></div>`; document.getElementById("btn-modo-practica").onclick=()=>{window.modoPractica=true; mostrarSelectorMentor();}; return; }
  cont.innerHTML=`<div class='panel-bienvenida'><div class='rpg-bienvenido'>¡Bienvenido a la Aventura RPG!</div><button id='btn-elegir-mentor' class='btn-principal'>Elegir mentor</button></div>`; document.getElementById("btn-elegir-mentor").onclick=mostrarSelectorMentor;
}

/* ===================== JUEGO ===================== */
function inicializarRPG(){
  document.getElementById("btn-comenzar").onclick=()=>{ juegoActual={nivel:1,vidas:3,pregunta:0,preguntasNivel:null,xp:0}; mostrarNivel(); };
  document.getElementById("btn-logros").onclick=mostrarLogros;
}
function mostrarSelectorMentor(){
  let html="<div class='modal-mentor'><h2>Elige tu mentor</h2><div class='mentores-lista'>";
  MENTORES.forEach(m=>{ const picks=mezclarArray([...m.habilidades]).slice(0,3); html+=`<div class='mentor-card'><img src='${m.img}' class='mentor-img'/><h3>${m.nombre}</h3><ul>${picks.map(h=>`<li>${h}</li>`).join("")}</ul><button class='btn-seleccionar-mentor' data-id='${m.id}'>Elegir</button></div>`; });
  html+="</div></div>"; const ov=document.createElement("div"); ov.id="overlay-mentor"; ov.style="position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:1000;display:flex;align-items:center;justify-content:center;"; ov.innerHTML=html; document.body.appendChild(ov);
  ov.querySelectorAll(".btn-seleccionar-mentor").forEach(b=>b.onclick=()=>{ mentorElegido=MENTORES.find(x=>x.id===b.dataset.id); habilidadesMentorPartida=mezclarArray([...mentorElegido.habilidades]).slice(0,3); bonusTiempoMentor=habilidadesMentorPartida.reduce((s,h)=>s+extraerBonusSegundos(h),0); document.body.removeChild(ov); document.getElementById("btn-comenzar").click(); });
}
function mostrarNivel(){
  const wrap=document.getElementById("juego-rpg"); wrap.classList.remove("oculto"); document.getElementById("menu-rpg").classList.add("oculto");
  const nivel=juegoActual.nivel, key=String(nivel), total=preguntasPorNivel[nivel-1]||3, preguntas=datosCiclo?.niveles?.[key]||[];
  if(!preguntas.length){ wrap.innerHTML="<div class='panel-mensaje'><h2>Sin preguntas</h2></div>"; return; }
  if(!juegoActual.preguntasNivel) juegoActual.preguntasNivel=mezclarArray([...preguntas]).slice(0,total).map(p=>({...p,opciones:mezclarArray(p.opciones)}));
  const i=juegoActual.pregunta, p=juegoActual.preguntasNivel[i];
  if(!p){ juegoActual.nivel++; if(juegoActual.nivel>preguntasPorNivel.length){ terminarAventura(true); } else { guardarParcial({nivelMax:juegoActual.nivel-1,xp:juegoActual.xp,vidasRestantes:juegoActual.vidas}); mostrarNivel(); } return; }
  wrap.innerHTML=`<div class='temporizador-panel'><svg width='90' height='90'><circle cx='45' cy='45' r='40' stroke='#f4a261' stroke-width='7' fill='none' id='timer-circular'></circle></svg><span id='emoji-animado' class='emoji-animado'>😌</span><div id='timer-text'>25s</div></div><div class='panel-pregunta'><div class='rpg-info'><span>Nivel: ${juegoActual.nivel}</span><span class='rpg-vidas'>${"❤️".repeat(juegoActual.vidas)}</span></div><div class='rpg-pregunta'><b>${p.pregunta}</b></div><div class='rpg-opciones'>${p.opciones.map((op,idx)=>`<button class='rpg-btn-op' data-i='${idx}'>${op}</button>`).join("")}</div></div>`;
  limpiarTemporizadorPregunta(); reproducirSonido("go.mp3");
  crearTemporizadorPregunta(25+bonusTiempoMentor,()=>{ juegoActual.vidas--; guardarParcial({nivelMax:juegoActual.nivel,xp:juegoActual.xp,vidasRestantes:juegoActual.vidas}); if(juegoActual.vidas<=0){ terminarAventura(false);} else { juegoActual.pregunta=i+1; mostrarNivel(); }},t=>{ if(t===13) reproducirSonido("halfway.mp3"); if(t===5) reproducirSonido("warning.mp3"); });
  wrap.querySelectorAll(".rpg-btn-op").forEach(btn=>btn.onclick=()=>{ limpiarTemporizadorPregunta(); if(p.opciones[btn.dataset.i]===p.respuesta){ btn.classList.add("acierto"); reproducirSonido("correcto.mp3"); juegoActual.xp+=juegoActual.nivel; }else{ btn.classList.add("fallo"); reproducirSonido(sonidoFalloAleatorio()); juegoActual.vidas--; } guardarParcial({nivelMax:juegoActual.nivel,xp:juegoActual.xp,vidasRestantes:juegoActual.vidas}); setTimeout(()=>{ if(juegoActual.vidas<=0) terminarAventura(false); else{ juegoActual.pregunta=i+1; mostrarNivel(); }},700); });
}
async function terminarAventura(completo){
  document.getElementById("juego-rpg").classList.add("oculto"); const panel=document.getElementById("resultados-rpg"); panel.classList.remove("oculto");
  const rango=obtenerRango(juegoActual.nivel,completo); if(!window.modoPractica) await guardarFinal({nivelMax:completo?preguntasPorNivel.length:juegoActual.nivel,xp:juegoActual.xp,rango});
  panel.innerHTML=`<h2>${completo?"¡Completaste la Trivia!":"Fin de la aventura"}</h2><p>Rango: ${rango}</p><p>XP: ${juegoActual.xp}</p><button onclick='window.location.reload()'>Volver al inicio</button>`;
}
function obtenerRango(n,completo){ if(completo) return "Maestro de la Palabra"; if(n>=5) return "Sabio de las Escrituras"; if(n===4) return "Guerrero de la Fe"; if(n===3) return "Explorador Bíblico"; if(n===2) return "Principiante"; return "Principiante"; }
function mostrarLogros(){ document.getElementById("menu-rpg").classList.add("oculto"); document.getElementById("logros-rpg").classList.remove("oculto"); document.getElementById("logros-rpg").innerHTML="<h2>Logros RPG (próximamente)</h2>"; }
