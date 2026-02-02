import Administrador from "../models/Administrador.js"
import { sendMailToRecoveryPassword, sendMailToRegister } from "../helpers/sendMail.js"
import { crearTokenJWT } from "../middlewares/JWT.js"
import mongoose from "mongoose"
import Usuario from "../models/Usuario.js"

const registro = async (req,res)=>{

    try {
        const {email,password} = req.body
        if (Object.values(req.body).includes("")) return res.status(400).json({msg:"Lo sentimos, debes llenar todos los campos"})
        const verificarEmailBDD = await Administrador.findOne({email})
        if(verificarEmailBDD) return res.status(400).json({msg:"Lo sentimos, el email ya se encuentra registrado"})
        const nuevoAdministrador = new Administrador(req.body)
        nuevoAdministrador.password = await nuevoAdministrador.encryptPassword(password)
       
        const token = nuevoAdministrador.createToken()
        await sendMailToRegister(email,token)
        await nuevoAdministrador.save()
        res.status(200).json({msg:"Revisa tu correo electrónico para confirmar tu cuenta"})

    } catch (error) {
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }

}

const confirmarMail = async (req, res) => {
    try {
        const { token } = req.params
        const administradorBDD = await Administrador.findOne({ token })
        if (!administradorBDD) return res.status(404).json({ msg: "Token inválido o cuenta ya confirmada" })
        administradorBDD.token = null
        administradorBDD.confirmEmail = true
        await administradorBDD.save()
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
        const administradorBDD = await Administrador.findOne({ email })
        if (!administradorBDD) return res.status(404).json({ msg: "El usuario no se encuentra registrado" })
        const token = administradorBDD.createToken()
        administradorBDD.token = token
        await sendMailToRecoveryPassword(email, token)
        await administradorBDD.save()
        res.status(200).json({ msg: "Revisa tu correo electrónico para reestablecer tu cuenta" })
        
    } catch (error) {
    console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}


const comprobarTokenPasword = async (req,res)=>{
    try {
        const {token} = req.params
        const administradorBDD = await Administrador.findOne({token})
        if(administradorBDD?.token !== token) return res.status(404).json({msg:"Lo sentimos, no se puede validar la cuenta"})
        res.status(200).json({msg:"Token confirmado, ya puedes crear tu nuevo password"}) 
    
    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}



const crearNuevoPassword = async (req,res)=>{
    try {
        const{password,confirmpassword} = req.body
        const { token } = req.params
        if (Object.values(req.body).includes("")) return res.status(404).json({msg:"Debes llenar todos los campos"})
        if(password !== confirmpassword) return res.status(404).json({msg:"Los passwords no coinciden"})
        const administradorBDD = await Administrador.findOne({token})
        if(!administradorBDD) return res.status(404).json({msg:"No se puede validar la cuenta"})
        administradorBDD.token = null
        administradorBDD.password = await administradorBDD.encryptPassword(password)
        await administradorBDD.save()
        res.status(200).json({msg:"Felicitaciones, ya puedes iniciar sesión con tu nuevo password"}) 

    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}

const login = async(req,res)=>{

    try {
        const {email,password} = req.body
        if (Object.values(req.body).includes("")) return res.status(404).json({msg:"Debes llenar todos los campos"})
        const administradorBDD = await Administrador.findOne({email}).select("-status -__v -token -updatedAt -createdAt")
        if(!administradorBDD) return res.status(404).json({msg:"El usuario no se encuentra registrado"})
        if(!administradorBDD.confirmEmail) return res.status(403).json({msg:"Debes verificar tu cuenta antes de iniciar sesión"})
        const verificarPassword = await administradorBDD.matchPassword(password)
        if(!verificarPassword) return res.status(401).json({msg:"El password no es correcto"})
        const {nombre,apellido,direccion,telefono,_id,rol} = administradorBDD
		const token = crearTokenJWT(administradorBDD._id,administradorBDD.rol)
    
        res.status(200).json({
            token,
            rol,
            nombre,
            apellido,
            direccion,
            telefono,
            _id,
            email:administradorBDD.email
        })

    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}

const perfil =(req,res)=>{
	const {token,confirmEmail,createdAt,updatedAt,__v,...datosPerfil} = req.administradorHeader
    res.status(200).json(datosPerfil)
}

const actualizarPerfil = async (req,res)=>{

    try {
        const {id} = req.params
        const {nombre,apellido,direccion,celular,email} = req.body
        if( !mongoose.Types.ObjectId.isValid(id) ) return res.status(400).json({msg:`ID inválido: ${id}`})
        const administradorBDD = await Administrador.findById(id)
        if(!administradorBDD) return res.status(404).json({ msg: `No existe el veterinario con ID ${id}` })
        if (Object.values(req.body).includes("")) return res.status(400).json({msg:"Debes llenar todos los campos"})
        if (administradorBDD.email !== email)
        {
            const emailExistente  = await Administrador.findOne({email})
            if (emailExistente )
            {
                return res.status(404).json({msg:`El email ya se encuentra registrado`})  
            }
        }
        administradorBDD.nombre = nombre ?? administradorBDD.nombre
        administradorBDD.apellido = apellido ?? administradorBDD.apellido
        administradorBDD.direccion = direccion ?? administradorBDD.direccion
        administradorBDD.celular = celular ?? administradorBDD.celular
        administradorBDD.email = email ?? administradorBDD.email
        await administradorBDD.save()
        res.status(200).json(administradorBDD)
        
    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}


const actualizarPassword = async (req,res)=>{
    try {
        const administradorBDD = await Administrador.findById(req.administradorHeader._id)
        if(!administradorBDD) return res.status(404).json({msg:`Lo sentimos, no existe el administrador ${id}`})
        const verificarPassword = await administradorBDD.matchPassword(req.body.passwordactual)
        if(!verificarPassword) return res.status(404).json({msg:"Lo sentimos, el password actual no es el correcto"})
        administradorBDD.password = await administradorBDD.encryptPassword(req.body.passwordnuevo)
        await administradorBDD.save()

    res.status(200).json({msg:"Password actualizado correctamente"})
    } catch (error) {
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}


const obtenerDashboard = async (req, res) => {
    try {
        const [totalAdministradores, totalUsuarios, ultimosUsuarios] = await Promise.all([
            Administrador.countDocuments(),
            Usuario.countDocuments(),
            Usuario.find().sort({ createdAt: -1 }).limit(5).select("-password -token -status")
        ])

        // Aquí podrías agregar más datos como "Entrevistas", "Vacantes", etc.
        
        res.status(200).json({
            stats: {
                administradores: totalAdministradores,
                usuarios: totalUsuarios
            },
            dataReciente: {
                ultimosRegistros: ultimosUsuarios
            }
        })

    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error al obtener dashboard - ${error}` })
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
    ,obtenerDashboard
}