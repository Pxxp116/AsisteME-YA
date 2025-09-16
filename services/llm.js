const OpenAI = require('openai');
const { logInfo, logError } = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Procesa la conversación con el LLM
 * @param {Array} messages - Historial de mensajes
 * @param {Object} dashboardData - Datos del dashboard del negocio
 * @param {string} businessId - ID del negocio
 * @returns {Promise<Object>} - Respuesta del asistente
 */
async function processConversation(messages, dashboardData, businessId) {
  try {
    logInfo(`🧠 Procesando conversación para negocio: ${businessId}`);
    
    // Sistema prompt personalizado basado en los datos del dashboard
    const systemPrompt = createSystemPrompt(dashboardData, businessId);
    
    // Preparar mensajes para OpenAI
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    logInfo(`📨 Enviando ${openaiMessages.length} mensajes al LLM`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Más económico que GPT-4
      messages: openaiMessages,
      max_tokens: 300, // Respuestas concisas para voz
      temperature: 0.7,
      frequency_penalty: 0.3,
      presence_penalty: 0.3
    });

    const responseText = completion.choices[0].message.content.trim();
    
    // Analizar si necesita hacer alguna acción
    const action = analyzeForActions(responseText, messages);
    
    logInfo(`🎯 Respuesta generada: "${responseText}"`);
    if (action) {
      logInfo(`⚡ Acción detectada: ${action.type}`);
    }

    return {
      message: responseText,
      action: action,
      tokens_used: completion.usage.total_tokens
    };

  } catch (error) {
    logError('Error en procesamiento LLM:', error);
    
    // Respuesta de fallback
    return {
      message: "Lo siento, tengo dificultades técnicas en este momento. ¿Podrías intentarlo de nuevo?",
      action: null,
      error: true
    };
  }
}

/**
 * Crea el prompt del sistema basado en los datos del dashboard
 * @param {Object} dashboardData - Datos del negocio
 * @param {string} businessId - ID del negocio
 * @returns {string} - System prompt
 */
function createSystemPrompt(dashboardData, businessId) {
  const businessInfo = dashboardData || {};
  
  let prompt = `Eres un asistente virtual profesional y amigable para ${businessInfo.name || 'nuestro negocio'}. 

INFORMACIÓN DEL NEGOCIO:
- Nombre: ${businessInfo.name || 'Restaurante'}
- Tipo: ${businessInfo.type || 'Restaurante'}
- Horarios: ${businessInfo.hours || 'Consultar disponibilidad'}
- Teléfono: ${businessInfo.phone || 'No disponible'}
- Dirección: ${businessInfo.address || 'No disponible'}

`;

  // Agregar información del menú si está disponible
  if (businessInfo.menu && businessInfo.menu.length > 0) {
    prompt += `MENÚ DISPONIBLE:\n`;
    businessInfo.menu.forEach(item => {
      prompt += `- ${item.name}: ${item.price || 'Consultar precio'}${item.description ? ` (${item.description})` : ''}\n`;
    });
    prompt += `\n`;
  }

  // Agregar disponibilidad de mesas si está disponible
  if (businessInfo.tables && businessInfo.tables.length > 0) {
    prompt += `MESAS DISPONIBLES:\n`;
    businessInfo.tables.forEach(table => {
      prompt += `- Mesa ${table.number}: ${table.capacity} personas (${table.status})\n`;
    });
    prompt += `\n`;
  }

  // Horarios disponibles para reservas
  if (businessInfo.availableSlots && businessInfo.availableSlots.length > 0) {
    prompt += `HORARIOS DISPONIBLES HOY:\n`;
    businessInfo.availableSlots.forEach(slot => {
      prompt += `- ${slot.time} (${slot.available ? 'Disponible' : 'Ocupado'})\n`;
    });
    prompt += `\n`;
  }

  prompt += `INSTRUCCIONES IMPORTANTES:
1. Habla de forma natural y conversacional, como un camarero amigable
2. Mantén las respuestas cortas (máximo 2-3 frases) porque es una conversación por voz
3. Puedes ayudar con: información del menú, hacer reservas, consultar disponibilidad, dar direcciones
4. Para hacer una reserva necesitas: nombre, número de personas, fecha, hora preferida
5. Si necesitas hacer una reserva, termina tu respuesta con: [ACCIÓN:RESERVA]
6. Si el cliente quiere terminar la llamada, despídete cordialmente
7. Siempre confirma los detalles de las reservas antes de procesarlas
8. Habla en español de España de forma natural y cercana

EJEMPLOS DE RESPUESTAS:
- "¡Hola! Bienvenido a [nombre]. ¿En qué puedo ayudarte?"
- "Por supuesto, tenemos mesa para 4 personas. ¿Para qué día y hora te gustaría?"
- "Perfecto, he reservado una mesa para 2 personas el viernes a las 21:00 a nombre de María."

Recuerda: Eres la voz del restaurante, sé profesional pero cercano.`;

  return prompt;
}

/**
 * Analiza el texto para detectar acciones necesarias
 * @param {string} responseText - Respuesta del LLM
 * @param {Array} messages - Historial de mensajes
 * @returns {Object|null} - Acción a realizar
 */
function analyzeForActions(responseText, messages) {
  try {
    // Detectar si es una confirmación de reserva
    if (responseText.includes('[ACCIÓN:RESERVA]')) {
      return extractReservationData(messages, responseText);
    }

    // Detectar otras acciones futuras
    if (responseText.toLowerCase().includes('consultar disponibilidad')) {
      return {
        type: 'check_availability',
        data: {}
      };
    }

    return null;

  } catch (error) {
    logError('Error analizando acciones:', error);
    return null;
  }
}

/**
 * Extrae datos de reserva de la conversación
 * @param {Array} messages - Historial de mensajes
 * @param {string} responseText - Respuesta del LLM
 * @returns {Object} - Datos de la reserva
 */
function extractReservationData(messages, responseText) {
  try {
    logInfo('🔍 Extrayendo datos de reserva de la conversación');
    
    // Buscar información en todos los mensajes del usuario
    const userMessages = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
    
    // Patrones para extraer información
    const nameMatch = userMessages.match(/(?:me llamo|soy|mi nombre es|a nombre de)\s+(\w+)/i);
    const peopleMatch = userMessages.match(/(\d+)\s*(?:personas?|comensales?|gente)/i);
    const timeMatch = userMessages.match(/(?:a las?|para las?)\s*(\d{1,2}):?(\d{0,2})/i);
    const dateMatch = userMessages.match(/(hoy|mañana|pasado mañana|\d{1,2}\/\d{1,2})/i);

    // Datos de la reserva
    const reservationData = {
      name: nameMatch ? nameMatch[1] : 'Cliente',
      people: peopleMatch ? parseInt(peopleMatch[1]) : 2,
      date: dateMatch ? dateMatch[1] : 'hoy',
      time: timeMatch ? `${timeMatch[1]}:${timeMatch[2] || '00'}` : '20:00',
      phone: 'No proporcionado',
      notes: userMessages.substring(0, 100)
    };

    logInfo(`📋 Datos de reserva extraídos:`, reservationData);

    return {
      type: 'make_reservation',
      data: reservationData
    };

  } catch (error) {
    logError('Error extrayendo datos de reserva:', error);
    return {
      type: 'make_reservation',
      data: {
        name: 'Cliente',
        people: 2,
        date: 'hoy',
        time: '20:00',
        phone: 'No proporcionado',
        notes: 'Reserva por voz'
      }
    };
  }
}

module.exports = {
  processConversation,
  createSystemPrompt,
  analyzeForActions,
  extractReservationData
};