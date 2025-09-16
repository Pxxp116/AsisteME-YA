// Configuración para diferentes proveedores de telefonía VoIP
// Compatible con múltiples servicios para España

const { logInfo, logError } = require('../utils/logger');

/**
 * Configuración para diferentes proveedores VoIP
 */
const PHONE_PROVIDERS = {
  // Configuración para Plivo (recomendado para España)
  plivo: {
    name: 'Plivo',
    baseUrl: 'https://api.plivo.com/v1',
    supportsSpain: true,
    pricing: {
      inbound: 0.02, // €/minuto
      outbound: 0.03,
      number: 3.00 // €/mes
    },
    features: ['voice', 'sms', 'recording'],
    webhookFormat: 'plivo'
  },
  
  // Configuración para Voximplant
  voximplant: {
    name: 'Voximplant',
    baseUrl: 'https://api.voximplant.com',
    supportsSpain: true,
    pricing: {
      inbound: 0.018,
      outbound: 0.025,
      number: 2.50
    },
    features: ['voice', 'video', 'recording', 'websocket'],
    webhookFormat: 'voximplant'
  },
  
  // Configuración para VoIP.ms (más técnico)
  voipms: {
    name: 'VoIP.ms',
    baseUrl: 'https://voip.ms/api/v1',
    supportsSpain: true,
    pricing: {
      inbound: 0.015,
      outbound: 0.02,
      number: 1.50
    },
    features: ['voice', 'sms'],
    webhookFormat: 'custom'
  }
};

/**
 * Configuración actual del proveedor
 */
const CURRENT_PROVIDER = process.env.PHONE_PROVIDER || 'plivo';

/**
 * Obtiene la configuración del proveedor actual
 * @returns {Object} - Configuración del proveedor
 */
function getProviderConfig() {
  const config = PHONE_PROVIDERS[CURRENT_PROVIDER];
  if (!config) {
    throw new Error(`Proveedor no configurado: ${CURRENT_PROVIDER}`);
  }
  return config;
}

/**
 * Configura webhook según el proveedor
 * @param {string} webhookUrl - URL del webhook
 * @returns {Object} - Configuración del webhook
 */
function setupWebhook(webhookUrl) {
  const provider = getProviderConfig();
  
  const configs = {
    plivo: {
      answer_url: webhookUrl + '/voice/webhook',
      answer_method: 'POST',
      hangup_url: webhookUrl + '/voice/hangup',
      hangup_method: 'POST'
    },
    
    voximplant: {
      webhook_url: webhookUrl + '/voice/webhook',
      method: 'POST',
      events: ['incoming_call', 'call_end', 'recording_ready']
    },
    
    voipms: {
      callback_url: webhookUrl + '/voice/webhook',
      callback_method: 'POST'
    }
  };
  
  return configs[CURRENT_PROVIDER] || configs.plivo;
}

/**
 * Genera respuesta TwiML/XML según el proveedor
 * @param {string} action - Acción a realizar
 * @param {Object} params - Parámetros adicionales
 * @returns {Object} - Respuesta en formato del proveedor
 */
function generateVoiceResponse(action, params = {}) {
  const provider = getProviderConfig();
  
  switch (action) {
    case 'play_and_record':
      return generatePlayAndRecord(provider, params);
    case 'play_and_hangup':
      return generatePlayAndHangup(provider, params);
    case 'say':
      return generateSay(provider, params);
    default:
      throw new Error(`Acción no soportada: ${action}`);
  }
}

/**
 * Genera respuesta para reproducir audio y grabar
 */
function generatePlayAndRecord(provider, params) {
  const { audio_url, record_options = {}, next_webhook } = params;
  
  switch (provider.webhookFormat) {
    case 'plivo':
      return {
        message: 'ok',
        content: `
          <Response>
            <Play>${audio_url}</Play>
            <Record action="${next_webhook}" 
                    maxLength="${record_options.max_duration || 10}"
                    timeout="${record_options.silence_timeout || 3}"
                    finishOnKey="${record_options.finish_on_key || '#'}"
                    playBeep="false"/>
          </Response>
        `.trim()
      };
      
    case 'voximplant':
      return {
        commands: [
          { command: 'playSound', url: audio_url },
          { 
            command: 'record',
            maxDuration: (record_options.max_duration || 10) * 1000,
            silenceTimeout: (record_options.silence_timeout || 3) * 1000,
            webhook: next_webhook
          }
        ]
      };
      
    default:
      return {
        action: 'play_and_record',
        audio_url: audio_url,
        record_options: record_options,
        next_webhook: next_webhook
      };
  }
}

/**
 * Genera respuesta para reproducir audio y colgar
 */
