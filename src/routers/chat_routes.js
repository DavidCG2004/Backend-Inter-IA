import { Router } from 'express'
import { getChatHistory } from '../controllers/chat_controller.js'
import { verificarTokenJWT } from '../middlewares/JWT.js'

const router = Router()

router.get('/history', verificarTokenJWT, getChatHistory)

export default router