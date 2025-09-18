const axios = require('axios');
const { logInfo, logError } = require('./logger');

// URL del backend real proporcionado por tu colega
const BACKEND_BASE_URL = 'https://backend-2-production-9cde.up.railway.app/api';
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
 * Obtiene todos los datos del backend usando el espejo
 * @param {string} businessId - ID del negocio
 * @returns {Promise<Object>} - Datos del negocio
 */
async function getDashboardData(businessId = 'default') {
  try {
    logInfo(`📊 Obteniendo datos del espejo para: ${businessId}`);
    
    // Usar el endpoint /espejo que contiene toda la información
    const [
      espejoData,
      menuData,
      horariosData
    ] = await Promise.allSettled([
      getEspejo(),
      getMenu(),
      getHorarios()
    ]);

    // Construir objeto con los datos del espejo
    const espejo = espejoData.status === 'fulfilled' ? espejoData.value : {};
    
    const dashboardData = {
      businessId: businessId,
      name: espejo.restaurante?.nombre || 'Restaurante',
      type: 'restaurante',
      phone: espejo.restaurante?.telefono || 'Consultar',
      address: espejo.restaurante?.direccion || 'Consultar',
      hours: horariosData.status === 'fulfilled' ? 
             formatHorarios(horariosData.value) : 'Consultar horarios',
      menu: menuData.status === 'fulfilled' ? menuData.value : [],
      tables: espejo.mesas || [],
      availableSlots: espejo.horariosDisponibles || [],
      reservations: espejo.reservas || [],
      lastUpdated: new Date().toISOString()
    };

    logInfo(`✅ Datos del espejo obtenidos correctamente`);
    logInfo(`🍽️ Menu items: ${dashboardData.menu.length}`);
    logInfo(`🪑 Tables: ${dashboardData.tables.length}`);
    
    return dashboardData;

  } catch (error) {
    logError('Error obteniendo datos del espejo:', error);
    
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
 * Obtiene el espejo completo con toda la información
 * @returns {Promise<Object>} - Datos completos del espejo
 */
async function getEspejo() {
  try {
    const response = await backendAxios.get('/espejo');
    logInfo('✅ Espejo completo obtenido del backend');
    return response.data;
  } catch (error) {
    logError('Error obteniendo espejo:', error.message);
    throw error;
  }
}

/**
 * Obtiene el menú del restaurante
 * @returns {Promise<Array>} - Lista de items del menú
 */
async function getMenu() {
  try {
    const response = await backendAxios.get('/ver-menu');
    logInfo('✅ Menú obtenido del backend');
    
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
 * Obtiene los horarios del restaurante
 * @returns {Promise<Object>} - Horarios del restaurante
 */
async function getHorarios() {
  try {
    const response = await backendAxios.get('/admin/horarios');
    logInfo('✅ Horarios obtenidos del backend');
    return response.data;
  } catch (error) {
    logError('Error obteniendo horarios:', error.message);
    throw error;
  }
}

/**
 * Consulta horario específico
 * @param {string} fecha - Fecha a consultar (opcional)
 * @returns {Promise<Object>} - Información del horario
 */
async function consultarHorario(fecha = null) {
  try {
    const params = fecha ? `?fecha=${fecha}` : '';
    const response = await backendAxios.get(`/consultar-horario${params}`);
    logInfo('✅ Horario consultado del backend');
    return response.data;
  } catch (error) {
    logError('Error consultando horario:', error.message);
    throw error;
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
 * Crea una nueva reserva en el backend real
 * @param {string} businessId - ID del negocio
 * @param {Object} reservationData - Datos de la reserva
 * @returns {Promise<Object>} - Reserva creada
 */
async function makeReservation(businessId, reservationData) {
  try {
    logInfo(`📝 Creando reserva en backend para ${businessId}:`, reservationData);
    
    const requiredFields = ['name', 'people', 'date', 'time'];
    for (const field of requiredFields) {
      if (!reservationData[field]) {
        throw new Error(`Campo requerido faltante: ${field}`);
      }
    }

    // Buscar mesa disponible primero
    const mesaSearch = {
      fecha: formatDate(reservationData.date),
      hora: reservationData.time,
      personas: parseInt(reservationData.people)
    };

    const mesaResponse = await buscarMesa(mesaSearch);

    if (!mesaResponse || (!mesaResponse.mesaId && !mesaResponse.mesa)) {
      throw new Error('No hay mesas disponibles para esa fecha y hora');
    }

    // Preparar datos para el backend real
    const reservationPayload = {
      mesaId: mesaResponse.mesaId || mesaResponse.mesa?.id,
      fecha: formatDate(reservationData.date),
      hora: reservationData.time,
      personas: parseInt(reservationData.people),
      cliente: {
        nombre: reservationData.name,
        telefono: reservationData.phone || 'Por confirmar',
        email: reservationData.email || ''
      },
      notas: reservationData.notes || 'Reserva realizada por asistente de voz',
      origen: 'asistente_voz'
    };

    const response = await backendAxios.post('/crear-reserva', reservationPayload);
    
    logInfo(`✅ Reserva creada exitosamente en backend:`, response.data);
    
    // Formatear respuesta para el asistente
    const reservaCreada = response.data;
    return {
      id: reservaCreada.id,
      numero: reservaCreada.numero || reservaCreada.id,
      cliente: reservaCreada.cliente?.nombre || reservationData.name,
      fecha: reservaCreada.fecha,
      hora: reservaCreada.hora,
      personas: reservaCreada.personas,
      mesa: reservaCreada.mesa?.numero || 'Por asignar',
      estado: reservaCreada.estado || 'confirmada'
    };

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
 * Modifica una reserva existente
 * @param {Object} reservaData - Datos de la reserva a modificar
 * @returns {Promise<Object>} - Reserva modificada
 */
async function modificarReserva(reservaData) {
  try {
    logInfo('✏️ Modificando reserva en backend:', reservaData);
    
    const response = await backendAxios.put('/modificar-reserva', reservaData);
    
    logInfo('✅ Reserva modificada exitosamente');
    return response.data;
    
  } catch (error) {
    logError('Error modificando reserva:', error.message);
    throw error;
  }
}

/**
 * Cancela una reserva existente
 * @param {string} reservationId - ID de la reserva
 * @returns {Promise<Object>} - Resultado de la cancelación
 */
async function cancelReservation(reservationId) {
  try {
    logInfo(`❌ Cancelando reserva ${reservationId} en backend`);
    
    const response = await backendAxios.delete(`/cancelar-reserva`, {
      data: { id: reservationId }
    });
    
    logInfo(`✅ Reserva cancelada exitosamente en backend`);
    return response.data;

  } catch (error) {
    logError('Error cancelando reserva en backend:', error);
    throw new Error(`Error cancelando reserva: ${error.message}`);
  }
}

/**
 * Formatea los horarios para mostrar al usuario
 * @param {Object} horarios - Horarios del restaurante
 * @returns {string} - Horarios formateados
 */
function formatHorarios(horarios) {
  if (!horarios) return 'Consultar horarios';
  
  try {
    const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    const horariosText = [];
    
    dias.forEach(dia => {
      if (horarios[dia] && horarios[dia].abierto) {
        horariosText.push(`${dia}: ${horarios[dia].apertura} - ${horarios[dia].cierre}`);
      }
    });
    
    return horariosText.length > 0 ? horariosText.join(', ') : 'Consultar horarios';
  } catch (error) {
    return 'Consultar horarios';
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
    
    if (date.includes('/')) {
      const parts = date.split('/');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2] || new Date().getFullYear();
      return `${year}-${month}-${day}`;
    }
    
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
    await backendAxios.get('/espejo');
    logInfo('✅ Conexión con backend OK via /espejo');
    return true;
  } catch (error) {
    logError('❌ Error de conexión con backend:', error.message);
    return false;
  }
}

module.exports = {
  getDashboardData,
  getEspejo,
  getMenu,
  getHorarios,
  consultarHorario,
  buscarMesa,
  makeReservation,
  modificarReserva,
  cancelReservation,
  checkDashboardConnection,
  formatDate
};