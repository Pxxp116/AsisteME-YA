const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const voiceRoutes = require('./routes/voice');
const { logInfo, logError } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/public', express.static('public'));
app.get('/widget', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'widget.html'));
});

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

// Crear directorio uploads si no existe
const fs = require('fs');
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Rutas
app.use('/voice', upload.single('audio'), voiceRoutes);

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Asisteme Voice API'
  });
});

// Ruta principal con información del servicio
app.get('/', (req, res) => {
  res.json({
    service: 'Asisteme - Asistente de Voz',
    version: '1.0.0',
    endpoints: {
      voice: '/voice/call',
      webhook: '/voice/webhook',
      health: '/health'
    },
    status: 'Funcionando correctamente'
  });
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  logError('Error del servidor:', err);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: err.message 
  });
});

// Middleware 404
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint no encontrado',
    path: req.path 
  });
});

app.listen(PORT, () => {
  logInfo(`🚀 Asisteme Voice API funcionando en puerto ${PORT}`);
  logInfo(`📱 Dashboard conectado a: ${process.env.DASHBOARD_BASE_URL}`);
  logInfo(`🎙️ Servicio de voz iniciado correctamente`);
});