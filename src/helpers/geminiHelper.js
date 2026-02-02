import { GoogleGenerativeAI } from "@google/generative-ai"
import dotenv from 'dotenv'
dotenv.config()

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)


const MODEL_NAME = "gemini-2.5-flash";
const HF_MODEL_URL = "https://router.huggingface.co/hf-inference/models/cardiffnlp/twitter-roberta-base-sentiment-latest";

// Configuración para forzar respuesta JSON limpia
const GENERATION_CONFIG = {
    temperature: 0.7, // Creatividad balanceada
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: "application/json", // IMPORTANTE: Fuerza al modelo a devolver JSON
};

/**
 * Función auxiliar para manejar reintentos (Exponential Backoff simplificado)
 * Si la API da error de sobrecarga, espera unos segundos y reintenta.
 */
const runWithRetry = async (model, prompt, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await model.generateContent(prompt);
            return result;
        } catch (error) {
            // Si es el último intento, lanzamos el error
            if (i === retries - 1) throw error;
            
            // Si es error de sobrecarga (503) o rate limit (429), esperamos un poco
            console.warn(`Intento ${i + 1} fallido. Reintentando en breve... Error: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // Espera 2s, luego 4s...
        }
    }
}

const generateInterviewQuestions = async (context, mode) => {
    try {
        const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            generationConfig: GENERATION_CONFIG 
        });

        let prompt = "";

        // LÓGICA DIFERENCIADA SEGÚN EL TIPO DE ENTREVISTA
        if (mode === 'soft_skills') {
            prompt = `
                Actúa como un experto en Recursos Humanos y Psicología Organizacional.
                Objetivo: Realizar una entrevista de habilidades blandas (Soft Skills).
                Enfoque: ${context}.
                
                Genera un cuestionario JSON con 4 preguntas.
                Las preguntas deben ser de tipo situacional o conductual (Método STAR).
                
                Esquema JSON requerido:
                [
                    { "question": "Texto de la pregunta", "type": "behavioral" }
                ]
            `;
        } else {
            prompt = `
                Actúa como un entrevistador técnico experto en TI.
                Contexto de la entrevista: ${mode}.
                Detalles: ${context}.
                
                Genera un cuestionario JSON con 3 preguntas teóricas y 1 ejercicio práctico de código breve.
                
                Esquema JSON requerido:
                [
                    { "question": "Texto de la pregunta", "type": "theoretical" },
                    { "question": "Texto de la pregunta", "type": "practical" }
                ]
            `;
        }

        // Usamos la función de reintento
        const result = await runWithRetry(model, prompt);
        const response = await result.response;
        const text = response.text();
        
        // Al usar responseMimeType: "application/json", el texto suele venir limpio,
        // pero mantenemos un replace por seguridad.
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return JSON.parse(cleanedText);

    } catch (error) {
        console.error("Error en Gemini (Generation):", error);
        // Devolvemos un array vacío o null para que el controlador lo maneje elegantemente
        // en lugar de romper toda la app
        throw new Error("El servicio de IA está saturado momentáneamente, intenta de nuevo.");
    }
}


const analyzeToneWithHF = async (answers) => {
    try {
        const validAnswers = answers.filter(a => a && a.length > 5);
        if (validAnswers.length === 0) return null;

        const response = await fetch(HF_MODEL_URL, {
            headers: { 
                Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
                "Content-Type": "application/json" // Buena práctica agregar esto
            },
            method: "POST",
            body: JSON.stringify({ inputs: validAnswers }),
        });

        // MEJORA: Verificar si la respuesta es JSON antes de parsear
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            // Si nos devuelve HTML (como el error 410), leemos texto corto y avisamos
            const textBody = await response.text();
            console.warn(`⚠️ HF API Error (${response.status}): Respuesta no es JSON. Puede ser error de URL.`);
            // console.warn(textBody); // Descomenta solo si quieres ver el HTML
            return null;
        }

        if (!response.ok) {
            const errorJson = await response.json();
            console.warn("⚠️ HF API Error:", errorJson);
            return null;
        }

        const result = await response.json();
        return result;

    } catch (error) {
        console.error("Error conectando con Hugging Face:", error.message);
        return null;
    }
};


const mapSentimentToFeedback = (sentimentData) => {
    if (!sentimentData) return "";
    
    // Buscamos el label con mayor score
    // sentimentData es array de objetos {label, score}
    const topSentiment = sentimentData.reduce((prev, current) => (prev.score > current.score) ? prev : current);

    if (topSentiment.label === 'positive') return " 🟢 Tu tono denota seguridad y confianza.";
    if (topSentiment.label === 'negative') return " 🔴 Tu tono se percibe algo inseguro o vacilante.";
    return " 🟡 Tu tono es neutral.";
};

// --- FUNCIÓN EVALUATE ACTUALIZADA ---
const evaluateInterviewAnswers = async (questionsAndAnswers, interviewType) => {
    try {
        // 1. Ejecutar análisis de Gémini (Contenido Técnico/Lógico)
        const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            generationConfig: GENERATION_CONFIG
        });

        let roleInstruction = "";
        let prompt = "";

        // Preparamos los datos
        const answersList = questionsAndAnswers.map(qa => qa.user_answer);
        
        // 2. Ejecutar análisis de Tono (Hugging Face) SOLO si es soft_skills
        // Hacemos las peticiones en paralelo si es soft skills para no perder tiempo
        let toneAnalysisPromise = Promise.resolve(null);
        
        if (interviewType === 'soft_skills') {
            console.log("Iniciando análisis de sentimientos con Hugging Face...");
            toneAnalysisPromise = analyzeToneWithHF(answersList);
            
            roleInstruction = `
                Actúa como un Gerente de RRHH experto. Evalúa las respuestas basándote en:
                1. Método STAR.
                2. Empatía y comunicación asertiva.
                IMPORTANTE: Evalúa la CALIDAD del contenido (qué dijo), no solo cómo lo dijo. 
            `;
        } else {
            roleInstruction = `
            Actúa como un reclutador técnico senior. Evalúa corrección técnica del código o concepto y eficiencia.`;
        }

        prompt = `
            ${roleInstruction}
            Datos a evaluar:
            ${JSON.stringify(questionsAndAnswers)}

            Instrucciones:
            1. Asigna un puntaje de 1 a 10 (score).
            2. Proporciona un feedback constructivo. Si es soft skills, sugiere cómo mejorar la respuesta para sonar más profesional.
            3. Genera un feedback general.

            Esquema JSON requerido:
            {
                "evaluations": [
                    { "index": 0, "score": 0, "feedback": "string" }
                ],
                "overallFeedback": "string"
            }
        `;

        // Ejecutamos Gemini y esperamos a HF
        const [geminiResult, hfResults] = await Promise.all([
            runWithRetry(model, prompt),
            toneAnalysisPromise
        ]);

        const geminiResponseText = await geminiResult.response.text();
        const cleanedText = geminiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        let evaluationsData = JSON.parse(cleanedText);

        // 3. FUSIONAR RESULTADOS (Hybrid AI)
        if (interviewType === 'soft_skills' && hfResults && Array.isArray(hfResults)) {
            // hfResults es un array de arrays correspondientes a las inputs
            // Nota: HF a veces devuelve estructura anidada o plana dependiendo del modelo, 
            // para 'twitter-roberta' suele ser [[{...},{...},{...}]] si envias lista.
            
            // Verificamos si la respuesta de HF coincide en longitud
            // (La API de inferencia a veces se aplana si hay solo 1 input, ten cuidado ahí)
            const sentimentArray = Array.isArray(hfResults[0]) ? hfResults : [hfResults];

            evaluationsData.evaluations = evaluationsData.evaluations.map((item, i) => {
                // Buscamos el análisis de sentimiento correspondiente a este índice
                // Nota: questionsAndAnswers tiene el índice original.
                // Asumimos que el orden del array enviado a HF es el mismo (0, 1, 2...)
                const sentiment = sentimentArray[i]; // Array de scores para la respuesta i
                const toneFeedback = mapSentimentToFeedback(sentiment);

                return {
                    ...item,
                    feedback: `${item.feedback}${toneFeedback}` // Concatenamos el feedback técnico + emocional
                };
            });
            
            console.log("Feedback de sentimientos integrado correctamente.");
        }

        return evaluationsData;

    } catch (error) {
        console.error("Error en Evaluación:", error);
        throw new Error("Error en el proceso de evaluación.");
    }
}

const parseCVToProfile = async (text) => {
    try {
        const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            generationConfig: GENERATION_CONFIG
        });

        const prompt = `
            Actúa como un reclutador experto. Extrae información de este CV y genera un perfil profesional.
            Texto del CV: ${text}

            Esquema JSON requerido:
            {
                "puesto": "string",
                "resumenProfesional": "string",
                "habilidades": ["string"],
                "experiencia": ["string"],
                "educacion": ["string"]
            }
        `;

        const result = await runWithRetry(model, prompt);
        const response = await result.response;
        let textResponse = response.text();
        
        textResponse = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(textResponse);
    } catch (error) {
        console.error("Error detallado en parseCVToProfile:", error.message);
        return null;
    }
}



export { generateInterviewQuestions, evaluateInterviewAnswers, parseCVToProfile }

