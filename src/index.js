import dotenv from 'dotenv'
import app from './server.js'
import connection from './database.js'

dotenv.config()

await connection()   // ✅ asegura conexión antes de responder

export default app