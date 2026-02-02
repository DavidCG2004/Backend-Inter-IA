import multer from 'multer'

// Usamos memoryStorage. El archivo se guarda temporalmente en la RAM del servidor.
// Esto es ideal para Vercel y PDFs ligeros (< 4MB).
const storage = multer.memoryStorage()

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 4 * 1024 * 1024 }, // Límite de 4MB (Vercel tiene límite estricto de body size)
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true)
        } else {
            cb(new Error('Formato no válido. Solo se permiten archivos PDF'), false)
        }
    }
})

export default upload