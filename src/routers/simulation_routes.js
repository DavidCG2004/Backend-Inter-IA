import { Router } from 'express'
import { uploadCV, startSimulation, submitInterview } from '../controllers/simulation_controller.js'
import { verificarTokenJWT } from '../middlewares/JWT.js'
import upload from '../middlewares/upload.js' // El middleware de Multer

const router = Router()

router.post('/upload-cv', verificarTokenJWT, upload.single('cv'), uploadCV)

router.post('/start', verificarTokenJWT, startSimulation)

router.post('/submit', verificarTokenJWT, submitInterview)
export default router
