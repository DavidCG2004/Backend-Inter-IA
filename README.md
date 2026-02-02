# 🚀 Backend-Inter-IA: Simulación de Entrevistas con Inteligencia Artificial

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)

Este es el componente **Backend** de la plataforma inteligente diseñada para la preparación de entrevistas técnicas. El sistema utiliza IA generativa para crear escenarios realistas, evaluar respuestas y analizar habilidades blandas de estudiantes y egresados de desarrollo de software.

## 🧠 Características Principales

- **Simulación Dinámica:** Integración con **Google Gemini API** para generar preguntas basadas en el CV del usuario o vacantes específicas.
- **Análisis de Sentimientos:** Evaluación de *soft skills* y tono comunicativo mediante modelos de **Hugging Face (NLP)**.
- **Gestión de Archivos:** Procesamiento de currículums en PDF mediante **Cloudinary**.
- **Comunicación en Tiempo Real:** Chat de soporte integrado con **Socket.io**.
- **Seguridad:** Autenticación robusta basada en **JWT** y cifrado de datos.
- **Pagos:** Módulo de donaciones integrado con **Stripe**.

## 🛠️ Stack Tecnológico

- **Entorno de ejecución:** Node.js
- **Framework:** Express.js (Arquitectura MVC)
- **Base de Datos:** MongoDB (Mongoose ODM)
- **IA/ML:** Google Gemini AI & Hugging Face Inference API
- **Almacenamiento:** Cloudinary
- **Despliegue:** Vercel / Render

## ⚙️ Instalación y Configuración

Sigue estos pasos para ejecutar el proyecto localmente:

### 1. Clonar el repositorio
```bash
git clone [https://github.com/tu-usuario/Backend-Inter-IA.git](https://github.com/tu-usuario/Backend-Inter-IA.git)
cd Backend-Inter-IA
