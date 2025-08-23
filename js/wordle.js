// === CONFIG ===
const TZ = "America/Santo_Domingo";
const MAX_INTENTOS = 6;
const DATA_URL = "datos/wordle-semanas.json";

// Espera hasta que window.supabase esté listo (evita getUser sobre undefined)
function waitForSupabase(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function spin(){
      if (window.supabase) return resolve(window.supabase);
      if (Date.now() - start > timeoutMs) return reject(new Error("Supabase no cargó (revisa <script src=\"supabase.js\"> y la ruta)"));
      requestAnimationFrame(spin);
    })();
  });
}

// ====== FECHAS (TZ RD) ======
const hoyDO = () => new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
function isoDateDO(d) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(d).reduce((acc,p)=> (acc[p.type]=p.value, acc), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function domingoDe(d) {
  const x = hoyDO();
  x.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
  x.setHours(0,0,0,0);
  const dow = x.getDay(); // 0=Dom
  x.setDate(x.getDate() - dow);
  return x;
}

// ====== NORMALIZACIÓN (ES) ======
const normalize = s => (s||"")
  .toUpperCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/Á/g,"A").replace(/É/g,"E").replace(/Í/g,"I").replace(/Ó/g,"O").replace(/Ú/g,"U")
  .replace(/Ü/g,"U");

// ====== UI refs ======
const gridEl = document.getElementById("grid");
const tecladoEl = document.getElementById("teclado");
const temaEl = document.getElementById("tema");
const citaEl = document.getElementById("cita");
const xpEl = document.getElementById("xp");
const rachaEl = document.getElementById("racha");
const pistaEl = document.getElementById("pista-texto");
const btnPista = document.getElementById("btn-pista");
const modal = document.getElementById("modal");
const resumenEl = document.getElementById("resumen");
document.getElementById("cerrar").onclick = () => modal.classList.add("hidden");

// ====== Estado ======
let sb = null;                 // ← se setea tras waitForSupabase()
let solucion = "";
let longitud = 5;
let intentoIdx = 0;
let terminado = false;
let pistasUsadas = 0;
let hardMode = false;
let keyState = {};
let startTime = Date.now();
const filasRef = [];
const filasTeclado = [
  "Q W E R T Y U I O P".split(" "),
  "A S D F G H J K L Ñ".split(" "),
  ["ENTER", ..."Z X C V B N M".split(" "), "BORRAR"]
];

// ====== Auth (anónimo) ======
async function ensureAuth() {
  const { data: g } = await sb.auth.getUser();
  if (!g?.user) {
    const { error } = await sb.auth.signInAnonymously();
    if (error) {
      console.error("Auth anónima falló:", error);
      alert("No se pudo iniciar sesión (anónimo). Revisa Auth → Anonymous en Supabase.");
    }
  }
}

// ====== Init ======
(async function init(){
  try {
    sb = await waitForSupabase();          // ← ahora sb está listo
  } catch (e) {
    console.error(e);
    alert(e.message);
    return;
  }
  await ensureAuth();

  const cfg = await fetch(DATA_URL, { cache: "no-store" }).then(r => r.json());
  const hoy = hoyDO();
  const semana = pickSemana(cfg.semanas, hoy);
  const item = semana.dias.find(d => d.dow === hoy.getDay()) || semana.dias[0];

  temaEl.textContent = `${semana.tema}`;
  citaEl.textContent = `${item.cita}`;
  solucion = normalize(item.palabra);
  longitud = solucion.length;
  gridEl.style.setProperty("--n", longitud);

  for (let r=0; r<MAX_INTENTOS; r++){
    const row = document.createElement("div");
    row.className = "row";
    for (let c=0; c<longitud; c++){
      const t = document.createElement("div");
      t.className = "tile";
      row.appendChild(t);
    }
    gridEl.appendChild(row);
    filasRef.push(row);
  }

  renderTeclado();

  btnPista.addEventListener("click", ()=>{
    if (btnPista.disabled) return;
    pistasUsadas++;
    pistaEl.textContent = `Pista: ${item.pista}`;
    btnPista.disabled = true;
  });

  const last = localStorage.getItem("wb:last");
  const prev = localStorage.getItem("wb:streak") || "0";
  const todayISO = isoDateDO(hoy);
  if (last && last !== todayISO) {
    const y = new Date(last);
    const diff = (hoy - y) / 86400000;
    const newStreak = diff <= 2 ? (parseInt(prev,10) || 0) : 0;
    localStorage.setItem("wb:streak", String(newStreak));
  }
  rachaEl.textContent = localStorage.getItem("wb:streak") || "0";

  window.addEventListener("keydown", onKey);
})();

// ====== Semana activa desde JSON ======
function pickSemana(semanas, d){
  const domHoy = isoDateDO(domingoDe(d));
  const exact = semanas.find(s => s.domingo === domHoy);
  if (exact) return exact;
  const past = [...semanas].filter(s => s.domingo <= domHoy).sort((a,b)=> a.domingo < b.domingo ? 1 : -1);
  return past[0] || semanas[0];
}

// ====== Teclado ======
function renderTeclado(){
  tecladoEl.innerHTML = "";
  filasTeclado.forEach(row=>{
    const r = document.createElement("div"); r.className = "krow";
    row.forEach(k=>{
      const b = document.createElement("div");
      b.className = "key" + (k==="ENTER"||k==="BORRAR" ? " action": "");
      b.textContent = k;
      b.addEventListener("click", ()=> pressKey(k));
      r.appendChild(b);
    });
    tecladoEl.appendChild(r);
  });
  syncKeyColors();
}

