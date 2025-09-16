#!/bin/bash

# Script de despliegue automático para Asisteme Voice
# Autor: Fluxo Team
# Uso: ./deploy.sh [environment]

set -e  # Salir si cualquier comando falla

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
ENVIRONMENT=${1:-production}
PROJECT_NAME="asisteme-voice"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

echo -e "${BLUE}🚀 Iniciando despliegue de Asisteme Voice${NC}"
echo -e "${BLUE}Entorno: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Timestamp: ${TIMESTAMP}${NC}"
echo ""

# Función para logging
log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARNING: $1${NC}"
}

# Verificar prerrequisitos
check_prerequisites() {
    log "🔍 Verificando prerrequisitos..."
    
    # Verificar Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js no está instalado"
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        error "Node.js versión 18+ requerida. Versión actual: $(node --version)"
    fi
    
    # Verificar npm
    if ! command -v npm &> /dev/null; then
        error "npm no está instalado"
    fi
    
    # Verificar git
    if ! command -v git &> /dev/null; then
        error "git no está instalado"
    fi
    
    log "✅ Prerrequisitos verificados"
}

# Verificar variables de entorno
check_environment() {
    log "🔧 Verificando variables de entorno..."
    
    if [ ! -f ".env" ]; then
        error "Archivo .env no encontrado. Copia .env.example y configúralo."
    fi
    
    # Variables requeridas
    REQUIRED_VARS=(
        "OPENAI_API_KEY"
        "DASHBOARD_BASE_URL"
        "PORT"
    )
    
    source .env
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            error "Variable de entorno requerida no configurada: $var"
        fi
    done
    
    # Verificar que la API key de OpenAI tenga formato correcto
    if [[ ! $OPENAI_API_KEY =~ ^sk-[a-zA-Z0-9]{48,}$ ]]; then
        warning "La API key de OpenAI no parece tener el formato correcto"
    fi
    
    log "✅ Variables de entorno verificadas"
}

# Instalar dependencias
install_dependencies() {
    log "📦 Instalando dependencias..."
    
    # Limpiar cache si es necesario
    if [ "$ENVIRONMENT" = "production" ]; then
        npm ci --only=production
    else
        npm install
    fi
    
    log "✅ Dependencias instaladas"
}

# Crear directorios necesarios
create_directories() {
    log "📁 Creando directorios necesarios..."
    
    mkdir -p uploads
    mkdir -p logs
    mkdir -p config
    
    # Configurar permisos
    chmod 755 uploads
    chmod 755 logs
    
    log "✅ Directorios creados"
}

# Ejecutar tests
run_tests() {
    if [ "$ENVIRONMENT" != "production" ]; then
        log "🧪 Ejecutando tests..."
        
        # Verificar que el test script existe
        if [ -f "test/test-voice.js" ]; then
            # Ejecutar test de salud básico
            timeout 30 node test/test-voice.js health || warning "Tests básicos fallaron"
        else
            warning "Script de tests no encontrado"
        fi
        
        log "✅ Tests completados"
    fi
}

# Configurar PM2 para producción
setup_pm2() {
    if [ "$ENVIRONMENT" = "production" ]; then
        log "⚙️ Configurando PM2..."
        
        # Verificar si PM2 está instalado
        if ! command -v pm2 &> /dev/null; then
            log "Instalando PM2..."
            npm install -g pm2
        fi
        
        # Crear archivo de configuración PM2
        cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '${PROJECT_NAME}',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: ${PORT:-3001}
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF
        
        log "✅ PM2 configurado"
    fi
}

# Backup de configuración anterior
backup_config() {
    if [ "$ENVIRONMENT" = "production" ]; then
        log "💾 Creando backup de configuración..."
        
        BACKUP_DIR="backups/${TIMESTAMP}"
        mkdir -p "$BACKUP_DIR"
        
        # Backup de archivos importantes
        if [ -f ".env" ]; then
            cp .env "$BACKUP_DIR/.env.backup"
        fi
        
        if [ -f "ecosystem.config.js" ]; then
            cp ecosystem.config.js "$BACKUP_DIR/ecosystem.config.js.backup"
        fi
        
        log "✅ Backup creado en $BACKUP_DIR"
    fi
}

