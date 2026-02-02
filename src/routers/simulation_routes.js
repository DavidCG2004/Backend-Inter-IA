import { Router } from 'express'
import { uploadCV, startSimulation, submitInterview, getAllInterviews, getInterviewDetail
} from '../controllers/simulation_controller.js'
import { verificarTokenJWT } from '../middlewares/JWT.js'
import upload from '../middlewares/upload.js'

const router = Router()

// Rutas existentes
router.post('/upload-cv', verificarTokenJWT, upload.single('cv'), uploadCV)
router.post('/start', verificarTokenJWT, startSimulation)
router.post('/submit', verificarTokenJWT, submitInterview)

// NUEVAS RUTAS
// GET para ver la lista de cuestionarios (Imagen 1 - Progreso de cursos)
router.get('/history', verificarTokenJWT, getAllInterviews)

// GET para ver el detalle de uno solo (Imagen 2 - Score y Retroalimentación)
router.get('/detail/:id', verificarTokenJWT, getInterviewDetail)

export default router