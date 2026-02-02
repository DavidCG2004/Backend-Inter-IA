import {Router} from 'express'
import { actualizarPassword, actualizarPerfil, comprobarTokenPasword, confirmarMail, crearNuevoPassword, login, perfil, 
recuperarPassword, registro, obtenerDashboard} from '../controllers/administrador_controller.js'
import { verificarTokenJWT } from '../middlewares/JWT.js'


const router = Router()

// Rutas Públicas
router.post('/registro',registro)
router.get('/confirmar/:token',confirmarMail)
router.post('/login',login)

router.post('/recuperar-password',recuperarPassword)
router.get('/recuperar-password/:token',comprobarTokenPasword)
router.post('/nuevo-password/:token',crearNuevoPassword)


// Rutas Privadas
router.get('/perfil',verificarTokenJWT,perfil)
router.put('/actualizar-perfil/:id',verificarTokenJWT,actualizarPerfil)
router.put('/actualizar-password/:id',verificarTokenJWT,actualizarPassword)
router.get('/dashboard', verificarTokenJWT, obtenerDashboard)


export default router