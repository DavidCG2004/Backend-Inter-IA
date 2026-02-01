/* import dotenv from 'dotenv'
import app from './server.js'
import connection from './database.js'

dotenv.config()

await connection()

export default app */


import app from './server.js'
import connection from './database.js';

connection()

app.listen(app.get('port'),()=>{
    console.log(`Server ok on http://localhost:${app.get('port')}`);
})
