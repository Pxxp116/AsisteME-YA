# 🎙️ Asisteme - Asistente de Voz para Restaurantes

Asistente de voz inteligente que permite a los clientes hacer reservas y obtener información por teléfono, integrado con tu Dashboard de Fluxo.

## 🚀 Características

- ✅ **Transcripción de voz** con OpenAI Whisper
- ✅ **Procesamiento inteligente** con GPT-3.5-turbo
- ✅ **Síntesis de voz** con OpenAI TTS
- ✅ **Integración completa** con Dashboard de Fluxo
- ✅ **Reservas automáticas** por voz
- ✅ **Compatible con proveedores españoles** (Plivo, Voximplant)
- ✅ **Logs detallados** y monitoreo
- ✅ **API REST** para testing

## 💰 Costos Estimados

**Por llamada de 3 minutos:**
- Transcripción (Whisper): ~2¢
- Procesamiento (GPT-3.5): ~1¢
- Síntesis de voz (TTS): ~1¢
- Telefonía (Plivo): ~6¢
- **Total: ~10¢ por llamada**

**Costos mensuales:**
- Número telefónico: €3/mes
- 100 llamadas/mes: €10 + €3 = €13/mes

## 📦 Instalación

### 1. Clonar y configurar

```bash
# Crear directorio del proyecto
mkdir asisteme-voice
cd asisteme-voice

# Copiar archivos del código proporcionado
# (package.json, server.js, etc.)

# Instalar dependencias
npm install
```

### 2. Configurar variables de entorno

Crear archivo `.env`:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-tu_openai_api_key_aqui

# Dashboard API Configuration
DASHBOARD_BASE_URL=https://tu-dashboard-railway.up.railway.app
DASHBOARD_API_KEY=tu_dashboard_api_key_opcional

# Phone Provider (plivo, voximplant, voipms)
PHONE_PROVIDER=plivo

# Server Configuration
PORT=3001
NODE_ENV=development
```

### 3. Crear directorios necesarios

```bash
mkdir uploads
mkdir logs
mkdir test
```

### 4. Obtener API Keys

#### OpenAI (OBLIGATORIO)
1. Ve a [OpenAI Platform](https://platform.openai.com)
2. Crea una cuenta y obtén tu API key
3. Añade crédito ($5-10 para empezar)

#### Plivo para telefonía (RECOMENDADO)
1. Regístrate en [Plivo](https://www.plivo.com)
2. Compra un número español (+34)
3. Configura webhook: `https://tu-servidor.com/voice/webhook`

### 5. Ejecutar el servidor

```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 🔧 Configuración del Proveedor Telefónico

### Opción A: Plivo (Recomendado)
1. **Registrarse**: [plivo.com](https://www.plivo.com)
2. **Comprar número**: Panel → Numbers → Buy Number (España +34)
3. **Configurar webhook**:
   - URL: `https://tu-servidor.railway.app/voice/webhook`
   - Método: POST
4. **Obtener credenciales** del panel

