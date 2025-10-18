#!/bin/bash

echo "🚀 Обновление админ панели на продакшн..."

# Остановить текущие контейнеры
echo "⏹️ Останавливаем контейнеры..."
docker compose -f docker-compose.yml down

# Обновить код
echo "📥 Обновляем код..."
git pull origin main

# Пересобрать и запустить
echo "🔨 Пересобираем и запускаем..."
docker compose -f docker-compose.yml up -d --build

# Проверить статус
echo "✅ Проверяем статус..."
sleep 10
docker compose -f docker-compose.yml ps

echo "🎉 Обновление завершено!"
echo "📊 Проверьте: https://admin.beripritsep.ru/"
