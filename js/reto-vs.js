let preguntas = [];
let indiceActual = 0;
let aciertos = 0;
let startTime, timerInterval;
let mapaEmojis = [];

const quizSection = document.getElementById('quiz-section');
const startScreen = document.getElementById('start-screen');
const resultScreen = document.getElementById('result-screen');
const btnComenzar = document.getElementById('btn-comenzar');

// 1. Inicializar Reto: Bloqueo y Carga Determinista (Mismas preguntas para todos hoy)
async function inicializarRetoDiario() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const hoy = new Date().toISOString().split('T')[0];

    // VERIFICAR BLOQUEO Y TRAER NOMBRE
    const { data: registro } = await supabase
        .from('resultados_retos')
        .select('aciertos, tiempo_segundos, mapa_respuestas, usuarios(nombre)')
        .eq('user_id', user.id)
        .eq('fecha_reto', hoy)
        .maybeSingle();

    if (registro) {
        const nombreUser = registro.usuarios ? registro.usuarios.nombre : "Discípulo";
        startScreen.innerHTML = `
            <div class="bloqueo-container">
                <h2 class="titulo-dorado">¡Buen trabajo, ${nombreUser}! 🌟</h2>
                <p>Ya cumpliste tu misión de hoy. Así va la tabla:</p>
                
                <div class="stats-box-mini">
                    <p>Tu marca: <strong>${registro.aciertos}/7</strong> en <strong>${registro.tiempo_segundos}s</strong></p>
                    <div class="ranking-mapa">${registro.mapa_respuestas}</div>
                </div>

                <div id="ranking-diario-completo">
                    <h4>🏆 Ranking del Día</h4>
                    <ul id="lista-ranking-bloqueo"></ul>
                </div>

                <button onclick="window.location.href='menu.html'" class="menu-btn" style="margin-top:20px;">Volver al Menú</button>
                <button onclick="location.reload()" class="menu-btn-refrescar">Actualizar Ranking 🔄</button>
            </div>
        `;
        cargarRanking('lista-ranking-bloqueo');
        return;
    }

    // CARGAR PREGUNTAS CON SEMILLA DIARIA
    const { data, error } = await supabase.from('preguntas').select('*');
    if (error) {
        console.error("Error cargando preguntas:", error);
    } else if (data) {
        // Generamos una semilla numérica basada en la fecha (ej: 20251219)
        const semilla = parseInt(hoy.replace(/-/g, ''));
        
        // Mezclamos el array de forma que siempre dé el mismo orden hoy
        const shuffleConSemilla = (array, seed) => {
            let m = array.length, t, i;
            while (m) {
                // Algoritmo determinista basado en el seno de la semilla
                i = Math.floor(Math.abs(Math.sin(seed++)) * m--);
                t = array[m];
                array[m] = array[i];
                array[i] = t;
            }
            return array;
        };

        const preguntasMezcladas = shuffleConSemilla([...data], semilla);
        preguntas = preguntasMezcladas.slice(0, 7);
    }
}

// 2. Iniciar el juego
btnComenzar.onclick = () => {
    if (preguntas.length < 7) {
        alert("Preparando las 7 preguntas del día...");
        return;
    }
    startScreen.style.display = 'none';
    quizSection.style.display = 'block';
    startTime = performance.now();
    
    timerInterval = setInterval(() => {
        const ahora = (performance.now() - startTime) / 1000;
        document.getElementById('timer').innerText = ahora.toFixed(1) + "s";
    }, 100);

    mostrarPregunta();
};

// 3. Mostrar Pregunta
function mostrarPregunta() {
    if (indiceActual >= preguntas.length) return finalizarReto();

    const p = preguntas[indiceActual];
    document.getElementById('texto-pregunta').innerText = p.pregunta;
    document.getElementById('progreso-llenado').style.width = `${((indiceActual + 1) / preguntas.length) * 100}%`;

    const container = document.getElementById('opciones-container');
    container.innerHTML = "";

    const listaDistractores = p.distractores.split(',').map(item => item.trim());
    const opciones = [...listaDistractores, p.respuesta_correcta].sort(() => Math.random() - 0.5);

    opciones.forEach(op => {
        const btn = document.createElement('button');
        btn.innerText = op;
        btn.className = "btn-opcion";
        btn.onclick = () => verificarRespuesta(op, p.respuesta_correcta);
        container.appendChild(btn);
    });
}

// 4. Verificar respuesta
function verificarRespuesta(elegida, correcta) {
    if (elegida === correcta) {
        aciertos++;
        mapaEmojis.push("✅");
    } else {
        mapaEmojis.push("❌");
    }
    indiceActual++;
    mostrarPregunta();
}

// 5. Finalizar y mostrar botón de compartir
async function finalizarReto() {
    clearInterval(timerInterval);
    const tiempoTotal = ((performance.now() - startTime) / 1000).toFixed(2);
    const stringMapa = mapaEmojis.join("");

    quizSection.style.display = 'none';
    resultScreen.style.display = 'block';

    document.getElementById('final-aciertos').innerText = `${aciertos}/7`;
    document.getElementById('final-tiempo').innerText = tiempoTotal + "s";

    // Botón Compartir
    const shareBtn = document.createElement('button');
    shareBtn.className = 'menu-btn';
    shareBtn.style.background = '#25D366';
    shareBtn.innerText = 'Compartir Resultado 💬';
    shareBtn.onclick = () => compartirResultado(aciertos, tiempoTotal, stringMapa);
    resultScreen.insertBefore(shareBtn, resultScreen.lastElementChild);

    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
        const hoy = new Date().toISOString().split('T')[0];
        await supabase.from('resultados_retos').insert([{ 
            user_id: user.id, 
            aciertos: aciertos, 
            tiempo_segundos: parseFloat(tiempoTotal),
            fecha_reto: hoy,
            mapa_respuestas: stringMapa 
        }]);
    }
    
    cargarRanking('lista-ranking');
}

// 6. Ranking dinámico (Join con tabla usuarios para mostrar nombres)
async function cargarRanking(idLista = 'lista-ranking') {
    const hoy = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('resultados_retos') 
        .select(`
            aciertos, 
            tiempo_segundos, 
            mapa_respuestas, 
            usuarios ( nombre )
        `)
        .eq('fecha_reto', hoy)
        .order('aciertos', { ascending: false })
        .order('tiempo_segundos', { ascending: true })
        .limit(10);

    if (error) return console.error("Error ranking:", error);

    const lista = document.getElementById(idLista);
    if (!lista) return;

    lista.innerHTML = data.map((res, i) => {
        const nombreUser = res.usuarios ? res.usuarios.nombre : "Anónimo";
        return `
        <li class="ranking-item">
            <div class="ranking-info">
                <strong>#${i+1} ${nombreUser}</strong>
                <span>${res.aciertos}/7 - ${res.tiempo_segundos}s</span>
            </div>
            <div class="ranking-mapa">${res.mapa_respuestas}</div>
        </li>`;
    }).join('');
}

// 7. Compartir estilo Wordle
function compartirResultado(pts, sec, emojis) {
    const texto = `Reto Bíblico Diario 📖\nResultado: ${pts}/7\n${emojis}\nTiempo: ${sec}s\n¡Supérame en Camino Bíblico! 🚀`;
    if (navigator.share) {
        navigator.share({ title: 'Reto VS', text: texto });
    } else {
        navigator.clipboard.writeText(texto);
        alert("¡Copiado al portapapeles!");
    }
}

inicializarRetoDiario();
