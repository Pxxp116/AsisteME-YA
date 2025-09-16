// Script para probar el asistente de voz localmente
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:3001';

/**
 * Prueba básica de salud del servidor
 */
async function testHealth() {
  try {
    console.log('🔍 Probando salud del servidor...');
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Servidor funcionando:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    return false;
  }
}

/**
 * Prueba de transcripción con archivo de audio
 */
async function testVoiceWithFile(audioFile, businessId = 'test') {
  try {
    console.log(`🎙️ Probando transcripción con archivo: ${audioFile}`);
    
    if (!fs.existsSync(audioFile)) {
      console.error(`❌ Archivo no encontrado: ${audioFile}`);
      return false;
    }

    const form = new FormData();
    form.append('audio', fs.createReadStream(audioFile));
    form.append('businessId', businessId);

    const response = await axios.post(`${BASE_URL}/voice/call`, form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 30000 // 30 segundos
    });

    console.log('✅ Respuesta del asistente:');
    console.log('📝 Texto transcrito:', response.data.userText);
    console.log('🤖 Respuesta:', response.data.assistantResponse);
    
    if (response.data.action) {
      console.log('⚡ Acción detectada:', response.data.action);
    }

    return true;

  } catch (error) {
    console.error('❌ Error en prueba de voz:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Prueba de conexión con dashboard
 */
async function testDashboardConnection() {
  try {
    console.log('🔗 Probando conexión con dashboard...');
    
    // Simular llamada al dashboard
    const mockBusinessId = 'test';
    const response = await axios.get(`${BASE_URL}/voice/test-dashboard?businessId=${mockBusinessId}`);
    
    console.log('✅ Conexión con dashboard OK');
    return true;
    
  } catch (error) {
    console.log('⚠️ Dashboard no disponible (normal en desarrollo)');
    return false;
  }
}

/**
 * Prueba de webhook simulando llamada entrante
 */
async function testWebhook() {
  try {
    console.log('📞 Probando webhook de llamada entrante...');
    
    const webhookData = {
      callId: 'test-call-' + Date.now(),
      from: '+34600123456',
      to: '+34900123456',
      direction: 'inbound',
      callStatus: 'in-progress',
      businessId: 'test'
    };

    const response = await axios.post(`${BASE_URL}/voice/webhook`, webhookData);
    
    console.log('✅ Webhook procesado correctamente');
    console.log('📋 Respuesta:', response.data);
    return true;
    
  } catch (error) {
    console.error('❌ Error en webhook:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Crea un archivo de audio de prueba con texto
 */
async function createTestAudio(text = "Hola, quiero hacer una reserva para dos personas esta noche a las nueve") {
  try {
    console.log('🎵 Generando archivo de audio de prueba...');
    
    const response = await axios.post(`${BASE_URL}/voice/test-tts`, {
      text: text
    });
    
    if (response.data.audioPath) {
      console.log('✅ Audio de prueba creado:', response.data.audioPath);
      return response.data.audioPath;
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ Error creando audio de prueba:', error.message);
    return null;
  }
}

/**
 * Ejecuta todas las pruebas
 */
async function runAllTests() {
  console.log('🚀 Iniciando pruebas del Asistente de Voz\n');
  
  const results = {
    health: false,
    dashboard: false,
    webhook: false,
    voice: false
  };

  // 1. Probar salud del servidor
  results.health = await testHealth();
  console.log('');

  if (!results.health) {
    console.log('❌ Servidor no disponible. Asegúrate de que esté ejecutándose.');
    return results;
  }

  // 2. Probar conexión con dashboard
  results.dashboard = await testDashboardConnection();
  console.log('');

  // 3. Probar webhook
  results.webhook = await testWebhook();
  console.log('');

  // 4. Probar con archivo de audio (si tienes uno)
  const testAudioFiles = [
    'test-audio.wav',
    'test-audio.mp3',
    'audio-test.wav'
  ];

  for (const audioFile of testAudioFiles) {
    if (fs.existsSync(audioFile)) {
      results.voice = await testVoiceWithFile(audioFile);
      break;
    }
  }

  if (!results.voice) {
    console.log('⚠️ No se encontraron archivos de audio de prueba');
    console.log('💡 Crea un archivo "test-audio.wav" para probar la transcripción');
  }

  console.log('\n📊 RESUMEN DE PRUEBAS:');
  console.log('='.repeat(40));
  console.log(`Salud del servidor: ${results.health ? '✅' : '❌'}`);
  console.log(`Conexión dashboard: ${results.dashboard ? '✅' : '⚠️'}`);
  console.log(`Webhook: ${results.webhook ? '✅' : '❌'}`);
  console.log(`Transcripción de voz: ${results.voice ? '✅' : '⚠️'}`);
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  console.log(`\n🎯 Pruebas pasadas: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('🎉 ¡Todas las pruebas pasaron! El asistente está listo.');
  } else if (passed >= 2) {
    console.log('⚠️ Algunas pruebas fallaron, pero el core funciona.');
  } else {
    console.log('❌ Muchas pruebas fallaron. Revisa la configuración.');
  }

  return results;
}

/**
 * Función principal
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    await runAllTests();
  } else {
    const command = args[0];
    
    switch (command) {
      case 'health':
        await testHealth();
        break;
      case 'webhook':
        await testWebhook();
        break;
      case 'voice':
        const audioFile = args[1] || 'test-audio.wav';
        await testVoiceWithFile(audioFile);
        break;
      case 'dashboard':
        await testDashboardConnection();
        break;
      case 'create-audio':
        const text = args[1] || "Hola, quiero hacer una reserva";
        await createTestAudio(text);
        break;
      default:
        console.log('Comandos disponibles:');
        console.log('  node test-voice.js              # Ejecutar todas las pruebas');
        console.log('  node test-voice.js health        # Probar salud del servidor');
        console.log('  node test-voice.js webhook       # Probar webhook');
        console.log('  node test-voice.js voice [file]  # Probar transcripción');
        console.log('  node test-voice.js dashboard     # Probar dashboard');
        console.log('  node test-voice.js create-audio "texto" # Crear audio de prueba');
    }
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testHealth,
  testVoiceWithFile,
  testDashboardConnection,
  testWebhook,
  runAllTests
};