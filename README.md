# Бери прицеп - Telegram Mini App для аренды прицепов

## Описание проекта

Бери прицеп - это Telegram Mini App для аренды прицепов с функциональностью:
- QR-код сканирование для доступа к каталогу прицепов
- Авторизация через Telegram WebApp API
- Верификация документов (паспорт/водительские права)
- Бронирование по часам/суткам с гибким ценообразованием
- Интеграция с Tinkoff Payment API
- Фотофиксация до/после аренды
- Личный кабинет пользователя
- Админ-панель для управления

## Архитектура

```
├── server/          # Backend API (Node.js + Express + TypeScript)
├── web/            # Frontend (React + Vite + TypeScript)
├── admin/          # Admin Panel (React + Vite)
├── docs/           # Документация проекта
└── deploy/         # Скрипты для деплоя на Ubuntu сервер
```

## Технологический стек

### Backend
- **Node.js** + **Express** + **TypeScript**
- **JWT** для аутентификации
- **In-memory storage** (MVP без БД)
- **Telegram WebApp API** интеграция
- **Tinkoff Payment API** (планируется)

### Frontend
- **React 18** + **TypeScript**
- **Vite** для сборки
- **React Router** для навигации
- **CSS Modules** для стилизации
- **Telegram WebApp API** интеграция

## Быстрый старт

### Предварительные требования

- Node.js 18+ 
- npm или yarn
- Telegram Bot Token (для продакшн)

### 1. Клонирование и установка зависимостей

```bash
# Клонируйте репозиторий
git clone <repository-url>
cd tma-app

# Установите зависимости для backend
cd server
npm install

# Установите зависимости для frontend
cd ../web
npm install
```

### 2. Настройка окружения

```bash
# Скопируйте файл с переменными окружения
cd ../server
cp env.sample .env

# Отредактируйте .env файл
nano .env
```

Минимальная конфигурация для разработки:

```env
# Telegram Bot Configuration
BOT_TOKEN=your_telegram_bot_token_here

# JWT Configuration  
JWT_SECRET=your_super_secret_jwt_key_here

# Development Settings
ALLOW_DEV_AUTH=true
NODE_ENV=development

# Server Configuration
PORT=8080
```

### 3. Запуск в режиме разработки

#### Запуск Backend сервера

```bash
cd server
npm run dev
```

Сервер будет доступен по адресу: `http://localhost:8080`

#### Запуск Frontend приложения

```bash
cd web
npm run dev
```

Приложение будет доступно по адресу: `http://localhost:5173`

### 4. Проверка работоспособности

1. **Health Check API:**
   ```bash
   curl http://localhost:8080/api/health
   ```

2. **Открытие в браузере:**
   - Frontend: `http://localhost:5173`
   - API документация: `http://localhost:8080/api/health`

## API Endpoints

### Аутентификация
- `POST /api/auth/telegram` - Авторизация через Telegram
- `POST /api/auth/dev` - Dev-режим авторизации
- `GET /api/profile` - Получение профиля пользователя

### Прицепы
- `GET /api/trailers` - Список прицепов
- `GET /api/trailers?location_id=loc_1` - Прицепы по локации
- `GET /api/trailers/:id` - Детали прицепа

### Бронирование
- `POST /api/quote` - Расчет стоимости
- `POST /api/bookings` - Создание бронирования
- `GET /api/bookings` - Список бронирований пользователя

### Система
- `GET /api/health` - Проверка состояния API

## Тестовые данные

При запуске сервера автоматически создаются тестовые данные:

### Локации
- **Парковка "Центральная"** (loc_1) - г. Москва, ул. Тверская, д. 1
- **Терминал "Северный"** (loc_2) - г. Москва, Ленинградское ш., д. 100

### Прицепы
1. **Прицеп-фургон 2т с тентом** (trailer_1)
   - Грузоподъемность: 2000 кг
   - Габариты: 4м × 2м × 2.2м
   - Тент: есть
   - Локация: Центральная

2. **Прицеп-платформа 1.5т без тента** (trailer_2)
   - Грузоподъемность: 1500 кг
   - Габариты: 3.5м × 1.8м × 0.4м
   - Тент: нет
   - Локация: Центральная

3. **Прицеп-фургон 3т с тентом** (trailer_3)
   - Грузоподъемность: 3000 кг
   - Габариты: 5м × 2.2м × 2.5м
   - Тент: есть
   - Локация: Северный

## Ценообразование

### Почасовая аренда
- Минимум: 2 часа за 500₽
- Дополнительный час: 100₽
- Залог: 5000₽

### Посуточная аренда
- Сутки: 900₽
- Залог: 5000₽

### Дополнительные услуги
- Забор прицепа: 500₽

## Режимы работы

### Development Mode
- `ALLOW_DEV_AUTH=true` - позволяет авторизацию без Telegram
- Mock данные для тестирования
- Подробное логирование

### Production Mode
- Строгая проверка Telegram initData
- HTTPS обязательно
- Минимальное логирование

## Структура проекта

```
server/
├── src/
│   ├── index.ts              # Главный файл сервера
│   ├── verifyInitData.ts     # Проверка Telegram initData
│   ├── pricing.ts            # Логика ценообразования
│   ├── data.ts               # In-memory хранилище данных
│   └── types/                # TypeScript типы
├── package.json
├── tsconfig.json
└── env.sample

web/
├── src/
│   ├── main.tsx              # Точка входа React приложения
│   ├── telegram.ts           # Telegram WebApp утилиты
│   ├── api.ts                # API клиент
│   ├── pages/
│   │   ├── LocationPage.tsx  # Страница локации с прицепами
│   │   ├── TrailerPage.tsx   # Страница прицепа
│   │   └── ProfilePage.tsx   # Профиль пользователя
│   └── styles/               # CSS стили
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Разработка

### Добавление новых API endpoints

1. Добавьте роут в `server/src/index.ts`
2. Создайте соответствующие типы в `server/src/types/`
3. Обновите API клиент в `web/src/api.ts`

### Добавление новых страниц

1. Создайте компонент в `web/src/pages/`
2. Добавьте роут в `web/src/App.tsx`
3. Создайте CSS файл для стилизации

### Тестирование

```bash
# Запуск тестов (когда будут добавлены)
cd server
npm test

cd ../web
npm test
```

## Развертывание

### Локальное развертывание

```bash
# Сборка production версий
cd server
npm run build
npm start

cd ../web
npm run build
# Разместите build/ в веб-сервере
```

### Docker (планируется)

```bash
# Сборка и запуск контейнеров
docker-compose up --build
```

## Troubleshooting

### Проблемы с авторизацией

1. Проверьте `BOT_TOKEN` в `.env`
2. Убедитесь что `ALLOW_DEV_AUTH=true` для разработки
3. Проверьте логи сервера

### Проблемы с CORS

1. Проверьте настройки CORS в `server/src/index.ts`
2. Убедитесь что frontend запущен на правильном порту

### Проблемы с Telegram WebApp

1. Откройте приложение через Telegram
2. Проверьте консоль браузера на ошибки
3. Используйте dev-режим для тестирования

## Контакты

- **Проект:** Бери прицеп MVP
- **Версия:** 1.0.0
- **Дата:** 2025-01-04
- **Домен:** app.beripritsep.ru

## Лицензия

MIT License
