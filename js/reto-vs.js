let preguntas = [];
let indiceActual = 0;
let aciertos = 0;
let startTime, timerInterval;

const quizSection = document.getElementById('quiz-section');
const startScreen = document.getElementById('start-screen');
const resultScreen = document.getElementById('result-screen');

// 1. Obtener 5 preguntas aleatorias del día (usando semilla de fecha)
async function cargarPreguntasDelDia() {
    const { data, error } = await supabase
        .from('preguntas')
        .select('*')
        .limit(5); // Aquí podrías filtrar por fecha o categoría

    if (error) console.error("Error cargando preguntas:", error);
    else preguntas = data;
}

// 2. Iniciar el juego
document.getElementById('btn-comenzar').onclick = () => {
    startScreen.style.display = 'none';
    quizSection.style.display = 'block';
    startTime = performance.now();
    
    // Iniciar cronómetro visual
    timerInterval = setInterval(() => {
        const ahora = (performance.now() - startTime) / 1000;
        document.getElementById('timer').innerText = ahora.toFixed(1) + "s";
    }, 100);

    mostrarPregunta();
};

// 3. Mostrar Pregunta y Mezclar Opciones
function mostrarPregunta() {
    if (indiceActual >= preguntas.length) return finalizarReto();

    const p = preguntas[indiceActual];
    document.getElementById('texto-pregunta').innerText = p.pregunta;
    
    // Actualizar barra de progreso
    document.getElementById('progreso-llenado').style.width = `${(indiceActual / 5) * 100}%`;

    const container = document.getElementById('opciones-container');
    container.innerHTML = "";

    // Unir correcta con distractores y mezclar
    const opciones = [...p.distractores, p.respuesta_correcta].sort(() => Math.random() - 0.5);

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

    // Guardar en Supabase
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
        .from('resultados_retos')
        .insert([
            { 
                user_id: user.id, 
                aciertos: aciertos, 
                tiempo_segundos: parseFloat(tiempoTotal) 
            }
        ]);

    if (error) console.error("Error al guardar:", error);
    cargarRanking();
}

// 6. Cargar Ranking del día
async function cargarRanking() {
    const { data, error } = await supabase
        .from('resultados_retos')
        .select(`aciertos, tiempo_segundos, user_id`) // Aquí podrías hacer un join con perfiles para el nombre
        .order('aciertos', { ascending: false })
        .order('tiempo_segundos', { ascending: true })
        .limit(5);

    const lista = document.getElementById('lista-ranking');
    lista.innerHTML = data.map((res, i) => 
        `<li>#${i+1} - ${res.aciertos}/5 en ${res.tiempo_segundos}s</li>`
    ).join('');
}

cargarPreguntasDelDia();
