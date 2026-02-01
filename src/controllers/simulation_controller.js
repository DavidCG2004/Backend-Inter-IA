import CV from '../models/CV.js'
import Interview from '../models/Interview.js'
import { generateInterviewQuestions, evaluateInterviewAnswers } from '../helpers/geminiHelper.js'
import fs from 'fs'
import pdf from '@cedrugs/pdf-parse'

// Método para subir el CV
const uploadCV = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ msg: "Debes subir un archivo PDF obligatorio" })

        // 1. LEER EL ARCHIVO
        const dataBuffer = fs.readFileSync(req.file.path)
        const data = await pdf(dataBuffer)

        // 2. OBTENER ID DEL USUARIO (Corregido según tu middleware)
        // Tu middleware guarda al usuario en req.usuario
        if (!req.usuario || !req.usuario._id) {
            return res.status(401).json({ msg: "No autorizado. Token inválido o sesión expirada" })
        }
        
        const usuarioID = req.usuario._id

        // 3. GUARDAR EN BDD
        const newCV = new CV({
            user: usuarioID,
            fileName: req.file.originalname,
            filePath: req.file.path,
            extractedText: data.text
        })

        await newCV.save()
        
        res.status(200).json({ 
            msg: "CV procesado exitosamente", 
            cvId: newCV._id 
        })

    } catch (error) {
        console.error(error)
        // Limpieza de archivo si falla
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path)
        }
        res.status(500).json({ msg: `❌ Error al procesar CV - ${error.message}` })
    }
}

// Método para iniciar simulación
const startSimulation = async (req, res) => {
    try {
        const { type, data, cvId } = req.body

        // 1. VERIFICAR USUARIO (Corregido)
        if (!req.usuario || !req.usuario._id) {
            return res.status(401).json({ msg: "No autorizado" })
        }
        const usuarioID = req.usuario._id

        if (!type) return res.status(400).json({ msg: "El tipo de entrevista es obligatorio" })

        let contextForAI = ""

        // 2. LÓGICA DE CONTEXTO
        if (type === 'cv') {
            if (!cvId) return res.status(400).json({ msg: "Se requiere el ID del CV" })
            
            const cv = await CV.findById(cvId)
            if (!cv) return res.status(404).json({ msg: "El CV no existe" })
            
            // Seguridad: Verificar que el CV sea de este usuario
            if (cv.user.toString() !== usuarioID.toString()) {
                return res.status(403).json({ msg: "No tienes permiso para usar este CV" })
            }

            contextForAI = `Basado en el siguiente perfil profesional extraído de un CV: ${cv.extractedText}`
        } 
        else if (type === 'job_link') {
            if (!data) return res.status(400).json({ msg: "Debes ingresar la descripción del empleo" })
            contextForAI = `Basado en esta descripción de trabajo: ${data}`
        } 
        else {
            // tech_stack
            if (!data) return res.status(400).json({ msg: "Debes ingresar las tecnologías" })
            contextForAI = `Entrevista técnica enfocada en estas tecnologías: ${data}`
        }

        // 3. GENERAR PREGUNTAS (IA)
        const questions = await generateInterviewQuestions(contextForAI, type)

        // 4. GUARDAR ENTREVISTA
        const interview = new Interview({
            user: usuarioID,
            type,
            contextData: data || 'CV Data',
            questions: questions.map(q => ({
                questionText: q.question,
                category: q.type
            }))
        })

        await interview.save()

        res.status(200).json({
            msg: "Entrevista generada correctamente",
            interviewId: interview._id,
            questions: interview.questions
        })

    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error al generar entrevista - ${error.message}` })
    }
}


// @desc    Enviar respuestas y obtener evaluación
// @route   POST /api/interview/submit
const submitInterview = async (req, res) => {
    try {
        const { interviewId, answers } = req.body
        // answers debe ser un array: ["Respuesta 1", "Respuesta 2", "Código..."] 
        // o un objeto mapeado. Para simplificar, asumiremos que envían las respuestas en orden.

        // 1. Validar Usuario y Datos
        if (!req.usuario || !req.usuario._id) {
            return res.status(401).json({ msg: "No autorizado" })
        }
        if (!interviewId || !answers || !Array.isArray(answers)) {
            return res.status(400).json({ msg: "Faltan datos o formato de respuestas incorrecto" })
        }

        // 2. Buscar la entrevista
        const interview = await Interview.findById(interviewId)
        if (!interview) return res.status(404).json({ msg: "Entrevista no encontrada" })

        // 3. Verificar propiedad
        if (interview.user.toString() !== req.usuario._id.toString()) {
            return res.status(403).json({ msg: "No tienes permiso para evaluar esta entrevista" })
        }

        // 4. Preparar datos para la IA
        // Mapeamos las preguntas originales con las respuestas del usuario
        const dataForAI = interview.questions.map((q, i) => ({
            index: i,
            question: q.questionText,
            user_answer: answers[i] || "No respondido"
        }))

        // 5. Llamar a Gemini para calificar
        const results = await evaluateInterviewAnswers(dataForAI)

        // 6. Actualizar la base de datos con los resultados
        // Actualizamos cada sub-documento de pregunta con su respuesta, feedback y score
        results.evaluations.forEach((evalItem) => {
            if (interview.questions[evalItem.index]) {
                interview.questions[evalItem.index].userAnswer = answers[evalItem.index] || "No respondido"
                interview.questions[evalItem.index].aiFeedback = evalItem.feedback
                interview.questions[evalItem.index].score = evalItem.score
            }
        })

        interview.overallFeedback = results.overallFeedback
        
        await interview.save()

        res.status(200).json({
            msg: "Evaluación completada exitosamente",
            scoreTotal: results.evaluations.reduce((acc, curr) => acc + curr.score, 0) / results.evaluations.length, // Promedio
            feedbackGeneral: interview.overallFeedback,
            detalles: interview.questions
        })

    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error al evaluar entrevista - ${error.message}` })
    }
}

export { uploadCV, startSimulation, submitInterview }