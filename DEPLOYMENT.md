# 🚀 Развертывание Trailer Go на сервер

Это руководство поможет вам развернуть приложение "Бери прицеп" на Ubuntu сервер для тестирования Telegram Mini App.

## 📋 Требования

- Ubuntu 20.04+ сервер
- Root доступ или sudo права
- Домен (например, beripritsep.ru)
- Telegram Bot Token
- Tinkoff Payment API ключи (опционально)

## 🛠️ Быстрая установка

### 1. Подготовка сервера

```bash
# Скачайте и запустите скрипт настройки сервера
wget https://raw.githubusercontent.com/your-repo/trailer-go/main/setup-server.sh
chmod +x setup-server.sh
./setup-server.sh

# Перезагрузите сервер
sudo reboot
```

### 2. Клонирование проекта

```bash
# Перейдите в директорию приложения
cd /opt/trailer-go

# Клонируйте репозиторий
git clone https://github.com/your-repo/trailer-go.git .

# Сделайте скрипты исполняемыми
chmod +x deploy.sh
```

### 3. Настройка переменных окружения

```bash
# Скопируйте файл переменных окружения
cp env.production .env.production

# Отредактируйте переменные
nano .env.production
```

**Обязательные переменные:**
```env
# JWT Secret (сгенерируйте сильный ключ)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Telegram Bot
BOT_TOKEN=your-telegram-bot-token
TELEGRAM_BOT_USERNAME=your_bot_username

# Tinkoff Payment API (опционально)
TINKOFF_TERMINAL_KEY=your-tinkoff-terminal-key
TINKOFF_SECRET_KEY=your-tinkoff-secret-key
TINKOFF_SANDBOX=true
```

### 4. Развертывание

```bash
# Запустите развертывание
./deploy.sh prod
```

## 🌐 Настройка домена

### 1. DNS настройки

Настройте DNS записи для вашего домена:

```
A    app.beripritsep.ru    -> YOUR_SERVER_IP
A    api.beripritsep.ru    -> YOUR_SERVER_IP
A    admin.beripritsep.ru  -> YOUR_SERVER_IP
```

### 2. SSL сертификаты

```bash
# Установите реальные SSL сертификаты
sudo certbot --nginx -d app.beripritsep.ru -d api.beripritsep.ru -d admin.beripritsep.ru

# Обновите конфигурацию Nginx
sudo nginx -t
sudo systemctl reload nginx
```

## 📱 Настройка Telegram Mini App

### 1. Создание Telegram Bot

1. Найдите [@BotFather](https://t.me/BotFather) в Telegram
2. Создайте нового бота: `/newbot`
3. Получите Bot Token
4. Настройте Mini App: `/newapp`

### 2. Настройка Mini App

```
Bot Name: Beri Pritsep
Description: Аренда прицепов
Photo: [загрузите логотип]
Web App URL: https://app.beripritsep.ru
```

### 3. Настройка Webhook

```bash
# Установите webhook для бота
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://api.beripritsep.ru/api/telegram/webhook"}'
```

## 🔧 Управление приложением

### Основные команды

```bash
# Запуск приложения
sudo systemctl start trailer-go

# Остановка приложения
sudo systemctl stop trailer-go

# Перезапуск приложения
sudo systemctl restart trailer-go

# Статус приложения
sudo systemctl status trailer-go

# Просмотр логов
docker-compose -f /opt/trailer-go/docker-compose.prod.yml logs -f

# Обновление приложения
cd /opt/trailer-go
git pull
./deploy.sh prod
```

### Мониторинг

```bash
# Проверка здоровья API
curl https://api.beripritsep.ru/api/health

# Проверка статуса контейнеров
docker-compose -f /opt/trailer-go/docker-compose.prod.yml ps

# Использование ресурсов
docker stats
```

## 🗂️ Структура файлов

```
/opt/trailer-go/
├── docker-compose.prod.yml    # Docker Compose конфигурация
├── nginx/
│   ├── nginx.conf            # Nginx конфигурация
│   ├── ssl/                  # SSL сертификаты
│   └── logs/                 # Логи Nginx
├── server/
│   ├── uploads/              # Загруженные файлы
│   └── logs/                 # Логи сервера
├── deploy.sh                 # Скрипт развертывания
└── env.production            # Переменные окружения
```

## 🔒 Безопасность

### Рекомендации

1. **Измените JWT_SECRET** на сильный случайный ключ
2. **Используйте HTTPS** для всех доменов
3. **Настройте firewall** для ограничения доступа
4. **Регулярно обновляйте** систему и зависимости
5. **Настройте мониторинг** и алерты

### Firewall

```bash
# Разрешить только необходимые порты
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

## 🐛 Устранение неполадок

### Проблемы с запуском

```bash
# Проверьте логи
docker-compose -f /opt/trailer-go/docker-compose.prod.yml logs

# Перезапустите сервисы
docker-compose -f /opt/trailer-go/docker-compose.prod.yml restart

# Проверьте статус контейнеров
docker-compose -f /opt/trailer-go/docker-compose.prod.yml ps
```

### Проблемы с SSL

```bash
# Проверьте сертификаты
sudo certbot certificates

# Обновите сертификаты
sudo certbot renew

# Проверьте конфигурацию Nginx
sudo nginx -t
```

### Проблемы с Telegram

```bash
# Проверьте webhook
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"

# Удалите webhook
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"
```

## 📞 Поддержка

Если у вас возникли проблемы:

1. Проверьте логи приложения
2. Убедитесь, что все переменные окружения настроены
3. Проверьте доступность доменов
4. Убедитесь, что SSL сертификаты действительны

## 🔄 Обновление

```bash
# Обновление приложения
cd /opt/trailer-go
git pull
./deploy.sh prod

# Обновление системы
sudo apt update && sudo apt upgrade -y
```

---

**Готово!** 🎉 Ваше приложение "Бери прицеп" развернуто и готово к тестированию Telegram Mini App!
