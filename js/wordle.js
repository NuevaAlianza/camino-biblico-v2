// === CONFIG ===
const TZ = "America/Santo_Domingo";
const MAX_INTENTOS = 6;
const DATA_URL = "datos/wordle-semanas.json";

// Espera hasta que window.supabase esté listo
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
let sb = null;
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

// 👇 nuevos helpers
let uid = null;
let todayISO = "";

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
    sb = await waitForSupabase();
  } catch (e) {
    console.error(e);
    alert(e.message);
    return;
  }
  await ensureAuth();
  const { data: g } = await sb.auth.getUser();
  uid = g.user.id;

  const cfg = await fetch(DATA_URL, { cache: "no-store" }).then(r => r.json());
  const hoy = hoyDO();
  todayISO = isoDateDO(hoy);
  const semana = pickSemana(cfg.semanas, hoy);
  const item = semana.dias.find(d => d.dow === hoy.getDay()) || semana.dias[0];

  temaEl.textContent = `${semana.tema}`;
  citaEl.textContent = `${item.cita}`;
  solucion = normalize(item.palabra);
  longitud = solucion.length;
  gridEl.style.setProperty("--n", longitud);

  // ====== Candado Wordle diario ======
  let { data: jugada, error: qErr } = await sb
    .from("wordle_jugadas")
    .select("*")
    .eq("user_id", uid)
    .eq("fecha", todayISO)
    .maybeSingle();
  if (qErr) console.error("Error buscando jugada de hoy:", qErr);

  if (!jugada) {
    const { error: insErr } = await sb
      .from("wordle_jugadas")
      .insert([{
        user_id: uid,
        fecha: todayISO,
        semana_id: semana.domingo,
        palabra: solucion,
        tema: semana.tema,
        cita: item.cita,
        intentos: 0,
        acierto: false,
        pistas_usadas: 0,
        hard_mode: false,
        tiempo_seg: 0,
        grid: [],
        estado: "en curso"
      }]);
    if (insErr) console.error("Error creando jugada en curso:", insErr);
  } else if (jugada.estado === "terminado") {
    terminado = true;
    modal.classList.remove("hidden");
    resumenEl.textContent = `Ya jugaste hoy. WRP: ${jugada.wrp} • XP: +${jugada.xp_otorgado}`;
    return;
  } else {
    intentoIdx = jugada.intentos || 0;
    pistasUsadas = jugada.pistas_usadas || 0;
  }

  // grid vacío
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

  // restaurar si ya había jugada en curso
  if (jugada && jugada.grid && jugada.grid.length) {
    restoreFromDB(jugada);
  }

  btnPista.addEventListener("click", ()=>{
    if (btnPista.disabled) return;
    pistasUsadas++;
    pistaEl.textContent = `Pista: ${item.pista}`;
    btnPista.disabled = true;
  });

  const last = localStorage.getItem("wb:last");
  const prev = localStorage.getItem("wb:streak") || "0";
  if (last && last !== todayISO) {
    const y = new Date(last);
    const diff = (hoy - y) / 86400000;
    const newStreak = diff <= 2 ? (parseInt(prev,10) || 0) : 0;
    localStorage.setItem("wb:streak", String(newStreak));
  }
  rachaEl.textContent = localStorage.getItem("wb:streak") || "0";

  window.addEventListener("keydown", onKey);
})();

// ====== Semana activa ======
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
  } else {
    savePartialProgress();
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
    const letters = tiles.map(t => t.textContent.replace(/[✓•×]/g,"").slice(0,1) || "");
    const result = tiles.map(t =>
      t.classList.contains("ok") ? "ok" :
      t.classList.contains("mid") ? "mid" : "no"
    );
    rows.push({ guess: letters.join(""), result });
  }
  return rows;
}

// ====== Guardar progreso parcial ======
async function savePartialProgress() {
  try {
    await sb
      .from("wordle_jugadas")
      .update({
        intentos: intentoIdx,
        pistas_usadas: pistasUsadas,
        tiempo_seg: Math.round((Date.now() - startTime)/1000),
        grid: gridToJSON()
      })
      .eq("user_id", uid)
      .eq("fecha", todayISO);
  } catch (e) {
    console.error("Error guardando progreso parcial:", e);
  }
}

// ====== Restaurar desde DB ======
function restoreFromDB(jugada){
  jugada.grid.forEach((g, rIndex) => {
    if (!filasRef[rIndex]) return;
    const row = filasRef[rIndex];
    const clean = (g.guess || "").replace(/[✓•×]/g,"");
    const letters = clean.split("");
    for (let c=0; c<Math.min(letters.length, longitud); c++){
      const tile = row.children[c];
      const res = g.result?.[c] || "no";
      tile.className = "tile " + res;
      tile.innerHTML = `${letters[c] || ""}<span class="icon">${
        res==="ok" ? "✓" : res==="mid" ? "•" : "×"
      }</span>`;
      keyState[letters[c]] = bestState(keyState[letters[c]], res);
    }
  });
  syncKeyColors();
}

// ====== Finalizar ======
async function terminar(acierto){
  terminado = true;
  window.removeEventListener("keydown", onKey);

  const hoy = hoyDO();
  const fechaISO = isoDateDO(hoy);

  let xp = 0;
  if (acierto){ xp = 10 + (intentoIdx <= 3 ? 5 : 0) + Math.max(0, 6 - intentoIdx); }
  const wrp = xp * 4; // provisional

  xpEl.textContent = `+${xp}`;

  localStorage.setItem("wb:last", fechaISO);
  const streak = parseInt(localStorage.getItem("wb:streak")||"0",10);
  localStorage.setItem("wb:streak", String(acierto ? (streak+1) : 0));
  rachaEl.textContent = localStorage.getItem("wb:streak");

  try{
    const { data, error } = await sb
      .from("wordle_jugadas")
      .update({
        intentos: intentoIdx,
        acierto: acierto,
        pistas_usadas: pistasUsadas,
        hard_mode: hardMode,
        tiempo_seg: Math.round((Date.now() - startTime)/1000),
        grid: gridToJSON(),
        xp_otorgado: xp,
        wrp: wrp,
        estado: "terminado"
      })
      .eq("user_id", uid)
      .eq("fecha", fechaISO)
      .select()
      .single();

    if (error) throw error;

    resumenEl.textContent =
      (acierto ? "¡Bien! " : "Terminaste. ") + `WRP: ${data.wrp} • XP: +${data.xp_otorgado}`;

  }catch(e){
    console.error(e);
    resumenEl.textContent =
      (acierto ? "¡Bien! " : "Terminaste. ") + "No se pudo actualizar en Supabase.";
  }finally{
    modal.classList.remove("hidden");
  }
}
