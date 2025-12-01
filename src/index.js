import dotenv from 'dotenv'
import app from './server.js'
import connection from './database.js'

dotenv.config()     // ✅ PRIMERO cargas variables
connection()       // ✅ LUEGO conectas a MongoDB

export default app
