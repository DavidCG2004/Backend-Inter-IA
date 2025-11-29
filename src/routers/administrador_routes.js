import {Router} from 'express'
import { actualizarPassword, actualizarPerfil, comprobarTokenPasword, confirmarMail, crearNuevoPassword, login, perfil, 
recuperarPassword, registro } from '../controllers/administrador_controller.js'
import { verificarTokenJWT } from '../middlewares/JWT.js'
const router = Router()


router.post('/registro',registro)
router.get('/confirmar/:token',confirmarMail)



router.post('/recuperarpassword',recuperarPassword)
router.get('/recuperarpassword/:token',comprobarTokenPasword)
router.post('/nuevopassword/:token',crearNuevoPassword)


router.post('/administrador/login',login)


router.get('/administrador/perfil',verificarTokenJWT,perfil)

router.put('/actualizarperfil/:id',verificarTokenJWT,actualizarPerfil)

router.put('/actualizarpassword/:id',verificarTokenJWT,actualizarPassword)


export default router