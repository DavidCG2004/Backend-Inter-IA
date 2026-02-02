import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import Usuario from '../models/Usuario.js';

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "${process.env.URL_BACKEND}/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
        let usuario = await Usuario.findOne({ googleId: profile.id });
        if (!usuario) {
            usuario = await Usuario.findOne({ email: profile.emails[0].value });
            if (usuario) {
                usuario.googleId = profile.id;
                await usuario.save();
            } else {
                usuario = new Usuario({
                    nombre: profile.name.givenName,
                    apellido: profile.name.familyName || "",
                    email: profile.emails[0].value,
                    googleId: profile.id,
                    confirmEmail: true
                });
                await usuario.save();
            }
        }
        return done(null, usuario);
    } catch (error) {
        return done(error, null);
    }
  }

));