function generatePlayAndHangup(provider, params) {
  const { audio_url } = params;
  
  switch (provider.webhookFormat) {
    case 'plivo':
      return {
        message: 'ok',
        content: `
          <Response>
            <Play>${audio_url}</Play>
            <Hangup/>
          </Response>
        `.trim()
      };
      
    case 'voximplant':
      return {
        commands: [
          { command: 'playSound', url: audio_url },
          { command: 'hangup' }
        ]
      };
      
    default:
      return {
        action: 'play_and_hangup',
        audio_url: audio_url
      };
  }
}

/**
 * Genera respuesta para decir texto
 */
function generateSay(provider, params) {
  const { text, voice = 'es-ES-Standard-A' } = params;
  
  switch (provider.webhookFormat) {
    case 'plivo':
      return {
        message: 'ok',
        content: `
          <Response>
            <Speak voice="${voice}" language="es-ES">${text}</Speak>
          </Response>
        `.trim()
      };
      
    case 'voximplant':
      return {
        commands: [
          { 
            command: 'say',
            text: text,
            language: 'es-ES',
            voice: voice
          }
        ]
      };
      
    default:
      return {
        action: 'say',
        text: text,
        voice: voice
      };
  }
}

/**
 * Parsea request entrante según el proveedor
 * @param {Object} req - Request object
 * @returns {Object} - Datos parseados
 */
function parseIncomingCall(req) {
  const provider = getProviderConfig();
  
  switch (provider.webhookFormat) {
    case 'plivo':
      return {
        callId: req.body.CallUUID,
        from: req.body.From,
        to: req.body.To,
        direction: req.body.Direction,
        callStatus: req.body.CallStatus
      };
      
    case 'voximplant':
      return {
        callId: req.body.call_id,
        from: req.body.from_number,
        to: req.body.to_number,
        direction: 'inbound',
        callStatus: req.body.event
      };
      
    default:
      return {
        callId: req.body.callId || req.body.CallSid || Date.now().toString(),
        from: req.body.from || req.body.From,
        to: req.body.to || req.body.To,
        direction: req.body.direction || 'inbound',
        callStatus: req.body.status || 'in-progress'
      };
  }
}

/**
 * Parsea datos de grabación según el proveedor
 * @param {Object} req - Request object
 * @returns {Object} - Datos de grabación
 */
function parseRecording(req) {
  const provider = getProviderConfig();
  
  switch (provider.webhookFormat) {
    case 'plivo':
      return {
        callId: req.body.CallUUID,
        recordingUrl: req.body.RecordUrl,
        duration: req.body.Duration,
        digits: req.body.Digits
      };
      
    case 'voximplant':
      return {
        callId: req.body.call_id,
        recordingUrl: req.body.record_url,
        duration: req.body.duration,
        digits: req.body.dtmf
      };
      
    default:
      return {
        callId: req.body.callId || req.body.CallSid,
        recordingUrl: req.body.recordingUrl || req.body.RecordingUrl,
        duration: req.body.duration || req.body.RecordingDuration,
        digits: req.body.digits || req.body.Digits
      };
  }
}

/**
 * Valida configuración del proveedor
 * @returns {boolean} - True si la configuración es válida
 */
function validateConfig() {
  try {
    const provider = getProviderConfig();
    const required = ['name', 'supportsSpain', 'webhookFormat'];
    
    for (const field of required) {
      if (!provider[field]) {
        logError(`Campo requerido faltante en configuración: ${field}`);
        return false;
      }
    }
    
    if (!provider.supportsSpain) {
      logError(`Proveedor ${provider.name} no soporta números españoles`);
      return false;
    }
    
    logInfo(`✅ Configuración válida para proveedor: ${provider.name}`);
    return true;
    
  } catch (error) {
    logError('Error validando configuración:', error);
    return false;
  }
}

/**
 * Obtiene información de costos
 * @returns {Object} - Información de precios
 */
function getPricingInfo() {
  const provider = getProviderConfig();
  return {
    provider: provider.name,
    monthly_number_cost: `€${provider.pricing.number}/mes`,
    per_minute_inbound: `€${provider.pricing.inbound}/minuto`,
    per_minute_outbound: `€${provider.pricing.outbound}/minuto`,
    estimated_cost_per_call: `€${(provider.pricing.inbound * 3).toFixed(3)} (3 min)`,
    features: provider.features
  };
}

module.exports = {
  PHONE_PROVIDERS,
  CURRENT_PROVIDER,
  getProviderConfig,
  setupWebhook,
  generateVoiceResponse,
  parseIncomingCall,
  parseRecording,
  validateConfig,
  getPricingInfo
};