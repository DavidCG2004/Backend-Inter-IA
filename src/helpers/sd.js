import { GoogleGenerativeAI } from "@google/generative-ai"
import dotenv from 'dotenv'
dotenv.config()

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)


const MODEL_NAME = "gemini-2.5-flash";

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


const evaluateInterviewAnswers = async (questionsAndAnswers, interviewType = 'tech') => {
    try {
        const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            generationConfig: GENERATION_CONFIG
        });

        let roleInstruction = "";
        
        if (interviewType === 'soft_skills') {
            roleInstruction = `
                Actúa como un Gerente de RRHH experto. Evalúa las respuestas basándote en:
                1. Método STAR.
                2. Empatía y comunicación asertiva.
            `;
        } else {
            roleInstruction = `
                Actúa como un reclutador técnico senior. Evalúa corrección técnica del código o concepto y eficiencia.
            `;
        }

        const prompt = `
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

        const result = await runWithRetry(model, prompt);
        const response = await result.response;
        const text = response.text();
        
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);

    } catch (error) {
        console.error("Error en Gemini (Evaluation):", error);
        throw new Error("No se pudo evaluar la entrevista en este momento.");
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