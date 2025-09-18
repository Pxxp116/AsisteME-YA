const axios = require('axios');
const { logInfo, logError } = require('./logger');

// URL del BACKEND real que tiene los datos (no el dashboard frontend)
const BACKEND_BASE_URL = 'https://backend-2-production-227a.up.railway.app/api';
const DASHBOARD_API_KEY = process.env.DASHBOARD_API_KEY;

/**
 * Configuración base para requests al backend real
 */
const backendAxios = axios.create({
  baseURL: BACKEND_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'AsistemeVoice/1.0',
    ...(DASHBOARD_API_KEY && { 'Authorization': `Bearer ${DASHBOARD_API_KEY}` })
  }
});

/**
 * Obtiene todos los datos del backend para un negocio
 * @param {string} businessId - ID del negocio
 * @returns {Promise<Object>} - Datos del negocio
 */
async function getDashboardData(businessId = 'default') {
  try {
    logInfo(`📊 Obteniendo datos del backend real para: ${businessId}`);
    
    // Hacer requests paralelos usando los endpoints reales del backend
    const [
      restauranteInfo,
      menuData,
      mesasData,
      horariosData
    ] = await Promise.allSettled([
      getRestauranteInfo(),
      getMenu(),
      getMesas(),
      getHorariosDisponibles()
    ]);

    // Construir objeto con todos los datos reales del backend
    const dashboardData = {
      businessId: businessId,
      name: restauranteInfo.status === 'fulfilled' && restauranteInfo.value?.nombre ? 
            restauranteInfo.value.nombre : 'Restaurante',
      type: 'restaurante',
      phone: restauranteInfo.status === 'fulfilled' && restauranteInfo.value?.telefono ? 
             restauranteInfo.value.telefono : 'Consultar',
      address: restauranteInfo.status === 'fulfilled' && restauranteInfo.value?.direccion ? 
               restauranteInfo.value.direccion : 'Consultar',
      hours: restauranteInfo.status === 'fulfilled' && restauranteInfo.value?.horario ? 
             restauranteInfo.value.horario : 'Consultar horarios',
      menu: menuData.status === 'fulfilled' ? menuData.value : [],
      tables: mesasData.status === 'fulfilled' ? mesasData.value : [],
      availableSlots: horariosData.status === 'fulfilled' ? horariosData.value : [],
      lastUpdated: new Date().toISOString()
    };

    logInfo(`✅ Datos del backend obtenidos correctamente`);
    logInfo(`🍽️ Menu items: ${dashboardData.menu.length}`);
    logInfo(`🪑 Tables: ${dashboardData.tables.length}`);
    
    return dashboardData;

  } catch (error) {
    logError('Error obteniendo datos del backend:', error);
    
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
      lastUpdated: new Date().toISOString(),
      error: true
    };
  }
}

/**
 * Obtiene información del restaurante del backend real
 * @returns {Promise<Object>} - Información del restaurante
 */
async function getRestauranteInfo() {
  try {
    const response = await backendAxios.get('/admin/restaurante');
    logInfo('✅ Info restaurante obtenida del backend');
    return response.data;
  } catch (error) {
    logError('Error obteniendo info del restaurante:', error.message);
    throw error;
  }
}

/**
 * Obtiene el menú del backend real
 * @returns {Promise<Array>} - Lista de items del menú
 */
async function getMenu() {
  try {
    const response = await backendAxios.get('/ver-menu');
    logInfo('✅ Menú obtenido del backend');
    
    // El backend devuelve las categorías con sus platos
    const menuItems = [];
    if (response.data && Array.isArray(response.data)) {
      response.data.forEach(categoria => {
        if (categoria.platos && Array.isArray(categoria.platos)) {
          categoria.platos.forEach(plato => {
            menuItems.push({
              id: plato.id,
              name: plato.nombre,
              description: plato.descripcion,
              price: plato.precio ? `€${plato.precio}` : 'Consultar precio',
              category: categoria.nombre,
              available: plato.disponible !== false
            });
          });
        }
      });
    }
    
    logInfo(`🍽️ ${menuItems.length} platos encontrados en el menú`);
    return menuItems;
    
  } catch (error) {
    logError('Error obteniendo menú:', error.message);
    throw error;
  }
}

/**
 * Obtiene información de las mesas del backend real
 * @returns {Promise<Array>} - Lista de mesas
 */
async function getMesas() {
  try {
    const response = await backendAxios.get('/admin/mesas');
    logInfo('✅ Mesas obtenidas del backend');
    
    const mesas = response.data || [];
    return mesas.map(mesa => ({
      id: mesa.id,
      number: mesa.numero,
      capacity: mesa.capacidad,
      status: mesa.estado || 'disponible'
    }));
    
  } catch (error) {
    logError('Error obteniendo mesas:', error.message);
    throw error;
  }
}

/**
 * Obtiene horarios disponibles del backend real
 * @param {string} date - Fecha (opcional, por defecto hoy)
 * @returns {Promise<Array>} - Horarios disponibles
 */
async function getHorariosDisponibles(date = null) {
  try {
    const dateParam = date || new Date().toISOString().split('T')[0];
    const response = await backendAxios.get(`/horarios-disponibles?fecha=${dateParam}`);
    logInfo('✅ Horarios disponibles obtenidos del backend');
    
    return response.data || [];
    
  } catch (error) {
    logError('Error obteniendo horarios disponibles:', error.message);
    throw error;
  }
}

/**
 * Crea una nueva reserva en el backend real
 * @param {string} businessId - ID del negocio
 * @param {Object} reservationData - Datos de la reserva
 * @returns {Promise<Object>} - Reserva creada
 */
