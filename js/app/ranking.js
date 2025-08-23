// ====== CONFIG ======
const TZ = "America/Santo_Domingo";

// Espera hasta que window.supabase esté listo (por si tarda en cargar)
function waitForSupabase(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function spin(){
      if (window.supabase) return resolve(window.supabase);
      if (Date.now() - start > timeoutMs) return reject(new Error('Supabase no cargó. Revisa <script src="supabase.js"> y la ruta.'));
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
  const x = hoyDO(); x.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); x.setHours(0,0,0,0);
  x.setDate(x.getDate() - x.getDay()); return x;
}
const domingoISO = isoDateDO(domingoDe(hoyDO()));

// ====== UI REFS ======
const tabWordle = document.getElementById("tab-wordle");
const tabGlobal = document.getElementById("tab-global");
const segBtns = [...document.querySelectorAll(".seg-btn")];
const inputValor = document.getElementById("valor");
const inputBuscar = document.getElementById("buscar");
const podioEl = document.getElementById("podio");
const theadEl = document.getElementById("thead");
const tbodyEl = document.getElementById("tbody");
const emptyEl = document.getElementById("empty");
const moreWrap = document.getElementById("more-wrap");
const moreBtn = document.getElementById("more");

const youRankEl = document.getElementById("you-rank");
const youWrpEl  = document.getElementById("you-wrp");
const youXpEl   = document.getElementById("you-xp");

const toastEl = document.getElementById("toast");

// ====== ESTADO ======
let sb = null;
let user = null;
let mode = "wordle";        // "wordle" | "global"
let scope = "global";       // "global" | "parroquia" | "subgrupo"
let valor = null;
let limit = 200;
let dataRows = [];

// ====== AUTH (anónimo) ======
async function ensureAuth() {
  const { data: g } = await sb.auth.getUser();
  if (!g?.user) {
    const { error } = await sb.auth.signInAnonymously();
    if (error) console.error("Auth anónima falló:", error);
  }
  const { data: g2 } = await sb.auth.getUser();
  return g2?.user || null;
}

// ====== INIT ======
(async function init(){
  try { sb = await waitForSupabase(); } catch(e){ console.error(e); alert(e.message); return; }
  user = await ensureAuth();

  // Tabs
  tabWordle.addEventListener("click", ()=> switchTab("wordle"));
  tabGlobal .addEventListener("click", ()=> switchTab("global"));

  // Scope
  segBtns.forEach(b=>{
    b.addEventListener("click", ()=>{
      segBtns.forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      scope = b.dataset.scope;                 // ahora puede ser 'subgrupo'
      inputValor.disabled = (scope === "global");
      fetchAndRender(true);
    });
  });
  inputValor.addEventListener("input", ()=>{
    valor = inputValor.value.trim() || null;
    fetchAndRender(true);
  });
  inputBuscar.addEventListener("input", renderTable);
  moreBtn.addEventListener("click", ()=> { limit += 200; fetchAndRender(true); });

  // Primera carga
  switchTab("wordle");
})();

// ====== TABS ======
async function switchTab(next){
  mode = next;
  tabWordle.classList.toggle("active", mode==="wordle");
  tabGlobal.classList.toggle("active", mode==="global");
  podioEl.classList.toggle("hidden", mode!=="wordle");
  limit = 200;
  await fetchAndRender(true);
}

// ====== FETCH ======
async function fetchAndRender(reset=false){
  showLoading();
  try{
    if (mode === "wordle"){
      // 👉 usa la nueva función v2 con 'subgrupo' y nombres
      const { data, error } = await sb.rpc("get_wordle_leaderboard_v2", {
        p_semana: domingoISO,
        p_scope: scope,
        p_valor: scope==="global" ? null : (valor || null),
        p_limit: limit
      });
      if (error) throw error;
      dataRows = data || [];

      // Cabecera
      theadEl.innerHTML = `
        <div class="cell center">#</div>
        <div>Jugador</div>
        <div class="cell center">WRP</div>
        <div class="cell center">Aciertos</div>
        <div class="cell center">Intentos prom.</div>`;

      // Podio + "Tú"
      renderPodio(dataRows.slice(0,3));
      await renderYouCardWordle(dataRows);
    } else {
      // 👉 usa el nuevo RPC global con nombres
      const { data, error } = await sb.rpc("get_global_leaderboard", {
        p_semana: domingoISO,
        p_scope: scope,
        p_valor: scope==="global" ? null : (valor || null),
        p_limit: limit
      });
      if (error) {
        tabGlobal.classList.add("hidden");
        toast("Global no disponible (vista/resumen no encontrado).");
        switchTab("wordle");
        return;
      }
      dataRows = data || [];

      theadEl.innerHTML = `
        <div class="cell center">#</div>
        <div>Jugador</div>
        <div class="cell center">XP total</div>
        <div class="cell center">WRP (sem.)</div>
        <div class="cell center">Intentos prom.</div>`;

      podioEl.classList.add("hidden");
      renderYouCardGlobal(dataRows);
    }

    renderTable();
  }catch(e){
    console.error(e);
    toast("No se pudo cargar el ranking.");
  }finally{
    hideLoading();
  }
}

