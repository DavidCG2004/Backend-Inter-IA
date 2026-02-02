import CV from '../models/CV.js'
import Interview from '../models/Interview.js'
import { generateInterviewQuestions, evaluateInterviewAnswers, parseCVToProfile } from '../helpers/geminiHelper.js'
import fs from 'fs'
import pdf from '@cedrugs/pdf-parse'
import Usuario from '../models/Usuario.js'

// Método para subir el CV
const uploadCV = async (req, res) => {
    try {
        // 1. Validaciones iniciales
        if (!req.file) {
            return res.status(400).json({ msg: "Debes subir un archivo PDF obligatorio" })
        }

        if (!req.usuario || !req.usuario._id) {
            return res.status(401).json({ msg: "No autorizado. Token inválido o sesión expirada" })
        }

        const usuarioID = req.usuario._id

        // 2. Lectura y extracción de texto del PDF
        const dataBuffer = fs.readFileSync(req.file.path)
        const data = await pdf(dataBuffer)

        // 3. Guardar el registro del CV en la base de datos
        const newCV = new CV({
            user: usuarioID,
            fileName: req.file.originalname,
            filePath: req.file.path,
            extractedText: data.text
        })

        await newCV.save()

        // 4. Proceso de IA: Actualización del perfil profesional (Envoltorio de seguridad)
        try {
            console.log("Iniciando parseo de CV con IA para el usuario:", usuarioID);
            
            const profileData = await parseCVToProfile(data.text)
            
            if (profileData) {
                await Usuario.findByIdAndUpdate(usuarioID, {
                    puesto: profileData.puesto || "",
                    resumenProfesional: profileData.resumenProfesional || "",
                    habilidades: profileData.habilidades || [],
                    experiencia: profileData.experiencia || [],
                    educacion: profileData.educacion || []
                })
                console.log("Perfil profesional actualizado exitosamente")
            }
        } catch (aiError) {
            // Logueamos el error pero no bloqueamos la respuesta al cliente
            console.error("Error no crítico al parsear perfil con IA:", aiError.message)
            // Aquí podrías decidir si guardar una notificación para el usuario
        }

        // 5. Respuesta exitosa al cliente
        res.status(200).json({ 
            msg: "CV procesado exitosamente y perfil actualizado", 
            cvId: newCV._id 
        })

    } catch (error) {
        console.error("Error crítico en uploadCV:", error)
        
        // Limpieza de archivo físico si algo falló antes de guardar en BDD
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

        if (!req.usuario || !req.usuario._id) {
            return res.status(401).json({ msg: "No autorizado" })
        }
        const usuarioID = req.usuario._id

        if (!type) return res.status(400).json({ msg: "El tipo de entrevista es obligatorio" })

        let contextForAI = ""

        // LÓGICA DE CONTEXTO
        if (type === 'cv') {
            if (!cvId) return res.status(400).json({ msg: "Se requiere el ID del CV" })
            
            const cv = await CV.findById(cvId)
            if (!cv) return res.status(404).json({ msg: "El CV no existe" })
            
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
            if (!data) return res.status(400).json({ msg: "Debes ingresar las tecnologías" })
            contextForAI = `Entrevista técnica enfocada en estas tecnologías: ${data}`
        }

        const questions = await generateInterviewQuestions(contextForAI, type)

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


// Método para enviar respuestas y calificar
const submitInterview = async (req, res) => {
    try {
        const { interviewId, answers } = req.body

        if (!req.usuario || !req.usuario._id) {
            return res.status(401).json({ msg: "No autorizado" })
        }
        if (!interviewId || !answers || !Array.isArray(answers)) {
            return res.status(400).json({ msg: "Faltan datos o formato de respuestas incorrecto" })
        }

        const interview = await Interview.findById(interviewId)
        if (!interview) return res.status(404).json({ msg: "Entrevista no encontrada" })

        if (interview.user.toString() !== req.usuario._id.toString()) {
            return res.status(403).json({ msg: "No tienes permiso para evaluar esta entrevista" })
        }

        const dataForAI = interview.questions.map((q, i) => ({
            index: i,
            question: q.questionText,
            user_answer: answers[i] || "No respondido"
        }))

        // MODIFICACIÓN: Pasamos el interview.type
        // Si el tipo es soft_skills activará a Hugging Face
        const results = await evaluateInterviewAnswers(dataForAI, interview.type) 

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
            scoreTotal: results.evaluations.reduce((acc, curr) => acc + curr.score, 0) / results.evaluations.length,
            feedbackGeneral: interview.overallFeedback,
            detalles: interview.questions
        })

    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error al evaluar entrevista - ${error.message}` })
    }
}

// ---------------------------------------------------------
//  HISTORIAL Y DETALLE (Optimizados para tus Vistas)
// ---------------------------------------------------------

// @desc    Obtener todas las entrevistas (Para la vista de "Tarjetas/Cursos")
// @route   GET /api/interview/history
const getAllInterviews = async (req, res) => {
    try {
        if (!req.usuario || !req.usuario._id) {
            return res.status(401).json({ msg: "No autorizado" })
        }

        const interviews = await Interview.find({ user: req.usuario._id })
            .select('-user -__v') 
            .sort({ createdAt: -1 })

        const interviewsWithStats = interviews.map(interview => {
            const isCompleted = !!interview.overallFeedback
            
            // Calculamos promedio (0 a 10)
            let averageScore = 0
            if (isCompleted && interview.questions.length > 0) {
                const totalScore = interview.questions.reduce((acc, q) => acc + (q.score || 0), 0)
                averageScore = Number((totalScore / interview.questions.length).toFixed(1))
            }

            // Generamos un Título bonito para la tarjeta
            let displayTitle = "Entrevista Técnica"
            if(interview.type === 'tech_stack') displayTitle = interview.contextData // Ej: "React, Node.js"
            else if(interview.type === 'cv') displayTitle = "Simulación basada en CV"
            else if(interview.type === 'job_link') displayTitle = "Simulación de Oferta Laboral"

            return {
                _id: interview._id,
                title: displayTitle,          // Título para la tarjeta (ej: C# Intermedio)
                type: interview.type,
                createdAt: interview.createdAt,
                isCompleted,                  // Estado (ej: Completado/En Progreso)
                averageScore,                 // Score para la barra (0-10)
                progressPercentage: averageScore * 10 // Por si quieres usar % directo (0-100%)
            }
        })

        res.status(200).json(interviewsWithStats)

    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: "Error al obtener el historial de entrevistas" })
    }
}

// @desc    Obtener detalle completo (Para la vista de "Detalle con Feedback")
// @route   GET /api/interview/detail/:id
const getInterviewDetail = async (req, res) => {
    try {
        const { id } = req.params

        if (!req.usuario || !req.usuario._id) {
            return res.status(401).json({ msg: "No autorizado" })
        }

        const interview = await Interview.findOne({ _id: id, user: req.usuario._id })
            .select('-__v')
        
        if (!interview) {
            return res.status(404).json({ msg: "Entrevista no encontrada" })
        }

        // Devolvemos todo el objeto. El front usará:
        // - interview.overallFeedback (Feedback general)
        // - interview.questions (Array con preguntas, score individual y aiFeedback)
        res.status(200).json(interview)

    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: "Error al obtener detalles de la entrevista" })
    }
}

export { 
    uploadCV, 
    startSimulation, 
    submitInterview, 
    getAllInterviews, 
    getInterviewDetail 
}