async function makeReservation(businessId, reservationData) {
  try {
    logInfo(`📝 Creando reserva en backend para ${businessId}:`, reservationData);
    
    // Validar datos requeridos
    const requiredFields = ['name', 'people', 'date', 'time'];
    for (const field of requiredFields) {
      if (!reservationData[field]) {
        throw new Error(`Campo requerido faltante: ${field}`);
      }
    }

    // Primero buscar mesa disponible en el backend
    const mesaResponse = await buscarMesa({
      fecha: formatDate(reservationData.date),
      hora: reservationData.time,
      personas: parseInt(reservationData.people)
    });

    if (!mesaResponse || !mesaResponse.mesaId) {
      throw new Error('No hay mesas disponibles para esa fecha y hora');
    }

    // Preparar datos para el backend real
    const reservationPayload = {
      mesaId: mesaResponse.mesaId,
      fecha: formatDate(reservationData.date),
      hora: reservationData.time,
      personas: parseInt(reservationData.people),
      cliente: {
        nombre: reservationData.name,
        telefono: reservationData.phone || 'No proporcionado',
        email: reservationData.email || ''
      },
      notas: reservationData.notes || 'Reserva realizada por asistente de voz',
      origen: 'asistente_voz'
    };

    const response = await backendAxios.post('/crear-reserva', reservationPayload);
    
    logInfo(`✅ Reserva creada exitosamente en backend:`, response.data);
    return response.data;

  } catch (error) {
    logError('Error creando reserva en backend:', error);
    
    if (error.response) {
      logError('Backend response error:', error.response.data);
      throw new Error(`Error del backend: ${error.response.data.message || error.response.statusText}`);
    }
    
    throw new Error(`Error de conexión con backend: ${error.message}`);
  }
}

/**
 * Busca mesa disponible en el backend real
 * @param {Object} searchParams - Parámetros de búsqueda
 * @returns {Promise<Object>} - Resultado de la búsqueda
 */
async function buscarMesa(searchParams) {
  try {
    logInfo('🔍 Buscando mesa disponible en backend:', searchParams);
    
    const response = await backendAxios.post('/buscar-mesa', searchParams);
    
    logInfo('✅ Búsqueda de mesa completada en backend');
    return response.data;
    
  } catch (error) {
    logError('Error buscando mesa en backend:', error.message);
    throw error;
  }
}

/**
 * Consulta una reserva existente en el backend real
 * @param {string} criterio - Nombre, teléfono o ID de reserva
 * @returns {Promise<Array>} - Reservas encontradas
 */
async function consultarReserva(criterio) {
  try {
    logInfo(`🔍 Consultando reserva en backend: ${criterio}`);
    
    const response = await backendAxios.get(`/consultar-reserva?criterio=${encodeURIComponent(criterio)}`);
    
    return response.data || [];
    
  } catch (error) {
    logError('Error consultando reserva en backend:', error.message);
    throw error;
  }
}

/**
 * Cancela una reserva existente en el backend real
 * @param {string} reservationId - ID de la reserva
 * @returns {Promise<Object>} - Resultado de la cancelación
 */
async function cancelReservation(reservationId) {
  try {
    logInfo(`❌ Cancelando reserva ${reservationId} en backend`);
    
    const response = await backendAxios.delete(`/cancelar-reserva/${reservationId}`);
    
    logInfo(`✅ Reserva cancelada exitosamente en backend`);
    return response.data;

  } catch (error) {
    logError('Error cancelando reserva en backend:', error);
    throw new Error(`Error cancelando reserva: ${error.message}`);
  }
}

/**
 * Obtiene el espejo-gpt que podría contener todos los datos
 * @returns {Promise<Object>} - Datos del espejo GPT
 */
async function getEspejoGPT() {
  try {
    logInfo('🔍 Obteniendo espejo-gpt del backend');
    
    const response = await backendAxios.get('/espejo-gpt');
    
    logInfo('✅ Espejo-gpt obtenido del backend');
    return response.data;
    
  } catch (error) {
    logError('Error obteniendo espejo-gpt:', error.message);
    throw error;
  }
}

/**
 * Formatea una fecha para el backend
 * @param {string} date - Fecha en formato humano
 * @returns {string} - Fecha formateada YYYY-MM-DD
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
    
    // Si ya está en formato YYYY-MM-DD
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return date;
    }
    
    return new Date().toISOString().split('T')[0];
    
  } catch (error) {
    logError('Error formateando fecha:', error);
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Verifica la conectividad con el backend real
 * @returns {Promise<boolean>} - True si está conectado
 */
async function checkDashboardConnection() {
  try {
    // Probar diferentes endpoints para verificar conexión
    const testEndpoints = ['/ping', '/health', '/api/ping'];
    
    for (const endpoint of testEndpoints) {
      try {
        await backendAxios.get(endpoint);
        logInfo(`✅ Conexión con backend OK via ${endpoint}`);
        return true;
      } catch (error) {
        continue;
      }
    }
    
    logError('❌ No se pudo conectar con ningún endpoint del backend');
    return false;
    
  } catch (error) {
    logError('❌ Error general de conexión con backend:', error.message);
    return false;
  }
}

module.exports = {
  getDashboardData,
  getRestauranteInfo,
  getMenu,
  getMesas,
  getHorariosDisponibles,
  makeReservation,
  buscarMesa,
  consultarReserva,
  cancelReservation,
  getEspejoGPT,
  checkDashboardConnection,
  formatDate
};