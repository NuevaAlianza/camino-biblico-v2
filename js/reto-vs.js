let preguntas = [];
let indiceActual = 0;
let aciertos = 0;
let startTime, timerInterval;
let mapaEmojis = []; // Nuevo: para registrar ✅ y ❌

const quizSection = document.getElementById('quiz-section');
const startScreen = document.getElementById('start-screen');
const resultScreen = document.getElementById('result-screen');
const btnComenzar = document.getElementById('btn-comenzar');

// 1. Verificar si ya jugó y cargar 7 preguntas aleatorias
async function inicializarRetoDiario() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const hoy = new Date().toISOString().split('T')[0];

    // VERIFICAR BLOQUEO
    const { data: registro } = await supabase
        .from('resultados_retos')
        .select('id')
        .eq('user_id', user.id)
        .eq('fecha_reto', hoy)
        .maybeSingle();

    if (registro) {
        // Si ya existe registro, bloqueamos el inicio
        startScreen.innerHTML = `
            <h2>Reto Cumplido 🌟</h2>
            <p>Ya participaste en el reto de hoy. ¡Vuelve mañana!</p>
            <div id="ranking-inmediato"></div>
        `;
        cargarRanking();
        return;
    }

    // CARGAR 7 PREGUNTAS
    const { data, error } = await supabase
        .from('preguntas')
        .select('*');

    if (error) {
        console.error("Error cargando preguntas:", error);
    } else {
        // Mezclar y tomar 7
        preguntas = data.sort(() => 0.5 - Math.random()).slice(0, 7);
    }
}

// 2. Iniciar el juego
btnComenzar.onclick = () => {
    if (preguntas.length < 7) {
        alert("Preparando las 7 preguntas del reto...");
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
    
    // Progreso visual (sobre 7)
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

// 4. Verificar y registrar en el mapa
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

// 5. Finalizar y enviar Mapa de Emojis
async function finalizarReto() {
    clearInterval(timerInterval);
    const tiempoTotal = ((performance.now() - startTime) / 1000).toFixed(2);
    const stringMapa = mapaEmojis.join(""); // Convertimos el array en string "✅❌✅..."

    quizSection.style.display = 'none';
    resultScreen.style.display = 'block';

    document.getElementById('final-aciertos').innerText = `${aciertos}/7`;
    document.getElementById('final-tiempo').innerText = tiempoTotal + "s";

    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
        const hoy = new Date().toISOString().split('T')[0];
        const { error } = await supabase
            .from('resultados_retos')
            .insert([
                { 
                    user_id: user.id, 
                    aciertos: aciertos, 
                    tiempo_segundos: parseFloat(tiempoTotal),
                    fecha_reto: hoy,
                    mapa_respuestas: stringMapa // Guardamos el mapa
                }
            ]);

        if (error) console.error("Error al guardar:", error);
    }
    
    cargarRanking();
}

// 6. Ranking con el mapa visual
async function cargarRanking() {
    const { data, error } = await supabase
        .from('resultados_retos') 
        .select(`aciertos, tiempo_segundos, mapa_respuestas, user_id`)
        .eq('fecha_reto', new Date().toISOString().split('T')[0]) // Solo hoy
        .order('aciertos', { ascending: false })
        .order('tiempo_segundos', { ascending: true })
        .limit(10);

    if (error) return console.error("Error ranking:", error);

    const lista = document.getElementById('lista-ranking');
    lista.innerHTML = data.map((res, i) => 
        `<li class="ranking-item">
            <div class="ranking-info">
                <strong>#${i+1} - ${res.aciertos}/7</strong> en ${res.tiempo_segundos}s
            </div>
            <div class="ranking-mapa">${res.mapa_respuestas}</div>
        </li>`
    ).join('');
}

inicializarRetoDiario();
