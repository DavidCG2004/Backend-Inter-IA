import { Schema, model } from 'mongoose'

const chatSchema = new Schema({
    // El usuario que solicita soporte (dueño de la sala)
    user: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    message: {
        type: String,
        required: true
    },
    // Quién envió este mensaje específico: 'user' o 'admin' (soporte)
    senderRole: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    // Opcional: Para saber si fue leído
    read: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
})

export default model('Chat', chatSchema)