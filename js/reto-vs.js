let preguntas = [];
let indiceActual = 0;
let aciertos = 0;
let startTime, timerInterval;

const quizSection = document.getElementById('quiz-section');
const startScreen = document.getElementById('start-screen');
const resultScreen = document.getElementById('result-screen');

// 1. Obtener 5 preguntas aleatorias del día
async function cargarPreguntasDelDia() {
    // Si guardaste preguntas en localStorage desde el menú (auth.js), las usamos
    const guardadas = localStorage.getItem('preguntas_duelo_activa');
    
    if (guardadas) {
        preguntas = JSON.parse(guardadas);
        localStorage.removeItem('preguntas_duelo_activa');
    } else {
        // Si no hay guardadas, pedimos 5 a Supabase directamente
        const { data, error } = await supabase
            .from('preguntas')
            .select('*')
            .limit(5);

        if (error) console.error("Error cargando preguntas:", error);
        else preguntas = data;
    }
}

// 2. Iniciar el juego
document.getElementById('btn-comenzar').onclick = () => {
    if (preguntas.length === 0) {
        alert("Cargando preguntas, por favor espera un segundo...");
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

// 3. MOSTRAR PREGUNTA (SECCIÓN MODIFICADA)
function mostrarPregunta() {
    if (indiceActual >= preguntas.length) return finalizarReto();

    const p = preguntas[indiceActual];
    document.getElementById('texto-pregunta').innerText = p.pregunta;
    
    document.getElementById('progreso-llenado').style.width = `${((indiceActual + 1) / preguntas.length) * 100}%`;

    const container = document.getElementById('opciones-container');
    container.innerHTML = "";

    // --- EL CAMBIO ESTÁ AQUÍ ---
    // Convertimos el texto "Opción 1, Opción 2" en una lista real
    const listaDistractores = p.distractores.split(',').map(item => item.trim());

    // Unir la correcta con los distractores y mezclar
    const opciones = [...listaDistractores, p.respuesta_correcta].sort(() => Math.random() - 0.5);

    opciones.forEach(op => {
        const btn = document.createElement('button');
        btn.innerText = op;
        btn.className = "btn-opcion";
        btn.onclick = () => verificarRespuesta(op, p.respuesta_correcta);
        container.appendChild(btn);
    });
}

// 4. Verificar y Siguiente
function verificarRespuesta(elegida, correcta) {
    if (elegida === correcta) aciertos++;
    indiceActual++;
    mostrarPregunta();
}

// 5. Finalizar y enviar a Supabase
async function finalizarReto() {
    clearInterval(timerInterval);
    const endTime = performance.now();
    const tiempoTotal = ((endTime - startTime) / 1000).toFixed(2);

    quizSection.style.display = 'none';
    resultScreen.style.display = 'block';

    document.getElementById('final-aciertos').innerText = aciertos;
    document.getElementById('final-tiempo').innerText = tiempoTotal;

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
                    fecha_reto: hoy
                }
            ]);

        if (error) console.error("Error al guardar:", error);
    }
    
    cargarRanking();
}

// 6. Cargar Ranking (Usa la Vista si la creaste, o la tabla directa)
async function cargarRanking() {
    // Si creaste la vista 'ranking_duelo', cambia el nombre aquí
    const { data, error } = await supabase
        .from('resultados_retos') 
        .select(`aciertos, tiempo_segundos, user_id`)
        .order('aciertos', { ascending: false })
        .order('tiempo_segundos', { ascending: true })
        .limit(5);

    if (error) {
        console.error("Error ranking:", error);
        return;
    }

    const lista = document.getElementById('lista-ranking');
    lista.innerHTML = data.map((res, i) => 
        `<li>#${i+1} - ${res.aciertos}/5 en ${res.tiempo_segundos}s</li>`
    ).join('');
}

cargarPreguntasDelDia();
