import { Router } from 'express'
import { realizarDonacion, obtenerHistorialDonaciones } from '../controllers/donation_controller.js'
import { verificarTokenJWT } from '../middlewares/JWT.js'

const router = Router()

router.post('/donate', verificarTokenJWT, realizarDonacion)

router.get('/history', verificarTokenJWT, obtenerHistorialDonaciones)

export default router