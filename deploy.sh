#!/bin/bash

# Deploy script for Trailer Go application
# Usage: ./deploy.sh [environment]
# Environment: dev, staging, prod (default: prod)

set -e

ENVIRONMENT=${1:-prod}
PROJECT_NAME="trailer-go"
DOMAIN="beripritsep.ru"

echo "🚀 Starting deployment for environment: $ENVIRONMENT"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p nginx/ssl
mkdir -p nginx/logs
mkdir -p server/uploads
mkdir -p server/logs

# Check if SSL certificates exist
if [ ! -f "nginx/ssl/app.beripritsep.ru.crt" ]; then
    echo "⚠️  SSL certificates not found. Creating self-signed certificates for development..."
    
    # Create self-signed certificates
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/app.beripritsep.ru.key \
        -out nginx/ssl/app.beripritsep.ru.crt \
        -subj "/C=RU/ST=Moscow/L=Moscow/O=TrailerGo/CN=app.beripritsep.ru"
    
    # Copy certificates for other domains
    cp nginx/ssl/app.beripritsep.ru.crt nginx/ssl/api.beripritsep.ru.crt
    cp nginx/ssl/app.beripritsep.ru.key nginx/ssl/api.beripritsep.ru.key
    cp nginx/ssl/app.beripritsep.ru.crt nginx/ssl/admin.beripritsep.ru.crt
    cp nginx/ssl/app.beripritsep.ru.key nginx/ssl/admin.beripritsep.ru.key
    
    echo "✅ Self-signed certificates created"
fi

# Check if environment file exists
if [ ! -f "env.production" ]; then
    echo "❌ Environment file 'env.production' not found. Please create it first."
    exit 1
fi

# Build and start services
echo "🔨 Building and starting services..."

if [ "$ENVIRONMENT" = "prod" ]; then
    docker-compose -f docker-compose.prod.yml --env-file env.production up -d --build
else
    docker-compose --env-file env.production up -d --build
fi

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
echo "🔍 Checking service status..."
docker-compose ps

# Test API health
echo "🏥 Testing API health..."
if curl -f http://localhost:8080/api/health > /dev/null 2>&1; then
    echo "✅ API is healthy"
else
    echo "❌ API health check failed"
    exit 1
fi

# Test web app
echo "🌐 Testing web app..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Web app is accessible"
else
    echo "❌ Web app is not accessible"
    exit 1
fi

# Test admin panel
echo "👨‍💼 Testing admin panel..."
if curl -f http://localhost:3001 > /dev/null 2>&1; then
    echo "✅ Admin panel is accessible"
else
    echo "❌ Admin panel is not accessible"
    exit 1
fi

echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Service URLs:"
echo "  - Web App: http://localhost:3000"
echo "  - Admin Panel: http://localhost:3001"
echo "  - API: http://localhost:8080"
echo ""
echo "🔧 Useful commands:"
echo "  - View logs: docker-compose logs -f"
echo "  - Stop services: docker-compose down"
echo "  - Restart services: docker-compose restart"
echo ""
echo "📝 Next steps:"
echo "  1. Configure your domain DNS to point to this server"
echo "  2. Replace self-signed certificates with real SSL certificates"
echo "  3. Update environment variables in env.production"
echo "  4. Test the Telegram Mini App integration"
