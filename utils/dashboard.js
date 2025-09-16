const axios = require('axios');
const { logInfo, logError } = require('./logger');

const DASHBOARD_BASE_URL = process.env.DASHBOARD_BASE_URL;
const DASHBOARD_API_KEY = process.env.DASHBOARD_API_KEY;

/**
 * Configuración base para requests al dashboard
 */
const dashboardAxios = axios.create({
  baseURL: DASHBOARD_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    ...(DASHBOARD_API_KEY && { 'Authorization': `Bearer ${DASHBOARD_API_KEY}` })
  }
});

/**
 * Obtiene todos los datos del dashboard para un negocio
 * @param {string} businessId - ID del negocio
 * @returns {Promise<Object>} - Datos del negocio
 */
async function getDashboardData(businessId = 'default') {
  try {
    logInfo(`📊 Obteniendo datos del dashboard para: ${businessId}`);
    
    // Hacer requests paralelos para obtener toda la información
    const [
      businessInfo,
      menuData,
      tablesData,
      availabilityData,
      reservationsData
    ] = await Promise.allSettled([
      getBusinessInfo(businessId),
      getMenu(businessId),
      getTables(businessId),
      getAvailability(businessId),
      getReservations(businessId)
    ]);

    // Construir objeto con todos los datos
    const dashboardData = {
      businessId: businessId,
      name: businessInfo.status === 'fulfilled' ? businessInfo.value.name : 'Restaurante',
      type: businessInfo.status === 'fulfilled' ? businessInfo.value.type : 'restaurante',
      phone: businessInfo.status === 'fulfilled' ? businessInfo.value.phone : '',
      address: businessInfo.status === 'fulfilled' ? businessInfo.value.address : '',
      hours: businessInfo.status === 'fulfilled' ? businessInfo.value.hours : '',
      menu: menuData.status === 'fulfilled' ? menuData.value : [],
      tables: tablesData.status === 'fulfilled' ? tablesData.value : [],
      availableSlots: availabilityData.status === 'fulfilled' ? availabilityData.value : [],
      reservations: reservationsData.status === 'fulfilled' ? reservationsData.value : [],
      lastUpdated: new Date().toISOString()
    };

    logInfo(`✅ Datos del dashboard obtenidos correctamente`);
    return dashboardData;

  } catch (error) {
    logError('Error obteniendo datos del dashboard:', error);
    
    // Retornar datos por defecto en caso de error
    return {
      businessId: businessId,
      name: 'Restaurante',
      type: 'restaurante',
      phone: 'No disponible',
      address: 'No disponible',
      hours: 'Consultar horarios',
      menu: [],
      tables: [],
      availableSlots: [],
      reservations: [],
      lastUpdated: new Date().toISOString(),
      error: true
    };
  }
}

/**
 * Obtiene información básica del negocio
 * @param {string} businessId - ID del negocio
 * @returns {Promise<Object>} - Información del negocio
 */
async function getBusinessInfo(businessId) {
  try {
    const response = await dashboardAxios.get(`/api/business/${businessId}`);
    return response.data;
  } catch (error) {
    logError(`Error obteniendo info del negocio ${businessId}:`, error.message);
    throw error;
  }
}

/**
 * Obtiene el menú del restaurante
 * @param {string} businessId - ID del negocio
 * @returns {Promise<Array>} - Lista de items del menú
 */
async function getMenu(businessId) {
  try {
    const response = await dashboardAxios.get(`/api/business/${businessId}/menu`);
    return response.data;
  } catch (error) {
    logError(`Error obteniendo menú de ${businessId}:`, error.message);
    throw error;
  }
}

/**
 * Obtiene información de las mesas
 * @param {string} businessId - ID del negocio
 * @returns {Promise<Array>} - Lista de mesas
 */
async function getTables(businessId) {
  try {
    const response = await dashboardAxios.get(`/api/business/${businessId}/tables`);
    return response.data;
  } catch (error) {
    logError(`Error obteniendo mesas de ${businessId}:`, error.message);
    throw error;
  }
}

/**
 * Obtiene disponibilidad de horarios
 * @param {string} businessId - ID del negocio
 * @param {string} date - Fecha (opcional, por defecto hoy)
 * @returns {Promise<Array>} - Horarios disponibles
 */
async function getAvailability(businessId, date = null) {
  try {
    const dateParam = date || new Date().toISOString().split('T')[0];
    const response = await dashboardAxios.get(`/api/business/${businessId}/availability?date=${dateParam}`);
    return response.data;
  } catch (error) {
    logError(`Error obteniendo disponibilidad de ${businessId}:`, error.message);
    throw error;
  }
}

/**
 * Obtiene reservas existentes
 * @param {string} businessId - ID del negocio
 * @param {string} date - Fecha (opcional)
 * @returns {Promise<Array>} - Lista de reservas
 */
async function getReservations(businessId, date = null) {
  try {
    const dateParam = date || new Date().toISOString().split('T')[0];
    const response = await dashboardAxios.get(`/api/business/${businessId}/reservations?date=${dateParam}`);
    return response.data;
  } catch (error) {
    logError(`Error obteniendo reservas de ${businessId}:`, error.message);
    throw error;
  }
}

