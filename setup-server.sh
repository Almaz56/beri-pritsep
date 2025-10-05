#!/bin/bash

# Server setup script for Ubuntu
# This script prepares the server for running the Trailer Go application

set -e

echo "🖥️  Setting up Ubuntu server for Trailer Go application..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install required packages
echo "🔧 Installing required packages..."
sudo apt install -y \
    curl \
    wget \
    git \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    nginx \
    certbot \
    python3-certbot-nginx

# Install Docker
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker $USER
    echo "✅ Docker installed successfully"
else
    echo "✅ Docker is already installed"
fi

# Install Docker Compose
echo "🐙 Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose installed successfully"
else
    echo "✅ Docker Compose is already installed"
fi

# Install Node.js (for development)
echo "📦 Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    echo "✅ Node.js installed successfully"
else
    echo "✅ Node.js is already installed"
fi

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /opt/trailer-go
sudo chown $USER:$USER /opt/trailer-go

# Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Configure Nginx
echo "🌐 Configuring Nginx..."
sudo systemctl enable nginx
sudo systemctl start nginx

# Create systemd service for the application
echo "⚙️  Creating systemd service..."
sudo tee /etc/systemd/system/trailer-go.service > /dev/null <<EOF
[Unit]
Description=Trailer Go Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/trailer-go
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable trailer-go.service

# Create log rotation configuration
echo "📝 Configuring log rotation..."
sudo tee /etc/logrotate.d/trailer-go > /dev/null <<EOF
/opt/trailer-go/server/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        docker-compose -f /opt/trailer-go/docker-compose.prod.yml restart server
    endscript
}

/opt/trailer-go/nginx/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        docker-compose -f /opt/trailer-go/docker-compose.prod.yml restart nginx
    endscript
}
EOF

# Create backup script
echo "💾 Creating backup script..."
sudo tee /opt/trailer-go/backup.sh > /dev/null <<EOF
#!/bin/bash
# Backup script for Trailer Go application

BACKUP_DIR="/opt/backups/trailer-go"
DATE=\$(date +%Y%m%d_%H%M%S)

mkdir -p \$BACKUP_DIR

# Backup uploads
tar -czf \$BACKUP_DIR/uploads_\$DATE.tar.gz -C /opt/trailer-go server/uploads

# Backup logs
tar -czf \$BACKUP_DIR/logs_\$DATE.tar.gz -C /opt/trailer-go server/logs nginx/logs

# Keep only last 7 days of backups
find \$BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: \$DATE"
EOF

sudo chmod +x /opt/trailer-go/backup.sh

# Add backup to crontab
echo "⏰ Adding backup to crontab..."
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/trailer-go/backup.sh") | crontab -

echo "🎉 Server setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "  1. Reboot the server: sudo reboot"
echo "  2. Clone your repository to /opt/trailer-go"
echo "  3. Configure environment variables in env.production"
echo "  4. Run the deployment script: ./deploy.sh"
echo ""
echo "🔧 Useful commands:"
echo "  - Check service status: sudo systemctl status trailer-go"
echo "  - View logs: docker-compose -f /opt/trailer-go/docker-compose.prod.yml logs -f"
echo "  - Restart application: sudo systemctl restart trailer-go"
echo "  - Backup data: /opt/trailer-go/backup.sh"
