import { Schema, model } from 'mongoose'

const paymentSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'usd'
    },
    paymentMethodId: {
        type: String,
        required: true
    },
    stripePaymentIntentId: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true
    },
    mensaje: { // Agregamos esto: A veces los donadores quieren dejar un mensaje de apoyo
        type: String,
        default: null
    }
}, {
    timestamps: true
})

export default model('Payment', paymentSchema)