# Desplegar aplicación
deploy_app() {
    log "🚀 Desplegando aplicación..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        # Detener PM2 si está corriendo
        pm2 stop $PROJECT_NAME 2>/dev/null || true
        pm2 delete $PROJECT_NAME 2>/dev/null || true
        
        # Iniciar con PM2
        pm2 start ecosystem.config.js
        pm2 save
        
        # Configurar PM2 para iniciar en boot
        pm2 startup || warning "No se pudo configurar PM2 para inicio automático"
        
    else
        # Desarrollo - solo mostrar comandos
        log "Para desarrollo, ejecuta:"
        log "  npm run dev"
    fi
    
    log "✅ Aplicación desplegada"
}

# Verificar deployment
verify_deployment() {
    log "🔍 Verificando deployment..."
    
    sleep 5  # Esperar a que la app inicie
    
    # Verificar que el puerto esté abierto
    PORT=${PORT:-3001}
    if command -v curl &> /dev/null; then
        if curl -s "http://localhost:$PORT/health" > /dev/null; then
            log "✅ Servidor respondiendo correctamente en puerto $PORT"
        else
            error "Servidor no responde en puerto $PORT"
        fi
    else
        warning "curl no disponible, no se puede verificar el servidor"
    fi
    
    if [ "$ENVIRONMENT" = "production" ]; then
        # Verificar PM2
        pm2 status $PROJECT_NAME
    fi
    
    log "✅ Deployment verificado"
}

# Mostrar información post-deployment
show_info() {
    log "📋 Información del deployment:"
    echo ""
    echo -e "${BLUE}Proyecto:${NC} $PROJECT_NAME"
    echo -e "${BLUE}Entorno:${NC} $ENVIRONMENT"
    echo -e "${BLUE}Puerto:${NC} ${PORT:-3001}"
    echo -e "${BLUE}Timestamp:${NC} $TIMESTAMP"
    echo ""
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo -e "${BLUE}Comandos útiles:${NC}"
        echo "  pm2 status                    # Ver estado"
        echo "  pm2 logs $PROJECT_NAME        # Ver logs"
        echo "  pm2 restart $PROJECT_NAME     # Reiniciar"
        echo "  pm2 stop $PROJECT_NAME        # Detener"
    else
        echo -e "${BLUE}Para ejecutar en desarrollo:${NC}"
        echo "  npm run dev"
    fi
    
    echo ""
    echo -e "${BLUE}Endpoints disponibles:${NC}"
    echo "  GET  /health                  # Estado del servidor"
    echo "  POST /voice/webhook           # Webhook de llamadas"
    echo "  POST /voice/call              # Test con audio"
    echo ""
    
    echo -e "${BLUE}Próximos pasos:${NC}"
    echo "  1. Configurar número telefónico en Plivo/Voximplant"
    echo "  2. Actualizar webhook URL en el proveedor"
    echo "  3. Ejecutar tests: node test/test-voice.js"
    echo "  4. Monitorear logs: tail -f logs/asisteme-$(date +%Y-%m-%d).log"
}

# Función principal
main() {
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║         ASISTEME VOICE DEPLOY          ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""
    
    check_prerequisites
    check_environment
    create_directories
    install_dependencies
    run_tests
    backup_config
    setup_pm2
    deploy_app
    verify_deployment
    show_info
    
    echo ""
    echo -e "${GREEN}🎉 ¡Deployment completado exitosamente!${NC}"
    echo -e "${GREEN}🎙️ Asisteme Voice está listo para recibir llamadas${NC}"
}

# Manejo de interrupciones
trap 'echo -e "\n${RED}❌ Deployment interrumpido${NC}"; exit 1' INT TERM

# Ejecutar función principal
main "$@"