import { Schema, model } from 'mongoose'

const cvSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario', // Asegúrate que coincida con tu modelo de Usuario (Usuario.js)
        required: true
    },
    fileName: {
        type: String,
        required: true,
        trim: true
    },
    filePath: {
        type: String,
        required: true,
        trim: true
    },
    extractedText: {
        type: String,
        default: null
    }
}, {
    timestamps: true
})

export default model('CV', cvSchema)