const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { logInfo, logError } = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Genera audio a partir de texto usando OpenAI TTS
 * @param {string} text - Texto a convertir en voz
 * @param {string} voice - Voz a usar (alloy, echo, fable, onyx, nova, shimmer)
 * @returns {Promise<string>} - Path al archivo de audio generado
 */
async function generateSpeech(text, voice = 'nova') {
  try {
    logInfo(`🗣️ Generando audio para: "${text.substring(0, 50)}..."`);
    
    if (!text || text.trim() === '') {
      throw new Error('Texto vacío para generar audio');
    }

    // Limpiar texto para TTS
    const cleanText = cleanTextForTTS(text);
    
    const response = await openai.audio.speech.create({
      model: 'tts-1', // Modelo más económico
      voice: voice, // nova tiene buena pronunciación en español
      input: cleanText,
      response_format: 'mp3',
      speed: 1.0 // Velocidad normal
    });

    // Generar nombre único para el archivo
    const filename = `speech-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;
    const filePath = path.join('uploads', filename);

    // Guardar archivo
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    logInfo(`🎵 Audio generado: ${filePath}`);
    
    return filePath;

  } catch (error) {
    logError('Error generando audio:', error);
    
    if (error.message.includes('text_too_long')) {
      throw new Error('El texto es demasiado largo para convertir a voz');
    }
    
    throw new Error(`Error de síntesis de voz: ${error.message}`);
  }
}

/**
 * Limpia el texto para mejorar la síntesis de voz
 * @param {string} text - Texto original
 * @returns {string} - Texto limpiado
 */
function cleanTextForTTS(text) {
  let cleanText = text.trim();
  
  // Remover marcadores de acción
  cleanText = cleanText.replace(/\[ACCIÓN:[^\]]+\]/g, '');
  
  // Reemplazar abreviaciones comunes
  cleanText = cleanText.replace(/\bdr\./gi, 'doctor');
  cleanText = cleanText.replace(/\bdra\./gi, 'doctora');
  cleanText = cleanText.replace(/\bsr\./gi, 'señor');
  cleanText = cleanText.replace(/\bsra\./gi, 'señora');
  cleanText = cleanText.replace(/\bc\//gi, 'calle');
  cleanText = cleanText.replace(/\bavda\./gi, 'avenida');
  cleanText = cleanText.replace(/\btel\./gi, 'teléfono');
  
  // Mejorar pronunciación de números de teléfono
  cleanText = cleanText.replace(/(\d{3})[\s-]?(\d{3})[\s-]?(\d{3})/g, '$1 $2 $3');
  
  // Mejorar pronunciación de horarios
  cleanText = cleanText.replace(/(\d{1,2}):(\d{2})/g, '$1 y $2');
  cleanText = cleanText.replace(/(\d{1,2}):00/g, '$1 en punto');
  cleanText = cleanText.replace(/(\d{1,2}):30/g, '$1 y media');
  
  // Separar números largos para mejor pronunciación
  cleanText = cleanText.replace(/\b(\d{4,})\b/g, (match) => {
    return match.split('').join(' ');
  });
  
  // Limpiar caracteres especiales problemáticos
  cleanText = cleanText.replace(/[^\w\s.,;:!?¡¿ñáéíóúüÁÉÍÓÚÜÑ]/g, '');
  
  // Asegurar que hay pauses apropiadas
  cleanText = cleanText.replace(/\.\s*/g, '. ');
  cleanText = cleanText.replace(/,\s*/g, ', ');
  
  return cleanText.trim();
}

/**
 * Genera audio con configuración personalizada
 * @param {string} text - Texto a convertir
 * @param {Object} options - Opciones de configuración
 * @returns {Promise<string>} - Path al archivo de audio
 */
async function generateSpeechCustom(text, options = {}) {
  const {
    voice = 'nova',
    speed = 1.0,
    format = 'mp3',
    model = 'tts-1'
  } = options;

  try {
    logInfo(`🎙️ Generando audio personalizado con voz: ${voice}`);
    
    const cleanText = cleanTextForTTS(text);
    
    const response = await openai.audio.speech.create({
      model: model,
      voice: voice,
      input: cleanText,
      response_format: format,
      speed: speed
    });

    const filename = `speech-custom-${Date.now()}.${format}`;
    const filePath = path.join('uploads', filename);

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    return filePath;

  } catch (error) {
    logError('Error en generación personalizada:', error);
    throw error;
  }
}

/**
 * Obtiene la URL pública del archivo de audio
 * @param {string} filePath - Path local del archivo
 * @param {string} baseUrl - URL base del servidor
 * @returns {string} - URL pública del archivo
 */
function getPublicAudioUrl(filePath, baseUrl) {
  try {
    const filename = path.basename(filePath);
    const publicUrl = `${baseUrl}/uploads/${filename}`;
    
    logInfo(`🌐 URL pública generada: ${publicUrl}`);
    return publicUrl;
    
  } catch (error) {
    logError('Error generando URL pública:', error);
    return null;
  }
}

/**
 * Elimina archivos de audio antiguos para liberar espacio
 * @param {number} maxAgeHours - Edad máxima en horas
 */
function cleanOldAudioFiles(maxAgeHours = 24) {
  try {
    const uploadsDir = 'uploads';
    const files = fs.readdirSync(uploadsDir);
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convertir a milisegundos
    let deletedCount = 0;

    files.forEach(file => {
      if (file.startsWith('speech-') && (file.endsWith('.mp3') || file.endsWith('.wav'))) {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        const fileAge = Date.now() - stats.mtime.getTime();

        if (fileAge > maxAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
    });

    if (deletedCount > 0) {
      logInfo(`🧹 Eliminados ${deletedCount} archivos de audio antiguos`);
    }

  } catch (error) {
    logError('Error limpiando archivos antiguos:', error);
  }
}

/**
 * Valida configuración de voz
 * @param {string} voice - Voz a validar
 * @returns {boolean} - True si es válida
 */
function validateVoice(voice) {
  const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  return validVoices.includes(voice.toLowerCase());
}

/**
 * Obtiene lista de voces disponibles con descripciones
 * @returns {Array} - Lista de voces con descripciones
 */
function getAvailableVoices() {
  return [
    { name: 'nova', description: 'Voz femenina cálida (recomendada para español)' },
    { name: 'alloy', description: 'Voz neutral equilibrada' },
    { name: 'echo', description: 'Voz masculina clara' },
    { name: 'fable', description: 'Voz expresiva británica' },
    { name: 'onyx', description: 'Voz masculina profunda' },
    { name: 'shimmer', description: 'Voz femenina suave' }
  ];
}

// Limpiar archivos antiguos al iniciar
cleanOldAudioFiles();

// Programar limpieza cada 6 horas
setInterval(() => {
  cleanOldAudioFiles();
}, 6 * 60 * 60 * 1000);

module.exports = {
  generateSpeech,
  generateSpeechCustom,
  getPublicAudioUrl,
  cleanOldAudioFiles,
  validateVoice,
  getAvailableVoices,
  cleanTextForTTS
};