/**
 * Crea una nueva reserva
 * @param {string} businessId - ID del negocio
 * @param {Object} reservationData - Datos de la reserva
 * @returns {Promise<Object>} - Reserva creada
 */
async function makeReservation(businessId, reservationData) {
  try {
    logInfo(`📝 Creando reserva para ${businessId}:`, reservationData);
    
    // Validar datos requeridos
    const requiredFields = ['name', 'people', 'date', 'time'];
    for (const field of requiredFields) {
      if (!reservationData[field]) {
        throw new Error(`Campo requerido faltante: ${field}`);
      }
    }

    // Preparar datos de la reserva
    const reservationPayload = {
      customer_name: reservationData.name,
      customer_phone: reservationData.phone || 'No proporcionado',
      party_size: parseInt(reservationData.people),
      reservation_date: formatDate(reservationData.date),
      reservation_time: reservationData.time,
      notes: reservationData.notes || 'Reserva realizada por asistente de voz',
      source: 'voice_assistant',
      status: 'confirmed',
      created_at: new Date().toISOString()
    };

    const response = await dashboardAxios.post(`/api/business/${businessId}/reservations`, reservationPayload);
    
    logInfo(`✅ Reserva creada exitosamente:`, response.data);
    return response.data;

  } catch (error) {
    logError('Error creando reserva:', error);
    
    if (error.response) {
      logError('Response error:', error.response.data);
      throw new Error(`Error del servidor: ${error.response.data.message || 'Error desconocido'}`);
    }
    
    throw new Error(`Error de conexión: ${error.message}`);
  }
}

/**
 * Cancela una reserva existente
 * @param {string} businessId - ID del negocio
 * @param {string} reservationId - ID de la reserva
 * @returns {Promise<Object>} - Resultado de la cancelación
 */
async function cancelReservation(businessId, reservationId) {
  try {
    logInfo(`❌ Cancelando reserva ${reservationId} para ${businessId}`);
    
    const response = await dashboardAxios.delete(`/api/business/${businessId}/reservations/${reservationId}`);
    
    logInfo(`✅ Reserva cancelada exitosamente`);
    return response.data;

  } catch (error) {
    logError('Error cancelando reserva:', error);
    throw new Error(`Error cancelando reserva: ${error.message}`);
  }
}

/**
 * Actualiza una reserva existente
 * @param {string} businessId - ID del negocio
 * @param {string} reservationId - ID de la reserva
 * @param {Object} updateData - Datos a actualizar
 * @returns {Promise<Object>} - Reserva actualizada
 */
async function updateReservation(businessId, reservationId, updateData) {
  try {
    logInfo(`✏️ Actualizando reserva ${reservationId} para ${businessId}`);
    
    const response = await dashboardAxios.put(`/api/business/${businessId}/reservations/${reservationId}`, updateData);
    
    logInfo(`✅ Reserva actualizada exitosamente`);
    return response.data;

  } catch (error) {
    logError('Error actualizando reserva:', error);
    throw new Error(`Error actualizando reserva: ${error.message}`);
  }
}

/**
 * Busca reservas por nombre o teléfono
 * @param {string} businessId - ID del negocio
 * @param {string} searchTerm - Término de búsqueda
 * @returns {Promise<Array>} - Reservas encontradas
 */
async function searchReservations(businessId, searchTerm) {
  try {
    logInfo(`🔍 Buscando reservas para: ${searchTerm}`);
    
    const response = await dashboardAxios.get(`/api/business/${businessId}/reservations/search?q=${encodeURIComponent(searchTerm)}`);
    
    return response.data;

  } catch (error) {
    logError('Error buscando reservas:', error);
    throw error;
  }
}

/**
 * Formatea una fecha para el dashboard
 * @param {string} date - Fecha en formato humano
 * @returns {string} - Fecha formateada
 */
function formatDate(date) {
  try {
    if (date.toLowerCase() === 'hoy') {
      return new Date().toISOString().split('T')[0];
    }
    
    if (date.toLowerCase() === 'mañana') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    
    if (date.toLowerCase() === 'pasado mañana') {
      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      return dayAfterTomorrow.toISOString().split('T')[0];
    }
    
    // Si es una fecha en formato DD/MM o DD/MM/YYYY
    if (date.includes('/')) {
      const parts = date.split('/');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2] || new Date().getFullYear();
      return `${year}-${month}-${day}`;
    }
    
    return date;
    
  } catch (error) {
    logError('Error formateando fecha:', error);
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Verifica la conectividad con el dashboard
 * @returns {Promise<boolean>} - True si está conectado
 */
async function checkDashboardConnection() {
  try {
    const response = await dashboardAxios.get('/health');
    logInfo('✅ Conexión con dashboard OK');
    return true;
  } catch (error) {
    logError('❌ Error de conexión con dashboard:', error.message);
    return false;
  }
}

module.exports = {
  getDashboardData,
  getBusinessInfo,
  getMenu,
  getTables,
  getAvailability,
  getReservations,
  makeReservation,
  cancelReservation,
  updateReservation,
  searchReservations,
  checkDashboardConnection,
  formatDate
};