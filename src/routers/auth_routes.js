import { Router } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';

const router = Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get('/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login', session: false }),
    (req, res) => {
        // Generar el Token
        const token = jwt.sign(
            { id: req.user._id, rol: req.user.rol }, 
            process.env.JWT_SECRET || 'secret_key', 
            { expiresIn: '1d' }
        );

        // 1. Obtener la URL del .env o usar una por defecto (fallback)
        const baseUrl = process.env.URL_FRONTEND || 'http://localhost:5173/';

        // 2. Construir la URL completa
        // Asegúrate de que en el .env la URL NO termine en /
        const urlFrontend = `${baseUrl}login-success?token=${token}&rol=${req.user.rol}`;
        
        console.log(`🚀 Redirigiendo a: ${urlFrontend}`);
        res.redirect(urlFrontend);
    }
);

export default router;