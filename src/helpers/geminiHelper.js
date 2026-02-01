import { GoogleGenerativeAI } from "@google/generative-ai"
import dotenv from 'dotenv'
dotenv.config()

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

const generateInterviewQuestions = async (context, mode) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" })

        const prompt = `
            Actúa como un entrevistador técnico experto en TI.
            Contexto de la entrevista: ${mode}.
            Detalles: ${context}.
            
            Genera un cuestionario JSON (SIN markdown, solo JSON crudo) con 3 preguntas teóricas y 1 ejercicio práctico de código breve.
            Formato requerido estrictamente:
            [
                { "question": "...", "type": "theoretical" },
                { "question": "...", "type": "practical" }
            ]
        `

        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()
        
        // Limpieza básica por si la IA devuelve bloques de código
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim()
        
        return JSON.parse(cleanedText)

    } catch (error) {
        console.error("Error en Gemini:", error)
        throw new Error("Falló la generación de preguntas con IA")
    }
}


const evaluateInterviewAnswers = async (questionsAndAnswers) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" })

        const prompt = `
            Actúa como un reclutador técnico senior y evalúa las siguientes respuestas de una entrevista de programación.
            
            Datos a evaluar:
            ${JSON.stringify(questionsAndAnswers)}

            Instrucciones:
            1. Analiza la relevancia, corrección técnica y claridad de cada respuesta.
            2. Asigna un puntaje de 1 a 10 (score).
            3. Proporciona un feedback constructivo y breve (máximo 2 frases) explicando qué faltó o qué estuvo bien.
            4. Genera un feedback general de toda la entrevista.

            Formato de respuesta JSON ESTRICTO requerido:
            {
                "evaluations": [
                    { "index": 0, "score": 8, "feedback": "Buena explicación, pero faltó mencionar X concepto." },
                    { "index": 1, "score": 5, "feedback": "Respuesta vaga, no resuelve el problema planteado." }
                ],
                "overallFeedback": "El candidato tiene bases sólidas en X pero debe reforzar Y."
            }
        `

        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()
        
        // Limpieza de JSON
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim()
        
        return JSON.parse(cleanedText)

    } catch (error) {
        console.error("Error en evaluación con Gemini:", error)
        throw new Error("Falló la evaluación de respuestas")
    }
}

export { generateInterviewQuestions, evaluateInterviewAnswers }