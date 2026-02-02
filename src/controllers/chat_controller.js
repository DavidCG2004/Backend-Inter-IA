import Chat from '../models/Chat.js'

// Obtener historial de chat del usuario logueado
const getChatHistory = async (req, res) => {
    try {
        const usuarioID = req.usuario._id
        
        // Buscamos los mensajes asociados a este usuario, ordenados cronológicamente
        const messages = await Chat.find({ user: usuarioID })
            .sort({ createdAt: 1 }) // 1 para ascendente (más viejo a más nuevo)

        res.status(200).json(messages)
    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: "Error al obtener historial de chat" })
    }
}

export { getChatHistory }