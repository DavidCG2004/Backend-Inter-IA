import mongoose from 'mongoose'

mongoose.set('strictQuery', true)

const connection = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI)
    console.log(`✅ Database connected: ${conn.connection.host}`)
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message)
  }
}

export default connection
