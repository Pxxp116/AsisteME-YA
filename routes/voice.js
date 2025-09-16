const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const { transcribeAudio } = require('../services/stt');
const { processConversation } = require('../services/llm');
const { generateSpeech } = require('../services/tts');
const { getDashboardData, makeReservation } = require('../utils/dashboard');
const { logInfo, logError } = require('../utils/logger');

// Almacena conversaciones activas
const activeConversations = new Map();

// Webhook para llamadas entrantes (compatible con múltiples proveedores)
router.post('/webhook', async (req, res) => {
  try {
    logInfo('📞 Llamada entrante recibida');
    
    const callId = req.body.callId || req.body.CallSid || Date.now().toString();
    
    // Inicializar conversación
    activeConversations.set(callId, {
      businessId: req.body.businessId || 'default',
      messages: [],
      startTime: new Date()
    });

    // Respuesta inicial de bienvenida
    const welcomeMessage = "¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?";
    
    // Generar audio de bienvenida
    const welcomeAudio = await generateSpeech(welcomeMessage);
    
    // Respuesta compatible con diferentes proveedores VoIP
    const response = {
      action: 'play_and_record',
      audio_url: welcomeAudio,
      record_options: {
        max_duration: 10,
        silence_timeout: 3,
        finish_on_key: '#'
      },
      next_webhook: `${req.protocol}://${req.get('host')}/voice/process-response`
    };

    res.json(response);
    
  } catch (error) {
    logError('Error en webhook de llamada:', error);
    res.status(500).json({ error: 'Error procesando llamada' });
  }
});

// Procesar respuesta de usuario
router.post('/process-response', async (req, res) => {
  try {
    const callId = req.body.callId || req.body.CallSid;
    const recordingUrl = req.body.recordingUrl || req.body.RecordingUrl;
    
    if (!activeConversations.has(callId)) {
      throw new Error('Conversación no encontrada');
    }

    const conversation = activeConversations.get(callId);
    
    // Descargar y transcribir audio
    let userText = '';
    if (recordingUrl) {
      userText = await transcribeAudioFromUrl(recordingUrl);
    }
    
    if (!userText || userText.trim() === '') {
      // Si no hay texto, pedir que repita
      const retryMessage = "Lo siento, no pude escucharte bien. ¿Podrías repetir tu solicitud?";
      const retryAudio = await generateSpeech(retryMessage);
      
      return res.json({
        action: 'play_and_record',
        audio_url: retryAudio,
        record_options: {
          max_duration: 10,
          silence_timeout: 3
        },
        next_webhook: `${req.protocol}://${req.get('host')}/voice/process-response`
      });
    }

    logInfo(`👤 Usuario dijo: ${userText}`);
    
    // Agregar mensaje del usuario
    conversation.messages.push({
      role: 'user',
      content: userText,
      timestamp: new Date()
    });

    // Obtener datos del dashboard
    const dashboardData = await getDashboardData(conversation.businessId);
    
    // Procesar con LLM
    const response = await processConversation(
      conversation.messages, 
      dashboardData,
      conversation.businessId
    );
    
    logInfo(`🤖 Asistente responde: ${response.message}`);
    
    // Agregar respuesta del asistente
    conversation.messages.push({
      role: 'assistant',
      content: response.message,
      timestamp: new Date(),
      action: response.action
    });

    // Ejecutar acción si es necesaria (como hacer reserva)
    if (response.action && response.action.type === 'make_reservation') {
      try {
        await makeReservation(conversation.businessId, response.action.data);
        logInfo('✅ Reserva realizada correctamente');
      } catch (error) {
        logError('❌ Error al hacer reserva:', error);
      }
    }

    // Generar audio de respuesta
    const responseAudio = await generateSpeech(response.message);
    
    // Decidir si continuar la conversación o terminar
    const shouldContinue = !response.message.toLowerCase().includes('adiós') && 
                          !response.message.toLowerCase().includes('hasta luego');

    if (shouldContinue) {
      res.json({
        action: 'play_and_record',
        audio_url: responseAudio,
        record_options: {
          max_duration: 15,
          silence_timeout: 4
        },
        next_webhook: `${req.protocol}://${req.get('host')}/voice/process-response`
      });
    } else {
      // Terminar llamada
      activeConversations.delete(callId);
      res.json({
        action: 'play_and_hangup',
        audio_url: responseAudio
      });
    }

  } catch (error) {
    logError('Error procesando respuesta:', error);
    
    const errorMessage = "Lo siento, ha ocurrido un error. Por favor, inténtalo de nuevo más tarde.";
    const errorAudio = await generateSpeech(errorMessage);
    
    res.json({
      action: 'play_and_hangup',
      audio_url: errorAudio
    });
  }
});

// Endpoint para pruebas directas con archivo de audio
router.post('/call', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo de audio' });
    }

    const businessId = req.body.businessId || 'default';
    
    logInfo(`🎙️ Procesando audio para negocio: ${businessId}`);
    
    // Transcribir audio
    const userText = await transcribeAudio(req.file.path);
    logInfo(`👤 Usuario dijo: ${userText}`);
    
    if (!userText || userText.trim() === '') {
      return res.status(400).json({ 
        error: 'No se pudo transcribir el audio o está vacío' 
      });
    }

    // Obtener datos del dashboard
    const dashboardData = await getDashboardData(businessId);
    
    // Procesar conversación
    const messages = [{ role: 'user', content: userText }];
    const response = await processConversation(messages, dashboardData, businessId);
    
    logInfo(`🤖 Asistente responde: ${response.message}`);
    
    // Ejecutar acción si es necesaria
    if (response.action && response.action.type === 'make_reservation') {
      try {
        await makeReservation(businessId, response.action.data);
        logInfo('✅ Reserva realizada correctamente');
      } catch (error) {
        logError('❌ Error al hacer reserva:', error);
      }
    }

    // Generar audio de respuesta
    const audioPath = await generateSpeech(response.message);
    
    // Limpiar archivo temporal
    fs.unlinkSync(req.file.path);
    
    res.json({
      success: true,
      userText: userText,
      assistantResponse: response.message,
      audioPath: audioPath,
      action: response.action
    });
    
  } catch (error) {
    logError('Error en endpoint /call:', error);
    
    // Limpiar archivo si existe
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: 'Error procesando la solicitud',
      details: error.message 
    });
  }
});

// Función auxiliar para transcribir audio desde URL
async function transcribeAudioFromUrl(audioUrl) {
  try {
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Guardar temporalmente
    const tempFile = path.join('uploads', `temp-${Date.now()}.wav`);
    fs.writeFileSync(tempFile, buffer);
    
    // Transcribir
    const text = await transcribeAudio(tempFile);
    
    // Limpiar archivo temporal
    fs.unlinkSync(tempFile);
    
    return text;
  } catch (error) {
    logError('Error transcribiendo audio desde URL:', error);
    return '';
  }
}

// Endpoint para obtener conversación activa
router.get('/conversation/:callId', (req, res) => {
  const conversation = activeConversations.get(req.params.callId);
  if (conversation) {
    res.json(conversation);
  } else {
    res.status(404).json({ error: 'Conversación no encontrada' });
  }
});

module.exports = router;