import dotenv from 'dotenv';
import app from './server.js';
import connection from './database.js';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Chat from './models/Chat.js';
import Usuario from './models/Usuario.js';

// 1. Configuración de entorno y Base de Datos
dotenv.config();

// Ejecutamos la conexión (asegúrate que connection() sea async y use process.env.MONGODB_URI)
await connection();

const server = http.createServer(app);

// 2. Configuración de Socket.io para Producción
const io = new Server(server, {
    cors: {
        // Permitimos localhost para desarrollo y tu URL de producción
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
    },
    // Recomendado para despliegues con balanceadores de carga (como Render o Vercel)
    transports: ['websocket', 'polling'] 
});

// ---------------------------------------------------------
// 3. MIDDLEWARE DE SEGURIDAD (Socket Auth)
// ---------------------------------------------------------
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
            return next(new Error("Authentication error: No token provided"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded; 
        next();
    } catch (error) {
        console.error("Socket Auth Error:", error.message);
        next(new Error("Authentication error: Invalid token"));
    }
});

// ---------------------------------------------------------
// 4. LÓGICA DE EVENTOS (Rooms y Messaging)
// ---------------------------------------------------------
io.on('connection', (socket) => {
    // Sala privada automática para el usuario
    if (socket.user.rol === 'usuario') {
        socket.join(socket.user.id);
    }

    // El Admin se une a salas específicas de soporte
    socket.on('join_room', (targetUserId) => {
        if (socket.user.rol === 'administrador' && targetUserId) {
            socket.join(targetUserId);
        }
    });

    socket.on('send_message', async (data) => {
        try {
            const { message, userId } = data;
            if (!message || !userId) return;

            // Validación de integridad en BDD
            const usuarioExiste = await Usuario.exists({ _id: userId });
            if (!usuarioExiste) {
                return socket.emit('error_message', { msg: "Destinatario no válido" });
            }

            const realSenderRole = socket.user.rol === 'administrador' ? 'admin' : 'user';

            const newMessage = new Chat({
                user: userId,
                message,
                senderRole: realSenderRole
            });
            
            await newMessage.save();

            // Emitir a la sala del usuario (ambos, admin y user, la escuchan)
            io.to(userId).emit('receive_message', newMessage);

        } catch (error) {
            console.error("Socket Error:", error);
        }
    });

    socket.on('disconnect', () => {
        // Lógica de presencia opcional aquí
    });
});

// 5. Inicio del Servidor (Usando el puerto del sistema)
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`📡 WebSocket server listening on port ${PORT}`);

});