function onKey(e){
  const key = e.key.toUpperCase();
  if (/^[A-ZÑ]$/.test(key)) pressKey(key);
  else if (key === "BACKSPACE") pressKey("BORRAR");
  else if (key === "ENTER") pressKey("ENTER");
}

function pressKey(k){
  if (terminado) return;
  const row = filasRef[intentoIdx];
  const tiles = [...row.children];

  if (k==="ENTER"){
    const word = tiles.map(t => t.textContent).join("");
    if (word.length !== longitud) return;
    evaluar(word);
    return;
  }
  if (k==="BORRAR"){
    for (let i=longitud-1;i>=0;i--) {
      if (tiles[i].textContent){ tiles[i].textContent = ""; break; }
    }
    return;
  }
  if (/^[A-ZÑ]$/.test(k)){
    for (let i=0;i<longitud;i++){
      if (!tiles[i].textContent){
        tiles[i].textContent = k;
        break;
      }
    }
  }
}

// ====== Evaluación ======
function evaluar(guessRaw){
  const guess = normalize(guessRaw);
  const res = Array(longitud).fill("no");
  const count = {};
  for (const ch of solucion) count[ch] = (count[ch] || 0) + 1;

  for (let i=0;i<longitud;i++){
    if (guess[i] === solucion[i]){ res[i] = "ok"; count[guess[i]]--; }
  }
  for (let i=0;i<longitud;i++){
    if (res[i] !== "no") continue;
    const ch = guess[i];
    if ((count[ch]||0) > 0){ res[i] = "mid"; count[ch]--; }
  }

  const row = filasRef[intentoIdx];
  const tiles = [...row.children];
  for (let i=0;i<longitud;i++){
    tiles[i].className = "tile " + res[i];
    tiles[i].innerHTML = `${guess[i] || ""}<span class="icon">${res[i]==="ok"?"✓":res[i]==="mid"?"•":"×"}</span>`;
  }

  for (let i=0;i<longitud;i++){
    const ch = guess[i];
    keyState[ch] = bestState(keyState[ch], res[i]);
  }
  syncKeyColors();

  if (intentoIdx >= 1 && pistasUsadas === 0){
    pistaEl.textContent = "Pista disponible";
    btnPista.disabled = false;
  }

  const acierto = res.every(x => x==="ok");
  intentoIdx++;

  if (acierto || intentoIdx === MAX_INTENTOS){
    terminar(acierto);
  }
}

function bestState(prev, now){
  const p = { ok:3, mid:2, no:1, undefined:0 };
  return (p[now] > p[prev]) ? now : prev;
}

function syncKeyColors(){
  [...tecladoEl.querySelectorAll(".key")].forEach(k=>{
    const label = k.textContent;
    if (label==="ENTER"||label==="BORRAR") return;
    const st = keyState[label];
    k.classList.remove("ok","mid","no");
    if (st) k.classList.add(st);
  });
}

function gridToJSON(){
  const rows = [];
  for (let r=0;r<intentoIdx;r++){
    const tiles = [...filasRef[r].children];
    rows.push({
      guess: tiles.map(t => t.textContent).join(""),
      result: tiles.map(t =>
        t.classList.contains("ok") ? "ok" :
        t.classList.contains("mid") ? "mid" : "no"
      )
    });
  }
  return rows;
}

// ====== Finalizar → RPC ======
async function terminar(acierto){
  terminado = true;
  window.removeEventListener("keydown", onKey);

  const hoy = hoyDO();
  const fechaISO = isoDateDO(hoy);
  const esDomingo = hoy.getDay() === 0;

  let xpPreview = 0;
  if (acierto){ xpPreview = 10 + (intentoIdx <= 3 ? 5 : 0) + Math.max(0, 6 - intentoIdx); }
  xpEl.textContent = `+${xpPreview}`;

  localStorage.setItem("wb:last", fechaISO);
  const streak = parseInt(localStorage.getItem("wb:streak")||"0",10);
  localStorage.setItem("wb:streak", String(acierto ? (streak+1) : 0));
  rachaEl.textContent = localStorage.getItem("wb:streak");

  const payload = {
    p_fecha: fechaISO,
    p_palabra: solucion,
    p_tema: document.getElementById("tema").textContent,
    p_cita: document.getElementById("cita").textContent,
    p_intentos: intentoIdx,
    p_acierto: acierto,
    p_pistas: pistasUsadas,
    p_hard: hardMode,
    p_tiempo_seg: Math.round((Date.now() - startTime)/1000),
    p_grid: gridToJSON(),
    p_domingo: esDomingo
  };

  try{
    const { data, error } = await sb.rpc("registrar_wordle_jugada", payload);
    if (error) throw error;
    const wrp = data.wrp;
    const xp = data.xp_otorgado;
    xpEl.textContent = `+${xp}`;
    resumenEl.textContent = (acierto ? "¡Bien! " : "Terminaste. ") + `WRP: ${wrp} • XP: +${xp}`;
  }catch(e){
    console.error(e);
    resumenEl.textContent = (acierto ? "¡Bien! " : "Terminaste. ") + "No se pudo enviar a Supabase (se intentará luego).";
  }finally{
    modal.classList.remove("hidden");
  }
}
