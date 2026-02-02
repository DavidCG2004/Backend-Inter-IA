import {Schema, model} from 'mongoose'
import bcrypt from "bcryptjs"

const usuarioSchema = new Schema({
    nombre:{
        type:String,
        required:true,
        trim:true
    },
    apellido:{
        type:String,
        required:true,
        trim:true
    },
    direccion:{
        type:String,
        trim:true,
        default:null
    },
    celular:{
        type:String,
        trim:true,
        default:null
    },
    email:{
        type:String,
        required:true,
        trim:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    status:{
        type:Boolean,
        default:true
    },
    token:{
        type:String,
        default:null
    },
    confirmEmail:{
        type:Boolean,
        default:false
    },
    rol:{
        type:String,
        default:"usuario"
    },
    bio: { 
        type: String,
        default: "" },
    puesto: { 
        type: String,
        default: "" }, 
    resumenProfesional: { 
        type: String,
        default: "" },
    habilidades: [{ type: String }],
    experiencia: [{ type: String }],
    educacion: [{ type: String }],
    linkedinUrl: { 
        type: String,
        default: "" },
    stripeCustomerId: {
        type: String,
        default: null
    },
    isSupporter: {
        type: Boolean,
        default: false
    },
    totalDonado: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});


// Método para encriptar el password
usuarioSchema.methods.encryptPassword = async function(password){
    const salt = await bcrypt.genSalt(10)
    const passwordEncryp = await bcrypt.hash(password,salt)
    return passwordEncryp
}

// Método para verificar si el password es correcto
usuarioSchema.methods.matchPassword = async function(password){
    const response = await bcrypt.compare(password,this.password)
    return response
}

// Método para crear un token 
usuarioSchema.methods.createToken= function(){
    const tokenGenerado = Math.random().toString(36).slice(2)
    this.token = tokenGenerado
    return tokenGenerado
}

export default model('Usuario', usuarioSchema)