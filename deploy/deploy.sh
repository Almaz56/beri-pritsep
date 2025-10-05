#!/bin/bash

# Deployment script for Бери прицеп
# Run this script from the project root directory

set -e

echo "🚀 Deploying Бери прицеп to production..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "server" ] || [ ! -d "web" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if .env file exists
if [ ! -f "server/.env" ]; then
    echo "❌ Error: server/.env file not found"
    echo "Please create server/.env with production configuration"
    exit 1
fi

# Build server
echo "🔨 Building server..."
cd server
npm ci --production
npm run build
cd ..

# Build web frontend
echo "🔨 Building web frontend..."
cd web
npm ci --production
npm run build
cd ..

# Build admin panel
echo "🔨 Building admin panel..."
cd admin
npm ci --production
npm run build
cd ..

# Create production package
echo "📦 Creating production package..."
tar -czf beripritsep-production.tar.gz \
    server/dist \
    server/package.json \
    server/.env \
    web/dist \
    admin/dist \
    deploy/

echo "✅ Production package created: beripritsep-production.tar.gz"
echo ""
echo "📋 Next steps:"
echo "1. Upload beripritsep-production.tar.gz to your server"
echo "2. Extract: tar -xzf beripritsep-production.tar.gz -C /opt/beripritsep/"
echo "3. Run: cd /opt/beripritsep && ./deploy.sh"
echo ""
echo "🌐 URLs:"
echo "- Frontend: https://app.beripritsep.ru"
echo "- API: https://api.beripritsep.ru"
echo "- Admin: https://admin.beripritsep.ru"
