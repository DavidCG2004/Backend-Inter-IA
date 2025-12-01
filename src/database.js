import mongoose from 'mongoose'

mongoose.set('strictQuery', true)

const connection = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000
    })

    console.log(`✅ Database connected: ${conn.connection.host}`)
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message)
    process.exit(1)
  }
}

export default connection
