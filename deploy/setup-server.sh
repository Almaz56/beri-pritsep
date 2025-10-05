#!/bin/bash

# Setup script for Ubuntu server deployment
# Run as root or with sudo

set -e

echo "🚀 Setting up Бери прицеп server..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 18.x
echo "📦 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2 for process management
echo "📦 Installing PM2..."
npm install -g pm2

# Install Nginx
echo "📦 Installing Nginx..."
apt install -y nginx

# Install Certbot for SSL
echo "📦 Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# Create application user
echo "👤 Creating application user..."
useradd -m -s /bin/bash beripritsep || echo "User already exists"
usermod -aG sudo beripritsep

# Create application directory
echo "📁 Creating application directory..."
mkdir -p /opt/beripritsep
chown beripritsep:beripritsep /opt/beripritsep

# Create uploads directory
echo "📁 Creating uploads directory..."
mkdir -p /opt/beripritsep/uploads
chown beripritsep:beripritsep /opt/beripritsep/uploads

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p /var/log/beripritsep
chown beripritsep:beripritsep /var/log/beripritsep

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

# Create systemd service for the application
echo "⚙️ Creating systemd service..."
cat > /etc/systemd/system/beripritsep.service << EOF
[Unit]
Description=Бери прицеп API Server
After=network.target

[Service]
Type=simple
User=beripritsep
WorkingDirectory=/opt/beripritsep
ExecStart=/usr/bin/node server/dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=8080
Environment=HOST=0.0.0.0

[Install]
WantedBy=multi-user.target
EOF

# Create Nginx configuration
echo "⚙️ Creating Nginx configuration..."
cat > /etc/nginx/sites-available/beripritsep << EOF
# Frontend (app.beripritsep.ru)
server {
    listen 80;
    server_name app.beripritsep.ru;
    
    root /opt/beripritsep/web/dist;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    location /uploads/ {
        alias /opt/beripritsep/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Backend API (api.beripritsep.ru)
server {
    listen 80;
    server_name api.beripritsep.ru;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Increase client max body size for file uploads
    client_max_body_size 10M;
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/beripritsep /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Create deployment script
echo "📝 Creating deployment script..."
cat > /opt/beripritsep/deploy.sh << 'EOF'
#!/bin/bash

set -e

echo "🚀 Deploying Бери прицеп..."

# Pull latest code
git pull origin main

# Install dependencies
cd server
npm ci --production
npm run build

cd ../web
npm ci --production
npm run build

cd ../admin
npm ci --production
npm run build

# Restart services
sudo systemctl restart beripritsep
sudo systemctl reload nginx

echo "✅ Deployment completed!"
EOF

chmod +x /opt/beripritsep/deploy.sh
chown beripritsep:beripritsep /opt/beripritsep/deploy.sh

# Create backup script
echo "📝 Creating backup script..."
cat > /opt/beripritsep/backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/opt/backups/beripritsep"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup uploads
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C /opt/beripritsep uploads/

# Backup logs
tar -czf "$BACKUP_DIR/logs_$DATE.tar.gz" -C /var/log beripritsep/

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "✅ Backup completed: $DATE"
EOF

chmod +x /opt/beripritsep/backup.sh
chown beripritsep:beripritsep /opt/beripritsep/backup.sh

# Create logrotate configuration
echo "📝 Creating logrotate configuration..."
cat > /etc/logrotate.d/beripritsep << EOF
/var/log/beripritsep/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 beripritsep beripritsep
    postrotate
        systemctl reload beripritsep
    endscript
}
EOF

# Create cron job for backups
echo "⏰ Setting up cron job for backups..."
(crontab -u beripritsep -l 2>/dev/null; echo "0 2 * * * /opt/beripritsep/backup.sh") | crontab -u beripritsep -

echo "✅ Server setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Clone your repository to /opt/beripritsep"
echo "2. Copy .env file to /opt/beripritsep/server/.env"
echo "3. Run: cd /opt/beripritsep && ./deploy.sh"
echo "4. Configure SSL: certbot --nginx -d app.beripritsep.ru -d api.beripritsep.ru"
echo "5. Start services: systemctl start beripritsep && systemctl enable beripritsep"
echo ""
echo "🔧 Useful commands:"
echo "- Check status: systemctl status beripritsep"
echo "- View logs: journalctl -u beripritsep -f"
echo "- Restart: systemctl restart beripritsep"
echo "- Deploy: cd /opt/beripritsep && ./deploy.sh"
