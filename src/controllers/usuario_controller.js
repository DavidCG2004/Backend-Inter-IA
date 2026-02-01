import Usuario from "../models/Usuario.js"
import { sendMailToRecoveryPassword, sendMailToRegister } from "../helpers/sendMail.js"
import { crearTokenJWT } from "../middlewares/JWT.js"
import mongoose from "mongoose"

const registro = async (req,res)=>{
    try {
        const {email, password} = req.body
        if (Object.values(req.body).includes("")) return res.status(400).json({msg:"Lo sentimos, debes llenar todos los campos"})
        
        const verificarEmailBDD = await Usuario.findOne({email})
        if(verificarEmailBDD) return res.status(400).json({msg:"Lo sentimos, el email ya se encuentra registrado"})
        
        const nuevoUsuario = new Usuario(req.body)
        nuevoUsuario.password = await nuevoUsuario.encryptPassword(password)
       
        const token = nuevoUsuario.createToken()
        await sendMailToRegister(email,token)
        await nuevoUsuario.save()
        res.status(200).json({msg:"Revisa tu correo electrónico para confirmar tu cuenta"})

    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}

const confirmarMail = async (req, res) => {
    try {
        const { token } = req.params
        const usuarioBDD = await Usuario.findOne({ token })
        if (!usuarioBDD) return res.status(404).json({ msg: "Token inválido o cuenta ya confirmada" })
        
        usuarioBDD.token = null
        usuarioBDD.confirmEmail = true
        await usuarioBDD.save()
        res.status(200).json({ msg: "Cuenta confirmada, ya puedes iniciar sesión" })

    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}

const recuperarPassword = async (req, res) => {
    try {
        const { email } = req.body
        if (!email) return res.status(400).json({ msg: "Debes ingresar un correo electrónico" })
        
        const usuarioBDD = await Usuario.findOne({ email })
        if (!usuarioBDD) return res.status(404).json({ msg: "El usuario no se encuentra registrado" })
        
        const token = usuarioBDD.createToken()
        usuarioBDD.token = token
        await sendMailToRecoveryPassword(email, token)
        await usuarioBDD.save()
        res.status(200).json({ msg: "Revisa tu correo electrónico para reestablecer tu cuenta" })
        
    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}

const comprobarTokenPasword = async (req,res)=>{
    try {
        const {token} = req.params
        const usuarioBDD = await Usuario.findOne({token})
        if(usuarioBDD?.token !== token) return res.status(404).json({msg:"Lo sentimos, no se puede validar la cuenta"})
        res.status(200).json({msg:"Token confirmado, ya puedes crear tu nuevo password"}) 
    
    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}

const crearNuevoPassword = async (req,res)=>{
    try {
        const{password, confirmpassword} = req.body
        const { token } = req.params
        if (Object.values(req.body).includes("")) return res.status(404).json({msg:"Debes llenar todos los campos"})
        if(password !== confirmpassword) return res.status(404).json({msg:"Los passwords no coinciden"})
        
        const usuarioBDD = await Usuario.findOne({token})
        if(!usuarioBDD) return res.status(404).json({msg:"No se puede validar la cuenta"})
        
        usuarioBDD.token = null
        usuarioBDD.password = await usuarioBDD.encryptPassword(password)
        await usuarioBDD.save()
        res.status(200).json({msg:"Felicitaciones, ya puedes iniciar sesión con tu nuevo password"}) 

    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}

const login = async(req,res)=>{
    try {
        const {email, password} = req.body
        if (Object.values(req.body).includes("")) return res.status(404).json({msg:"Debes llenar todos los campos"})
        
        const usuarioBDD = await Usuario.findOne({email}).select("-status -__v -token -updatedAt -createdAt")
        if(!usuarioBDD) return res.status(404).json({msg:"El usuario no se encuentra registrado"})
        if(!usuarioBDD.confirmEmail) return res.status(403).json({msg:"Debes verificar tu cuenta antes de iniciar sesión"})
        
        const verificarPassword = await usuarioBDD.matchPassword(password)
        if(!verificarPassword) return res.status(401).json({msg:"El password no es correcto"})
        
        const {nombre, apellido, direccion, telefono, _id, rol} = usuarioBDD
        const token = crearTokenJWT(usuarioBDD._id, usuarioBDD.rol)
    
        res.status(200).json({
            token,
            rol,
            nombre,
            apellido,
            direccion,
            telefono,
            _id,
            email: usuarioBDD.email
        })

    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}

const perfil = (req,res)=>{
    // Importante: Usamos req.usuario (según la actualización del middleware)
    const {token, confirmEmail, createdAt, updatedAt, __v, ...datosPerfil} = req.usuario
    res.status(200).json(datosPerfil)
}

const actualizarPerfil = async (req,res)=>{
    try {
        const {id} = req.params
        const {nombre, apellido, direccion, celular, email} = req.body
        
        if( !mongoose.Types.ObjectId.isValid(id) ) return res.status(400).json({msg:`ID inválido: ${id}`})
        
        const usuarioBDD = await Usuario.findById(id)
        if(!usuarioBDD) return res.status(404).json({ msg: `No existe el usuario con ID ${id}` })
        
        if (Object.values(req.body).includes("")) return res.status(400).json({msg:"Debes llenar todos los campos"})
        
        if (usuarioBDD.email !== email) {
            const emailExistente = await Usuario.findOne({email})
            if (emailExistente) return res.status(404).json({msg:`El email ya se encuentra registrado`})  
        }
        
        usuarioBDD.nombre = nombre ?? usuarioBDD.nombre
        usuarioBDD.apellido = apellido ?? usuarioBDD.apellido
        usuarioBDD.direccion = direccion ?? usuarioBDD.direccion
        usuarioBDD.celular = celular ?? usuarioBDD.celular
        usuarioBDD.email = email ?? usuarioBDD.email
        
        await usuarioBDD.save()
        res.status(200).json(usuarioBDD)
        
    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}

const actualizarPassword = async (req,res)=>{
    try {
        // req.usuario viene del middleware
        const usuarioBDD = await Usuario.findById(req.usuario._id)
        if(!usuarioBDD) return res.status(404).json({msg:`Lo sentimos, no existe el usuario`})
        
        const verificarPassword = await usuarioBDD.matchPassword(req.body.passwordactual)
        if(!verificarPassword) return res.status(404).json({msg:"Lo sentimos, el password actual no es el correcto"})
        
        usuarioBDD.password = await usuarioBDD.encryptPassword(req.body.passwordnuevo)
        await usuarioBDD.save()

        res.status(200).json({msg:"Password actualizado correctamente"})
    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}

export {
    registro,
    confirmarMail,
    recuperarPassword,
    comprobarTokenPasword,
    crearNuevoPassword,
    login,
    perfil,
    actualizarPerfil,
    actualizarPassword
}