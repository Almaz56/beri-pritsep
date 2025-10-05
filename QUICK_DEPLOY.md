# 🚀 Быстрое развертывание Trailer Go

## 📋 Что нужно

1. **Ubuntu сервер** с root доступом
2. **Домен** (например, beripritsep.ru)
3. **Telegram Bot Token** от @BotFather

## ⚡ Быстрый старт

### 1. Подготовка сервера (5 минут)

```bash
# Скачайте и запустите скрипт настройки
wget https://raw.githubusercontent.com/your-repo/trailer-go/main/setup-server.sh
chmod +x setup-server.sh
sudo ./setup-server.sh
sudo reboot
```

### 2. Развертывание приложения (10 минут)

```bash
# Клонируйте проект
cd /opt/trailer-go
git clone https://github.com/your-repo/trailer-go.git .

# Настройте переменные окружения
cp env.production .env.production
nano .env.production
```

**Обязательно измените:**
```env
JWT_SECRET=your-super-secret-jwt-key
BOT_TOKEN=your-telegram-bot-token
TELEGRAM_BOT_USERNAME=your_bot_username
```

### 3. Запуск (2 минуты)

```bash
# Запустите приложение
./deploy.sh prod
```

### 4. Настройка домена (5 минут)

```bash
# Установите SSL сертификаты
sudo certbot --nginx -d app.beripritsep.ru -d api.beripritsep.ru -d admin.beripritsep.ru
```

## 🎯 Результат

После выполнения всех шагов у вас будет:

- ✅ **Web App**: https://app.beripritsep.ru
- ✅ **API**: https://api.beripritsep.ru  
- ✅ **Admin Panel**: https://admin.beripritsep.ru
- ✅ **Telegram Bot** готов к тестированию

## 📱 Тестирование Telegram Mini App

1. Найдите вашего бота в Telegram
2. Нажмите кнопку "Запустить приложение"
3. Протестируйте все функции

## 🔧 Полезные команды

```bash
# Просмотр логов
docker-compose -f /opt/trailer-go/docker-compose.prod.yml logs -f

# Перезапуск
sudo systemctl restart trailer-go

# Статус
sudo systemctl status trailer-go
```

---

**Готово!** 🎉 Приложение развернуто и готово к тестированию!