### Opción B: Voximplant
1. **Registrarse**: [voximplant.com](https://voximplant.com)
2. **Configurar aplicación** VoIP
3. **Comprar número español**
4. **Configurar callback** a tu servidor

### Opción C: VoIP.ms (Más técnico)
1. **Registrarse**: [voip.ms](https://voip.ms)
2. **Configurar SIP trunk**
3. **Configurar Asterisk** (requiere conocimientos técnicos)

## 🧪 Testing

### Ejecutar todas las pruebas
```bash
node test/test-voice.js
```

### Pruebas individuales
```bash
# Probar salud del servidor
node test/test-voice.js health

# Probar webhook
node test/test-voice.js webhook

# Probar transcripción (necesitas archivo de audio)
node test/test-voice.js voice test-audio.wav
```

### Crear archivo de audio de prueba
```bash
# Grabar con tu micrófono y guardar como test-audio.wav
# O usar cualquier archivo .wav/.mp3 con voz en español
```

## 🔌 Integración con Dashboard

El asistente se conecta automáticamente a tu Dashboard existente usando las mismas APIs:

```javascript
// URLs que utiliza
GET  /api/business/{id}              # Info del negocio
GET  /api/business/{id}/menu         # Menú
GET  /api/business/{id}/tables       # Mesas
GET  /api/business/{id}/availability # Disponibilidad
POST /api/business/{id}/reservations # Crear reserva
```

## 📱 Flujo de una llamada

1. **Cliente llama** al número del restaurante
2. **Webhook recibe** la llamada
3. **Asistente saluda** con mensaje de bienvenida
4. **Cliente habla** (graba automáticamente)
5. **Whisper transcribe** el audio a texto
6. **GPT-3.5 procesa** la solicitud
7. **Dashboard API** consulta disponibilidad
8. **TTS genera** respuesta en audio
9. **Cliente escucha** la respuesta
10. **Si es reserva**: se guarda en el Dashboard

## 🚀 Despliegue en Railway

### 1. Preparar para producción

```bash
# Asegúrate de que package.json tenga scripts de start
"scripts": {
  "start": "node server.js"
}
```

### 2. Subir a Railway

```bash
# Conectar con Railway
railway login
railway init

# Configurar variables de entorno en Railway dashboard
# Subir código
git add .
git commit -m "Deploy Asisteme Voice"
git push origin main
```

### 3. Configurar dominio

En Railway dashboard:
1. Ve a Settings → Domains
2. Añade dominio personalizado o usa el generado
3. Actualiza webhook en Plivo con nueva URL

## 📊 Monitoreo y Logs

### Ver logs en tiempo real
```bash
# En desarrollo
tail -f logs/asisteme-$(date +%Y-%m-%d).log

# En Railway
railway logs
```

### Endpoints de monitoreo
- `GET /health` - Estado del servidor
- `GET /voice/stats` - Estadísticas de uso
- `GET /voice/logs` - Logs recientes

## 📈 Optimización y Rendimiento

### Reducir costos
```bash
# Usar GPT-3.5 en lugar de GPT-4 (ya configurado)
# Limitar duración de grabaciones a 10 segundos
# Usar modelo TTS-1 (más económico)
# Limpiar archivos temporales automáticamente
```

### Mejorar latencia
- Respuestas cortas (máximo 2-3 frases)
- Timeouts optimizados
- Cache de respuestas frecuentes
- Conexión persistente con Dashboard

## 🛠️ Personalización

### Cambiar voz del asistente
```javascript
// En services/tts.js
const voice = 'nova'; // Cambiar por: alloy, echo, fable, onyx, shimmer
```

### Personalizar prompts
```javascript
// En services/llm.js - función createSystemPrompt()
// Modificar el texto del sistema según tu negocio
```

### Añadir más proveedores telefónicos
```javascript
// En config/phone.js
// Añadir configuración de nuevo proveedor
```

## 🔍 Troubleshooting

### Error: "No se puede transcribir audio"
- ✅ Verificar que OPENAI_API_KEY esté configurado
- ✅ Comprobar que tengas crédito en OpenAI
- ✅ Verificar formato de audio (WAV, MP3, M4A)
- ✅ Archivo no debe superar 25MB

### Error: "Dashboard no responde"
- ✅ Verificar DASHBOARD_BASE_URL
- ✅ Comprobar que Dashboard esté ejecutándose
- ✅ Verificar conectividad de red
- ✅ Revisar logs de Dashboard

### Error: "Webhook no recibe llamadas"
- ✅ Verificar URL del webhook en Plivo
- ✅ Comprobar que servidor esté público (Railway)
- ✅ Verificar que puerto esté abierto
- ✅ Revisar logs del proveedor telefónico

### Audio se corta o distorsiona
- ✅ Ajustar velocidad de TTS (speed: 0.9)
- ✅ Usar conexión estable a internet
- ✅ Verificar calidad de línea telefónica

## 📞 Ejemplo de Conversación

```
🤖: ¡Hola! Soy el asistente virtual del Restaurante Mar Azul. ¿En qué puedo ayudarte?

👤: Hola, quiero hacer una reserva para esta noche

🤖: Perfecto, puedo ayudarte con eso. ¿Para cuántas personas sería la reserva?

👤: Para cuatro personas a las nueve de la noche

🤖: Entendido, mesa para 4 personas a las 21:00 horas. ¿A qué nombre haríamos la reserva?

👤: A nombre de García

🤖: Excelente, he reservado una mesa para 4 personas esta noche a las 21:00 a nombre de García. La reserva está confirmada. ¿Necesitas algo más?

👤: No, eso es todo, gracias

🤖: Perfecto. Te esperamos esta noche en el Restaurante Mar Azul. ¡Hasta luego!
```

## 🔄 Próximas mejoras

- [ ] **Reconocimiento de emociones** en la voz
- [ ] **Múltiples idiomas** (catalán, inglés)
- [ ] **Cancelación de reservas** por voz
- [ ] **Pedidos a domicilio** por teléfono
- [ ] **Integración con WhatsApp** Business
- [ ] **Analytics** avanzados de llamadas
- [ ] **A/B testing** de respuestas

## 💡 Tips de uso

### Para el restaurante:
1. **Pon el número** en Google Maps, web y redes sociales
2. **Entrena al personal** sobre cómo funciona el asistente
3. **Revisa reservas** diariamente en el Dashboard
4. **Monitorea logs** para mejorar respuestas

### Para desarrollo:
1. **Prueba localmente** antes de desplegar
2. **Usa logs detallados** para debugging
3. **Mantén backups** de configuración
4. **Actualiza APIs** regularmente

## 📝 Estructura de archivos

```
asisteme-voice/
├── server.js              # Servidor principal
├── package.json           # Dependencias
├── .env                   # Variables de entorno
├── routes/
│   └── voice.js           # Rutas de voz
├── services/
│   ├── stt.js            # Speech to Text
│   ├── llm.js            # Procesamiento LLM
│   └── tts.js            # Text to Speech
├── utils/
│   ├── dashboard.js      # Conexión Dashboard
│   └── logger.js         # Sistema de logs
├── config/
│   └── phone.js          # Configuración telefónica
├── test/
│   └── test-voice.js     # Scripts de prueba
├── uploads/              # Archivos temporales
└── logs/                 # Logs del sistema
```

## 🆘 Soporte

Si tienes problemas:

1. **Revisa logs**: `logs/asisteme-YYYY-MM-DD.log`
2. **Ejecuta tests**: `node test/test-voice.js`
3. **Verifica configuración**: Todas las API keys
4. **Comprueba conectividad**: Dashboard y proveedores

## 📄 Licencia

Código propietario de Fluxo. Uso interno únicamente.

---

**¡Tu asistente de voz está listo! 🎉**

Para empezar:
1. Configura las API keys
2. Ejecuta `npm run dev`
3. Haz pruebas con `node test/test-voice.js`
4. Despliega en Railway
5. Configura el número telefónico
6. ¡Empieza a recibir llamadas!