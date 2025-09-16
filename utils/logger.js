const fs = require('fs');
const path = require('path');

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

/**
 * Formatea la fecha para los logs
 * @returns {string} - Fecha formateada
 */
function formatTimestamp() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * Obtiene el nombre del archivo de log para hoy
 * @returns {string} - Nombre del archivo
 */
function getLogFileName() {
  const today = new Date().toISOString().split('T')[0];
  return path.join(logsDir, `asisteme-${today}.log`);
}

/**
 * Escribe un mensaje en el archivo de log
 * @param {string} level - Nivel del log (INFO, ERROR, DEBUG)
 * @param {string} message - Mensaje
 * @param {any} data - Datos adicionales (opcional)
 */
function writeToFile(level, message, data = null) {
  try {
    const timestamp = formatTimestamp();
    const logMessage = data 
      ? `[${timestamp}] ${level}: ${message} ${JSON.stringify(data, null, 2)}\n`
      : `[${timestamp}] ${level}: ${message}\n`;
    
    fs.appendFileSync(getLogFileName(), logMessage);
  } catch (error) {
    console.error('Error escribiendo en archivo de log:', error);
  }
}

/**
 * Log de información
 * @param {string} message - Mensaje
 * @param {any} data - Datos adicionales (opcional)
 */
function logInfo(message, data = null) {
  const timestamp = formatTimestamp();
  
  // Escribir en consola con colores
  if (data) {
    console.log(`\x1b[36m[${timestamp}] INFO:\x1b[0m ${message}`, data);
  } else {
    console.log(`\x1b[36m[${timestamp}] INFO:\x1b[0m ${message}`);
  }
  
  // Escribir en archivo
  writeToFile('INFO', message, data);
}

/**
 * Log de error
 * @param {string} message - Mensaje
 * @param {any} error - Error o datos adicionales
 */
function logError(message, error = null) {
  const timestamp = formatTimestamp();
  
  // Escribir en consola con colores
  if (error) {
    console.error(`\x1b[31m[${timestamp}] ERROR:\x1b[0m ${message}`, error);
  } else {
    console.error(`\x1b[31m[${timestamp}] ERROR:\x1b[0m ${message}`);
  }
  
  // Escribir en archivo
  const errorData = error ? {
    message: error.message || error,
    stack: error.stack || 'No stack trace',
    name: error.name || 'Error'
  } : null;
  
  writeToFile('ERROR', message, errorData);
}

/**
 * Log de debug (solo en desarrollo)
 * @param {string} message - Mensaje
 * @param {any} data - Datos adicionales (opcional)
 */
function logDebug(message, data = null) {
  if (process.env.NODE_ENV === 'development') {
    const timestamp = formatTimestamp();
    
    // Escribir en consola con colores
    if (data) {
      console.log(`\x1b[35m[${timestamp}] DEBUG:\x1b[0m ${message}`, data);
    } else {
      console.log(`\x1b[35m[${timestamp}] DEBUG:\x1b[0m ${message}`);
    }
    
    // Escribir en archivo
    writeToFile('DEBUG', message, data);
  }
}

/**
 * Log de advertencia
 * @param {string} message - Mensaje
 * @param {any} data - Datos adicionales (opcional)
 */
function logWarning(message, data = null) {
  const timestamp = formatTimestamp();
  
  // Escribir en consola con colores
  if (data) {
    console.warn(`\x1b[33m[${timestamp}] WARNING:\x1b[0m ${message}`, data);
  } else {
    console.warn(`\x1b[33m[${timestamp}] WARNING:\x1b[0m ${message}`);
  }
  
  // Escribir en archivo
  writeToFile('WARNING', message, data);
}

/**
 * Log de llamada telefónica
 * @param {string} callId - ID de la llamada
 * @param {string} action - Acción realizada
 * @param {any} data - Datos de la llamada
 */
function logCall(callId, action, data = null) {
  const message = `CALL ${callId}: ${action}`;
  logInfo(message, data);
}

/**
 * Log de reserva
 * @param {string} businessId - ID del negocio
 * @param {string} action - Acción realizada
 * @param {any} reservationData - Datos de la reserva
 */
function logReservation(businessId, action, reservationData = null) {
  const message = `RESERVATION ${businessId}: ${action}`;
  logInfo(message, reservationData);
}

/**
 * Limpia archivos de log antiguos
 * @param {number} daysToKeep - Días de logs a mantener
 */
function cleanOldLogs(daysToKeep = 30) {
  try {
    const files = fs.readdirSync(logsDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let deletedCount = 0;
    
    files.forEach(file => {
      if (file.startsWith('asisteme-') && file.endsWith('.log')) {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
    });
    
    if (deletedCount > 0) {
      logInfo(`🧹 Eliminados ${deletedCount} archivos de log antiguos`);
    }
    
  } catch (error) {
    logError('Error limpiando logs antiguos:', error);
  }
}

/**
 * Obtiene estadísticas de logs
 * @returns {Object} - Estadísticas de uso
 */
function getLogStats() {
  try {
    const files = fs.readdirSync(logsDir);
    const logFiles = files.filter(f => f.startsWith('asisteme-') && f.endsWith('.log'));
    
    let totalSize = 0;
    let totalLines = 0;
    
    logFiles.forEach(file => {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
      
      const content = fs.readFileSync(filePath, 'utf8');
      totalLines += content.split('\n').length;
    });
    
    return {
      totalFiles: logFiles.length,
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      totalLines: totalLines,
      oldestFile: logFiles.length > 0 ? logFiles[0] : null,
      newestFile: logFiles.length > 0 ? logFiles[logFiles.length - 1] : null
    };
    
  } catch (error) {
    logError('Error obteniendo estadísticas de logs:', error);
    return null;
  }
}

// Limpiar logs antiguos al iniciar
cleanOldLogs();

// Programar limpieza diaria
setInterval(() => {
  cleanOldLogs();
}, 24 * 60 * 60 * 1000);

module.exports = {
  logInfo,
  logError,
  logDebug,
  logWarning,
  logCall,
  logReservation,
  cleanOldLogs,
  getLogStats
};