# Деплой Бери прицеп на Ubuntu сервер

Этот документ описывает процесс деплоя приложения "Бери прицеп" на Ubuntu сервер.

## Требования

- Ubuntu 20.04+ или Ubuntu 22.04+
- Root доступ или sudo права
- Домен: `app.beripritsep.ru` (frontend)
- Домен: `api.beripritsep.ru` (backend API)
- Домен: `admin.beripritsep.ru` (admin panel)

## Быстрая установка

### 1. Подготовка сервера

```bash
# Загрузите и запустите скрипт установки
wget https://raw.githubusercontent.com/your-repo/beripritsep/main/deploy/setup-server.sh
chmod +x setup-server.sh
sudo ./setup-server.sh
```

### 2. Клонирование репозитория

```bash
# Переключитесь на пользователя приложения
sudo su - beripritsep

# Клонируйте репозиторий
git clone https://github.com/your-repo/beripritsep.git /opt/beripritsep
cd /opt/beripritsep
```

### 3. Настройка окружения

```bash
# Скопируйте файл окружения
cp server/env.sample server/.env

# Отредактируйте настройки
nano server/.env
```

Обязательные настройки в `.env`:
```env
# Telegram Bot
BOT_TOKEN=your_telegram_bot_token

# JWT
JWT_SECRET=your_super_secret_jwt_key

# Tinkoff Payment API
TINKOFF_TERMINAL_KEY=your_tinkoff_terminal_key
TINKOFF_SECRET_KEY=your_tinkoff_secret_key
TINKOFF_SANDBOX=false

# URLs
FRONTEND_URL=https://app.beripritsep.ru
BACKEND_URL=https://api.beripritsep.ru

# Production settings
NODE_ENV=production
ALLOW_DEV_AUTH=false
```

### 4. Деплой

```bash
# Запустите деплой
./deploy.sh
```

### 5. Настройка SSL

```bash
# Установите SSL сертификаты
sudo certbot --nginx -d app.beripritsep.ru -d api.beripritsep.ru -d admin.beripritsep.ru
```

### 6. Запуск сервисов

```bash
# Запустите и включите автозапуск
sudo systemctl start beripritsep
sudo systemctl enable beripritsep

# Проверьте статус
sudo systemctl status beripritsep
```

## Docker деплой (альтернативный)

### 1. Установка Docker

```bash
# Установите Docker и Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker beripritsep
```

### 2. Запуск с Docker Compose

```bash
# Перейдите в директорию деплоя
cd /opt/beripritsep/deploy

# Запустите все сервисы
docker-compose up -d

# Проверьте статус
docker-compose ps
```

## Мониторинг и логи

### Просмотр логов

```bash
# Логи приложения
sudo journalctl -u beripritsep -f

# Логи Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Логи Docker (если используется)
docker-compose logs -f
```

### Мониторинг ресурсов

```bash
# Использование диска
df -h

# Использование памяти
free -h

# Процессы
htop
```

## Резервное копирование

Автоматическое резервное копирование настроено через cron:

```bash
# Ручной запуск резервного копирования
/opt/beripritsep/backup.sh

# Просмотр расписания
sudo crontab -u beripritsep -l
```

## Обновление приложения

### Обновление через Git

```bash
# Перейдите в директорию приложения
cd /opt/beripritsep

# Получите последние изменения
git pull origin main

# Запустите деплой
./deploy.sh
```

### Обновление через Docker

```bash
# Перейдите в директорию деплоя
cd /opt/beripritsep/deploy

# Обновите образы
docker-compose pull

# Перезапустите сервисы
docker-compose up -d
```

## Устранение неполадок

### Проблемы с сервисом

```bash
# Перезапуск сервиса
sudo systemctl restart beripritsep

# Проверка конфигурации
sudo nginx -t

# Перезагрузка Nginx
sudo systemctl reload nginx
```

### Проблемы с SSL

```bash
# Обновление сертификатов
sudo certbot renew

# Проверка сертификатов
sudo certbot certificates
```

### Проблемы с Docker

```bash
# Перезапуск всех контейнеров
docker-compose restart

# Просмотр логов
docker-compose logs

# Очистка неиспользуемых ресурсов
docker system prune -a
```

## Безопасность

### Firewall

```bash
# Проверка статуса
sudo ufw status

# Открытие портов (если нужно)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Обновления системы

```bash
# Обновление пакетов
sudo apt update && sudo apt upgrade -y

# Автоматические обновления безопасности
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

## Контакты

- **Проект:** Бери прицеп
- **Домен:** app.beripritsep.ru
- **Поддержка:** support@beripritsep.ru
