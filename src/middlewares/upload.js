import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

// Configuración para ES Modules y rutas absolutas
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Asegura que la carpeta uploads exista, si no la crea (opcional pero recomendado)
        const uploadPath = path.join(process.cwd(), 'uploads')
        if (!fs.existsSync(uploadPath)){
            fs.mkdirSync(uploadPath);
        }
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`)
    }
})

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true)
    } else {
        cb(new Error('Formato no válido. Solo se permiten archivos PDF'), false)
    }
}

const upload = multer({ storage: storage, fileFilter: fileFilter })

export default upload