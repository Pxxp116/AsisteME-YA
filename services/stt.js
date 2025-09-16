const OpenAI = require('openai');
const fs = require('fs');
const { logInfo, logError } = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Transcribe audio file to text using OpenAI Whisper
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(audioPath) {
  try {
    logInfo(`🎙️ Transcribiendo audio: ${audioPath}`);
    
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Archivo de audio no encontrado: ${audioPath}`);
    }

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      language: 'es', // Español
      response_format: 'text',
      temperature: 0.2 // Menor temperatura para mayor precisión
    });

    const text = transcription.trim();
    logInfo(`📝 Texto transcrito: "${text}"`);
    
    return text;
    
  } catch (error) {
    logError('Error en transcripción:', error);
    
    if (error.message.includes('audio_longer_than_max_duration')) {
      throw new Error('El audio es demasiado largo. Máximo 25MB o 25 minutos.');
    }
    
    if (error.message.includes('invalid_file_format')) {
      throw new Error('Formato de audio no válido. Usa WAV, MP3, M4A, etc.');
    }
    
    throw new Error(`Error de transcripción: ${error.message}`);
  }
}

/**
 * Transcribe audio from buffer (útil para streams)
 * @param {Buffer} audioBuffer - Audio buffer
 * @param {string} filename - Filename with extension
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudioBuffer(audioBuffer, filename = 'audio.wav') {
  try {
    logInfo('🎙️ Transcribiendo audio desde buffer');
    
    // Crear archivo temporal
    const tempPath = `uploads/temp-${Date.now()}-${filename}`;
    fs.writeFileSync(tempPath, audioBuffer);
    
    // Transcribir
    const text = await transcribeAudio(tempPath);
    
    // Limpiar archivo temporal
    fs.unlinkSync(tempPath);
    
    return text;
    
  } catch (error) {
    logError('Error transcribiendo buffer:', error);
    throw error;
  }
}

/**
 * Valida que el audio sea válido para transcripción
 * @param {string} audioPath - Path to audio file
 * @returns {boolean} - True if valid
 */
function validateAudioFile(audioPath) {
  try {
    if (!fs.existsSync(audioPath)) {
      return false;
    }
    
    const stats = fs.statSync(audioPath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    
    // Whisper tiene límite de 25MB
    if (fileSizeInMB > 25) {
      logError(`Archivo muy grande: ${fileSizeInMB}MB (máximo 25MB)`);
      return false;
    }
    
    return true;
    
  } catch (error) {
    logError('Error validando archivo de audio:', error);
    return false;
  }
}

/**
 * Obtiene información del archivo de audio
 * @param {string} audioPath - Path to audio file
 * @returns {object} - Audio file info
 */
function getAudioInfo(audioPath) {
  try {
    if (!fs.existsSync(audioPath)) {
      return null;
    }
    
    const stats = fs.statSync(audioPath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    
    return {
      path: audioPath,
      sizeInMB: fileSizeInMB.toFixed(2),
      sizeInBytes: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime
    };
    
  } catch (error) {
    logError('Error obteniendo info del audio:', error);
    return null;
  }
}

module.exports = {
  transcribeAudio,
  transcribeAudioBuffer,
  validateAudioFile,
  getAudioInfo
};