// ====== RENDER PODIO ======
function renderPodio(top3){
  if (!top3 || top3.length===0){ podioEl.classList.add("hidden"); return; }
  podioEl.classList.remove("hidden");
  podioEl.innerHTML = top3.map((r)=> `
    <div class="p">
      <div class="rank">#${r.pos}</div>
      <div class="name">${escapeHTML(r.nombre || "Jugador")}</div>
      <div class="meta">${escapeHTML(r.parroquia||"—")} • ${escapeHTML(r.subgrupo||"—")}</div>
      <div class="num">${r.wrp_total}</div>
      <div class="meta">WRP</div>
    </div>
  `).join("");
}

// ====== RENDER TABLA ======
function renderTable(){
  const q = (inputBuscar.value||"").toLowerCase();
  let rows = dataRows;
  if (q) rows = rows.filter(r => (r.nombre||"").toLowerCase().includes(q));

  emptyEl.classList.toggle("hidden", rows.length>0);
  tbodyEl.innerHTML = rows.map((r, idx)=> {
    const isYou = user && r.user_id === user.id;
    if (mode==="wordle"){
      return `
        <div class="row ${isYou?"you":""}">
          <div class="cell center">#${r.pos ?? (idx+1)}</div>
          <div>
            <div><strong>${escapeHTML(r.nombre||"Jugador")}</strong>${isYou?' <span class="tag">Tú</span>':''}</div>
            <div class="muted tiny">${escapeHTML(r.parroquia||"—")} • ${escapeHTML(r.subgrupo||"—")}</div>
          </div>
          <div class="cell center"><strong>${r.wrp_total}</strong></div>
          <div class="cell center">${r.aciertos}</div>
          <div class="cell center">${Number(r.prom_intentos||0).toFixed(2)}</div>
        </div>`;
    } else {
      return `
        <div class="row ${isYou?"you":""}">
          <div class="cell center">#${r.pos ?? (idx+1)}</div>
          <div>
            <div><strong>${escapeHTML(r.nombre||"Jugador")}</strong>${isYou?' <span class="tag">Tú</span>':''}</div>
            <div class="muted tiny">${escapeHTML(r.parroquia||"—")} • ${escapeHTML(r.subgrupo||"—")}</div>
          </div>
          <div class="cell center"><strong>${r.xp_total_semana}</strong></div>
          <div class="cell center">${r.wrp_wordle_semana ?? "—"}</div>
          <div class="cell center">${Number(r.wordle_prom_intentos||0).toFixed(2)}</div>
        </div>`;
    }
  }).join("");
}

// ====== RENDER YOU CARD (Wordle) ======
async function renderYouCardWordle(list){
  if (!user){ youRankEl.textContent="—"; youWrpEl.textContent="—"; youXpEl.textContent="—"; return; }
  const idx = list.findIndex(r => r.user_id === user.id);
  if (idx >= 0){
    const row = list[idx];
    youRankEl.textContent = `#${row.pos} / ${list.length}`;
    youWrpEl.textContent  = row.wrp_total ?? "0";
    youXpEl.textContent   = row.xp_total ?? "0";
  } else {
    const { data, error } = await sb
      .from("wordle_v_semana")
      .select("wrp_total, xp_total, prom_intentos, aciertos")
      .eq("semana_id", domingoISO)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) { console.warn(error); }
    youRankEl.textContent = `Fuera del top ${list.length}`;
    youWrpEl.textContent  = data?.wrp_total ?? "0";
    youXpEl.textContent   = data?.xp_total ?? "0";
  }
}

// ====== RENDER YOU CARD (Global) ======
function renderYouCardGlobal(list){
  if (!user){ youRankEl.textContent="—"; youWrpEl.textContent="—"; youXpEl.textContent="—"; return; }
  const idx = list.findIndex(r => r.user_id === user.id);
  if (idx >= 0){
    const row = list[idx];
    youRankEl.textContent = `#${row.pos} / ${list.length}`;
    youWrpEl.textContent  = row.wrp_wordle_semana ?? "0";
    youXpEl.textContent   = row.xp_total_semana ?? "0";
  } else {
    youRankEl.textContent = `Fuera del top ${list.length}`;
    youWrpEl.textContent  = "—";
    youXpEl.textContent   = "—";
  }
}

// ====== HELPERS ======
function showLoading(){
  tbodyEl.innerHTML = Array.from({length:6}).map(()=>`
    <div class="row">
      <div class="cell center">…</div>
      <div>
        <div class="skeleton" style="width:140px;height:10px;margin:6px 0;background:#e5e7eb;border-radius:6px;"></div>
        <div class="skeleton" style="width:100px;height:8px;background:#eef2f7;border-radius:6px;"></div>
      </div>
      <div class="cell center"><div class="skeleton" style="width:40px;height:10px;margin:6px auto;background:#e5e7eb;border-radius:6px;"></div></div>
      <div class="cell center"><div class="skeleton" style="width:40px;height:10px;margin:6px auto;background:#e5e7eb;border-radius:6px;"></div></div>
      <div class="cell center"><div class="skeleton" style="width:60px;height:10px;margin:6px auto;background:#e5e7eb;border-radius:6px;"></div></div>
    </div>
  `).join("");
  emptyEl.classList.add("hidden");
}
function hideLoading(){ /* no-op */ }
function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  setTimeout(()=> toastEl.classList.add("hidden"), 2500);
}
function escapeHTML(s){ return (s??"").replace(/[&<>"']/g, m=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
