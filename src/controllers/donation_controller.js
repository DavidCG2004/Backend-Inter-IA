import Stripe from "stripe"
import Usuario from "../models/Usuario.js"
import Payment from "../models/Payment.js"
import dotenv from 'dotenv'

dotenv.config()

const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY)

const realizarDonacion = async (req, res) => {
    try {
        // Recibimos la cantidad que el usuario QUIERA donar
        // mensaje: Un texto opcional de aliento (ej: "¡Gran app, sigan así!")
        const { paymentMethodId, amount, mensaje } = req.body

        if (!req.usuario || !req.usuario._id) {
            return res.status(401).json({ msg: "No autorizado" })
        }

        if (!paymentMethodId || !amount) {
            return res.status(400).json({ msg: "Faltan datos de pago o monto" })
        }

        // 1. Obtener usuario
        const usuario = await Usuario.findById(req.usuario._id)

        // 2. Gestión del Cliente en Stripe (Evitar duplicados)
        let customerId = usuario.stripeCustomerId
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: usuario.email,
                name: `${usuario.nombre} ${usuario.apellido}`,
                metadata: { userId: usuario._id.toString() }
            })
            customerId = customer.id
            await Usuario.findByIdAndUpdate(usuario._id, { stripeCustomerId: customerId })
        }

        // 3. Crear el intento de pago (Donación)
        // Nota: Stripe recibe 'amount' en centavos. Si el front envía 5 USD, aquí debe llegar 500 o multiplicarlo.
        // Asumiremos que el Front envía el numero entero (ej: 10 dolares) y nosotros convertimos a centavos.
        const amountInCents = Math.round(amount * 100) 

        const payment = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: "usd",
            description: `Donación al proyecto - Mensaje: ${mensaje || 'Sin mensaje'}`,
            payment_method: paymentMethodId,
            confirm: true,
            customer: customerId,
            receipt_email: usuario.email,
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: "never"
            }
        })

        // 4. Verificar resultado
        if (payment.status === "succeeded") {
            // A. Guardar registro histórico
            const newPayment = new Payment({
                user: usuario._id,
                amount: amount, // Guardamos 10 (dólares) en BDD, no 1000 (centavos)
                currency: "usd",
                paymentMethodId: paymentMethodId,
                stripePaymentIntentId: payment.id,
                status: payment.status,
                mensaje: mensaje || "Apoyo al proyecto"
            })
            await newPayment.save()

            // B. Actualizar estatus del usuario (Reconocimiento)
            // Sumamos lo donado y marcamos como supporter
            usuario.totalDonado = (usuario.totalDonado || 0) + parseFloat(amount)
            usuario.isSupporter = true
            await usuario.save()

            return res.status(200).json({ 
                msg: "¡Muchas gracias por tu donación! Tu apoyo nos ayuda a seguir creciendo.", 
                isSupporter: true
            })
        } else {
            return res.status(400).json({ msg: `La donación no se pudo procesar. Estado: ${payment.status}` })
        }

    } catch (error) {
        console.error("Error en Stripe Donation:", error)
        res.status(500).json({ msg: `❌ Error al procesar la donación: ${error.message}` })
    }
}

// Para mostrar al usuario su historial de apoyos
const obtenerHistorialDonaciones = async (req, res) => {
    try {
        const donaciones = await Payment.find({ user: req.usuario._id }).sort({ createdAt: -1 })
        res.status(200).json(donaciones)
    } catch (error) {
        res.status(500).json({ msg: "Error al obtener historial" })
    }
}

export { realizarDonacion, obtenerHistorialDonaciones }