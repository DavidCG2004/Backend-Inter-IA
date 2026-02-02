import CV from '../models/CV.js'
import Interview from '../models/Interview.js'
import Usuario from '../models/Usuario.js'
import { generateInterviewQuestions, evaluateInterviewAnswers, parseCVToProfile } from '../helpers/geminiHelper.js'
import pdf from '@cedrugs/pdf-parse'
import { v2 as cloudinary } from 'cloudinary'


// Configuración de Cloudinary (Asegúrate de tener las variables en .env)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

// --- Helper para subir Buffer a Cloudinary ---
const uploadBufferToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'cv_uploads', resource_type: 'auto' },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        // Convertimos el buffer en un stream y lo enviamos
        uploadStream.end(buffer);
    });
}

// Método para subir el CV
const uploadCV = async (req, res) => {
    try {
        // 1. Validaciones
        if (!req.file) {
            return res.status(400).json({ msg: "Debes subir un archivo PDF obligatorio" })
        }
        if (!req.usuario || !req.usuario._id) {
            return res.status(401).json({ msg: "No autorizado. Token inválido o sesión expirada" })
        }

        const usuarioID = req.usuario._id
        
        console.log(`📥 Procesando CV para usuario: ${usuarioID}`);

        // 2. Extracción de Texto (Directo de la RAM - Súper Rápido)
        let pdfText = "";
        try {
            // req.file.buffer contiene el PDF crudo
            const pdfData = await pdf(req.file.buffer);
            pdfText = pdfData.text;
        } catch (readError) {
            console.error("Error extrayendo texto del PDF:", readError);
            return res.status(500).json({ msg: "El PDF está corrupto o no se puede leer" });
        }

        // 3. Subida a Cloudinary (Para persistencia)
        let cloudinaryResult;
        try {
            cloudinaryResult = await uploadBufferToCloudinary(req.file.buffer);
        } catch (uploadError) {
            console.error("Error subiendo a Cloudinary:", uploadError);
            return res.status(500).json({ msg: "Error al guardar el archivo en la nube" });
        }

        // 4. Guardar en Base de Datos
        const newCV = new CV({
            user: usuarioID,
            fileName: req.file.originalname,
            filePath: cloudinaryResult.secure_url, // URL pública de Cloudinary
            extractedText: pdfText
        })

        await newCV.save()

        // 5. Proceso de IA: Actualización del perfil profesional
        // (Esto se ejecuta en segundo plano visualmente, aunque aquí usamos await para asegurar consistencia)
        try {
            const profileData = await parseCVToProfile(pdfText)
            
            if (profileData) {
                await Usuario.findByIdAndUpdate(usuarioID, {
                    puesto: profileData.puesto || "",
                    resumenProfesional: profileData.resumenProfesional || "",
                    habilidades: profileData.habilidades || [],
                    experiencia: profileData.experiencia || [],
                    educacion: profileData.educacion || []
                })
            }
        } catch (aiError) {
            console.error("Warning IA:", aiError.message)
        }

        res.status(200).json({ 
            msg: "CV procesado correctamente", 
            cvId: newCV._id 
        })

    } catch (error) {
        console.error("Error crítico en uploadCV:", error)
        res.status(500).json({ msg: `Error interno: ${error.message}` })
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