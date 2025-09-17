const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const voiceRoutes = require('./routes/voice');
const { logInfo, logError } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Función para crear directorios necesarios
const createDirectories = () => {
  const dirs = ['uploads', 'logs', 'public'];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logInfo(`📁 Directorio ${dir} creado`);
    }
  });
};

// Crear directorios antes de inicializar
createDirectories();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos
app.use('/public', express.static('public'));
app.use('/uploads', express.static('uploads'));

// Configuración de multer para archivos de audio
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + '.wav');
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB límite
  fileFilter: (req, file, cb) => {
    const allowedTypes = /wav|mp3|ogg|webm|m4a/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de audio'));
    }
  }
});

// Rutas principales
app.use('/voice', upload.single('audio'), voiceRoutes);

// Widget de voz - ruta principal
app.get('/widget', (req, res) => {
  const widgetPath = path.join(__dirname, 'public', 'widget.html');
  
  if (fs.existsSync(widgetPath)) {
    res.sendFile(widgetPath);
  } else {
    res.status(404).send(`
      <h1>Widget no encontrado</h1>
      <p>Crea el archivo: public/widget.html</p>
      <p>Instrucciones: <a href="/">Ver documentación</a></p>
    `);
  }
});

// Endpoint para obtener información del negocio (para el widget)
app.get('/api/business/:businessId', async (req, res) => {
  try {
    const businessId = req.params.businessId;
    
    // Información por defecto
    const defaultBusiness = {
      id: businessId,
      name: businessId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      type: 'restaurante',
      phone: 'Consultar',
      address: 'Consultar',
      hours: 'Lunes a Domingo: 12:00 - 24:00'
    };
    
    // Si tienes Dashboard API, descomenta esto:
    /*
    const dashboardResponse = await fetch(`${process.env.DASHBOARD_BASE_URL}/api/business/${businessId}`);
    if (dashboardResponse.ok) {
      const businessData = await dashboardResponse.json();
      return res.json(businessData);
    }
    */
    
    res.json(defaultBusiness);
  } catch (error) {
    logError('Error obteniendo datos del negocio:', error);
    res.status(500).json({ error: 'Error obteniendo información del negocio' });
  }
});

// Ruta de salud
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Asisteme Voice API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    directories: {
      uploads: fs.existsSync('uploads') ? 'OK' : 'Missing',
      logs: fs.existsSync('logs') ? 'OK' : 'Missing',
      public: fs.existsSync('public') ? 'OK' : 'Missing'
    },
    config: {
      openai_configured: !!process.env.OPENAI_API_KEY,
      dashboard_url: process.env.DASHBOARD_BASE_URL || 'Not configured',
      phone_provider: process.env.PHONE_PROVIDER || 'Not set'
    }
  };
  
  res.json(healthStatus);
});

// Ruta principal con información del servicio
app.get('/', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.json({
    service: 'Asisteme - Asistente de Voz',
    version: '1.0.0',
    description: 'API de asistente de voz para reservas y atención al cliente',
    endpoints: {
      widget: `${baseUrl}/widget`,
      voice_api: `${baseUrl}/voice/call`,
      webhook: `${baseUrl}/voice/webhook`,
      health: `${baseUrl}/health`,
      business_info: `${baseUrl}/api/business/{businessId}`
    },
    usage: {
      widget_url: `${baseUrl}/widget?business=nombre-restaurante`,
      embed_code: `<iframe src="${baseUrl}/widget?business=nombre-restaurante" width="100%" height="600px"></iframe>`,
      direct_link: `${baseUrl}/widget?business=nombre-restaurante`
    },
    status: 'Funcionando correctamente',
    documentation: 'https://docs.fluxo.com/asisteme'
  });
});

// Endpoint de prueba para el widget
app.post('/test-widget', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No se proporcionó archivo de audio' 
      });
    }

    logInfo('🧪 Prueba de widget recibida');
    
    res.json({
      success: true,
      message: 'Audio recibido correctamente',
      file: {
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path
      },
      test: true
    });

    // Limpiar archivo de prueba después de 5 segundos
    setTimeout(() => {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }, 5000);

  } catch (error) {
    logError('Error en prueba de widget:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error procesando prueba' 
    });
  }
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  logError('Error del servidor:', err);
  
  // Error de multer (archivo demasiado grande, tipo incorrecto, etc.)
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false,
        error: 'Archivo demasiado grande. Máximo 25MB.' 
      });
    }
    return res.status(400).json({ 
      success: false,
      error: `Error de archivo: ${err.message}` 
    });
  }
  
  // Error de tipo de archivo
  if (err.message === 'Solo se permiten archivos de audio') {
    return res.status(400).json({ 
      success: false,
      error: 'Formato de archivo no válido. Use WAV, MP3, OGG, WebM o M4A.' 
    });
  }
  
  res.status(500).json({ 
    success: false,
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
  });
});

// Middleware 404
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint no encontrado',
    path: req.path,
    available_endpoints: [
      '/health',
      '/widget',
      '/voice/call',
      '/voice/webhook',
      '/api/business/:businessId'
    ]
  });
});

// Validar configuración al iniciar
const validateConfig = () => {
  const errors = [];
  
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('tu_opena')) {
    errors.push('❌ OPENAI_API_KEY no configurada correctamente');
  }
  
  if (!process.env.DASHBOARD_BASE_URL || process.env.DASHBOARD_BASE_URL.includes('tu-dashboard')) {
    logError('⚠️ DASHBOARD_BASE_URL no configurada - usando valores por defecto');
  }
  
  if (errors.length > 0) {
    logError('🚨 ERRORES DE CONFIGURACIÓN:');
    errors.forEach(error => logError(error));
    logError('🔧 Configura las variables de entorno en Railway');
    return false;
  }
  
  return true;
};

// Iniciar servidor
app.listen(PORT, () => {
  logInfo(`🚀 Asisteme Voice API funcionando en puerto ${PORT}`);
  logInfo(`🌐 Servidor disponible en: http://localhost:${PORT}`);
  logInfo(`📱 Dashboard conectado a: ${process.env.DASHBOARD_BASE_URL || 'No configurado'}`);
  logInfo(`🎙️ Servicio de voz iniciado correctamente`);
  
  // Validar configuración
  const configValid = validateConfig();
  if (configValid) {
    logInfo('✅ Configuración válida - Todo listo para funcionar');
  } else {
    logError('❌ Configuración incompleta - Revisa variables de entorno');
  }
  
  logInfo(`🎯 Widget disponible en: http://localhost:${PORT}/widget`);
});