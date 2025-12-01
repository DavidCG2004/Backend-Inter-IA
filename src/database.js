import mongoose from 'mongoose'

mongoose.set('strictQuery', true)

let isConnected = false   // ✅ evita reconexiones en cada request

const connection = async () => {
  try {
    if (isConnected) {
      console.log('✅ Using existing MongoDB connection')
      return
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'InterIa',                // ✅ fuerza base de datos
      serverSelectionTimeoutMS: 10000
    })

    isConnected = conn.connections[0].readyState
    console.log(`✅ Database connected: ${conn.connection.host}`)
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message)
    // ❌ NO process.exit en serverless
    throw new Error('MongoDB connection failed')
  }
}

export default connection

