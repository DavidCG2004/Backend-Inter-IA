import express from 'express'
import cors from 'cors'
import routerAdministrador from './routers/administrador_routes.js'
import routerUsuario from './routers/usuario_routes.js'
import routerInterview from './routers/simulation_routes.js'
import donationRoutes from './routers/donation_routes.js'
import chatRoutes from './routers/chat_routes.js'
import passport from 'passport';
import { configurePassport } from './config/passport.js'; // Ejecuta la config que acabamos de hacer

const app = express()

configurePassport(); // Configura Passport con Google OAuth2

app.use(express.json())
app.use(cors())

app.use(passport.initialize());


app.set('port', process.env.PORT || 3000)

app.get('/', (req, res) => res.send("Server on"))

import routerAuth from './routers/auth_routes.js'
app.use('/api/auth', routerAuth)

app.use('/api/admin', routerAdministrador)
app.use('/api/user', routerUsuario)
app.use('/api/interview', routerInterview)
app.use('/api/donation', donationRoutes)
app.use('/api/chat', chatRoutes)

app.use((req,res)=>res.status(404).send("Endpoint no encontrado - 404"))

export default app;
