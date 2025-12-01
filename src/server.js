import express from 'express'
import cors from 'cors'
import routerAdministrador from './routers/administrador_routes.js'

const app = express()

app.use(express.json())
app.use(cors())

app.set('port', process.env.PORT || 3000)

app.get('/', (req, res) => res.send("Server on"))
app.use('/api', routerAdministrador)

app.use((req,res)=>res.status(404).send("Endpoint no encontrado - 404"))

export default app