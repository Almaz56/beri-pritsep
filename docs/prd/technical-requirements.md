# Technical Requirements (in-memory MVP)

## Общая архитектура MVP

### Технологический стек для быстрого запуска:
- **Frontend:** React 18+ + Vite + TypeScript + Telegram WebApp API
- **Backend:** Node.js + Express + TypeScript
- **Данные:** In-memory storage + backup файлы (JSON/файловая система)
- **Payment Gateway:** Tinkoff Payment API
- **Authentication:** Telegram WebApp initData + JWT + in-memory sessions
- **File Storage:** Локальная файловая система (uploads/)
- **Telegram Integration:** Telegram Bot API + WebApp API + ChatGPT integration

### Архитектурное решение in-memory

**Преимущества для MVP:**
- Мгновенная скорость всех операций (чтение из RAM)
- Простота разработки без настройки базы данных
- Быстрое развертывание и тестирование архитектуры
- Низкая стоимость инфраструктуры на старте
- Максимальная простота отладки и мониторинга

**Ограничения MVP:**
- Потеря всех данных при перезапуске сервера
- Ограничение количества пользователей размером RAM сервера
- Невозможность горизонтального масштабирования
- Сложность бэкапа и восстановления данных
- Потенциальные проблемы с синхронизацией между процессами

## Структура in-memory storage

### User Management
```typescript
// In-memory хранилище пользователей
interface InMemoryUserStorage {
  users: Map<string, UserProfile>;
  sessions: Map<string, UserSession>;
  verificationQueue: Array<DocumentVerification>;
}

interface UserProfile {
  telegramId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  phoneNumber?: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  documents: DocumentInfo[];
  createdAt: Date;
  lastActivity: Date;
}

interface UserSession {
  userId: string;
  jwtToken: string;
  telegramInitData: string;
  expiresAt: Date;
  isActive: boolean;
}
```

### Booking Management
```typescript
// In-memory бронирования
interface InMemoryBookingStorage {
  bookings: Map<string, Booking>;
  trailerAvailability: Map<string, TrailerSchedule>;
  paymentTransactions: Map<string, PaymentInfo>;
}

interface Booking {
  id: string;
  userId: string;
  trailerId: string;
  startTime: Date;
  endTime: Date;
  rentalType: 'HOURLY' | 'DAILY';
  totalAmount: number;
  depositAmount: number; // всегда 5000₽
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED';
  paymentId?: string;
  additionalServices: AdditionalService[];
}
```

### Trailer Catalog
```typescript
// Каталог прицепов в памяти
interface InMemoryTrailerStorage {
  trailers: Map<string, Trailer>;
  locations: Map<string, Location>;
  pricingRules: PricingConfiguration;
}

interface Trailer {
  id: string;
  name: string;
  description: string;
  locationId: string;
  photos: string[];
  hourlyRate: number; // 250₽ за час базово
  dailyRate: number; // 900₽ за день
  depositAmount: number; // фиксированно 5000₽
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE';
  features: string[];
  qrCode: string; // QR для сканирования
}
```

## Система backup и восстановления

### Автоматические backup процедуры
```typescript
// Backup система для критически重要的 данных
class InMemoryBackupSystem {
  // Сохранение всех данных каждые 5 минут
  async saveSnapshot(): Promise<void> {
    const snapshot = {
      users: Array.from(this.userStorage.users.entries()),
      bookings: Array.from(this.bookingStorage.bookings.entries()),
      trailers: Array.from(this.trailerStorage.trailers.entries()),
      sessions: Array.from(this.userStorage.sessions.entries()),
      timestamp: new Date().toISOString()
    };
    
    await this.fileSystem.writeJson('backup/latest.json', snapshot);
    await this.fileSystem.writeJson(`backup/snapshots/${Date.now()}.json`, snapshot);
  }
  
  // Восстановление из последнего backup
  async restoreFromSnapshot(): Promise<void> {
    try {
      const snapshot = await this.fileSystem.readJson('backup/latest.json');
      
      // Восстановление пользователей
      this.userStorage.users = new Map(snapshot.users);
      this.bookingStorage.bookings = new Map(snapshot.bookings);
      this.trailerStorage.trailers = new Map(snapshot.trailers);
      this.userStorage.sessions = new Map(snapshot.sessions);
      
      console.log(`✅ In-memory storage восстановлен из ${snapshot.timestamp}`);
    } catch (error) {
      console.error('❌ Ошибка восстановления данных:', error);
      // Инициализация пустых структур
      this.initializeEmptyStructures();
    }
  }
}
```

### Disaster Recovery процедуры
```typescript
// Процедуры восстановления после сбоев
interface DisasterRecoveryPlan {
  // 1. Автоматическое восстановление при запуске
  onServerStart(): Promise<void>;
  
  // 2. Мониторинг критических операций
  monitoringCheck(): Promise<'HEALTHY' | 'WARNING' | 'CRITICAL'>;
  
  // 3. Экстренное восстановление данных
  emergencyRestore(): Promise<boolean>;
  
  // 4. Уведомления о критических проблемах
  sendCriticalAlert(message: string): Promise<void>;
}
```

## Telegram WebApp Specific разработка

### Интеграция с Telegram Mini App API
```typescript
// Telegram WebApp интеграция
class TelegramMiniAppIntegration {
  initialize(): TelegramWebAppIntegration {
    // Инициализация Telegram WebApp API
    const webApp = window.Telegram?.WebApp;
    
    if (!webApp) {
      throw new Error('Telegram WebApp API недоступен');
    }
    
    // Базовая настройка интерфейса
    webApp.ready();
    webApp.expand();
    webApp.setHeaderColor('#3390ec'); // Стандартный Telegram синий
    
    return {
      initData: webApp.initData,
      user: webApp.initDataUnsafe?.user,
      theme: webApp.themeParams,
      colorScheme: webApp.colorScheme,
      
      // Кнопки управления
      showMainButton: (text: string, onClick: () => void) => {
        webApp.MainButton.text = text;
        webApp.MainButton.show();
        webApp.MainButton.onClick(onClick);
      },
      
      hideMainButton: () => webApp.MainButton.hide(),
      
      // Взаимодействие с ботом
      requestContact: () => webApp.requestContact(),
      
      // Закрытие приложения
      close: () => webApp.close()
    };
  }
}
```

### QR Code функциональность
```typescript
// QR код система для навигации
interface QRCodeSystem {
  // Генерация QR для локаций
  generateLocationQR(locationId: string): string {
    const baseUrl = process.env.TRAILER_GO_WEBAPP_URL;
    return `${baseUrl}/location/${locationId}`;
  }
  
  // Генерация QR для прицепов
  generateTrailerQR(trailerId: string): string {
    const baseUrl = process.env.TRAILER_GO_WEBAPP_URL;
    return `${baseUrl}/trailer/${trailerId}`;
  }
  
  // Обработка QR сканирования в Telegram
  handleQRScan(qrData: string): Promise<'location' | 'trailer' | 'unknown'> {
    if (qrData.includes('/location/')) {
      const locationId = qrData.split('/location/')[1];
      return this.navigateToLocation(locationId);
    }
    
    if (qrData.includes('/trailer/')) {
      const trailerId = qrData.split('/trailer/')[1];
      return this.navigateToTrailer(trailerId);
    }
    
    return 'unknown';
  }
}
```

## Интеграция с Tinkoff Payment API

### HOLD операции для залогов
```typescript
// Tinkoff интеграция для платежей
class TinkoffPaymentIntegration {
  async createRentalPayment(booking: Booking): Promise<PaymentResult> {
    // Первый платеж: списание стоимости аренды
    const rentalPayment = await this.tinkoffClient.createPayment({
      amount: booking.totalAmount,
      orderId: `rental_${booking.id}`,
      description: `Аренда прицепа ${booking.startTime.toDateString()}`,
      returnUrl: `${process.env.APP_URL}/payment/success`
    });
    
    return rentalPayment;
  }
  
  async createHoldDeposit(booking: Booking): Promise<HoldResult> {
    // Второй платеж: HOLD залога на 5000₽
    const holdOperation = await this.tinkoffClient.createHold({
      amount: 5000, // фиксированный залог
      orderId: `deposit_${booking.id}`,
      description: `Залог за прицеп №${booking.trailerId}`,
      holdPeriod: 30 // дней максимальный период HOLD
    });
    
    return holdOperation;
  }
  
  async releaseHoldDeposit(bookingId: string): Promise<void> {
    // Автоматический возврат залога после аренды
    await this.tinkoffClient.releaseHold(`deposit_${bookingId}`);
  }
}
```

## Фотофиксация система технические требования

### Загрузка и хранение фотографий
```typescript
// Система фотофиксации состояния
interface PhotoCaptureSystem {
  // До аренды: 4 обязательные фотографии
  requiredPhotoAngles: [
    'FRONT', // Передняя часть
    'BACK',  // Задняя часть  
    'LEFT',  // Левая сторона
    'RIGHT'  // Правая сторона
  ];
  
  // После аренды: те же ракурсы для сравнения
  comparePhotos(basePhotos: Photo[], newPhotos: Photo[]): PhotoComparison;
  
  // Сохранение в файловую систему
  async savePhotos(photos: File[]): Promise<string[]> {
    const savedPaths: string[] = [];
    
    for (const photo of photos) {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${photo.name}`;
      const filePath = `uploads/trailer_photos/${fileName}`;
      
      await this.fileSystem.saveFile(filePath, photo);
      savedPaths.push(filePath);
    }
    
    return savedPaths;
  }
}
```

## Система безопасности и валидации

### Валидация входных данных
```typescript
// Система валидации для in-memory проверок
class DataValidationSystem {
  validateTelegramData(initData: string): boolean {
    // Проверка HMAC подписи Telegram initData
    const crypto = require('crypto');
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    // Создание строки для проверки подписи
    const dataCheckString = this.createDataCheckString(urlParams);
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
                          .update(process.env.TELEGRAM_BOT_TOKEN)
                          .digest();
    
    const calculatedHash = crypto.createHmac('sha256', secretKey)
                                .update(dataCheckString)
                                .digest('hex');
    
    return hash === calculatedHash;
  }
  
  validatePhoneNumber(phone: string): boolean {
    // Российские номера телефонов
    const phoneRegex = /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;
    return phoneRegex.test(phone);
  }
}
```

## Конфигурация деплоя (MVP без Docker)

### Производственная конфигурация
```typescript
// Настройки для production развертывания
const productionConfig = {
  // Сервер
  PORT: 8080,
  NODE_ENV: 'production',
  
  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_WEBAPP_URL: 'https://trailergo.ru/webapp',
  
  // Tinkoff Payment
  TINKOFF_TERMINAL_KEY: process.env.TINKOFF_TERMINAL_KEY,
  TINKOFF_SECRET_KEY: process.env.TINKOFF_SECRET_KEY,
  TINKOFF_PASSWORD: process.env.TINKOFF_PASSWORD,
  
  // In-memory ограничения
  MAX_USERS: 1000,
  MAX_BOOKINGS: 5000,
  MEMORY_LIMIT_MB: 512,
  
  // Backup частота
  BACKUP_INTERVAL_MINUTES: 5,
  SNAPSHOT_RETENTION_DAYS: 30,
  
  // HTTPS (обязательно для Telegram WebApp)
  SSL_CERT_PATH: '/etc/ssl/certs/trailergo.pem',
  SSL_KEY_PATH: '/etc/ssl/private/trailergo.key',
  
  // File storage
  UPLOAD_DIR: '/var/uploads',
  MAX_FILE_SIZE: 10485760, // 10MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp']
};
```

### Мониторинг и логирование (in-memory)
```typescript
// Мониторинг производительности памяти
interface MemoryMonitoring {
  // Отслеживание использования памяти
  monitorMemoryUsage(): MemoryStats {
    const memUsage = process.memoryUsage();
    
    return {
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      
      // Критические лимиты
      isMemoryCritical: memUsage.rss > 500 * 1024 * 1024, // 500MB
      estimatedUsers: this.userStorage.users.size,
      estimatedBookings: this.bookingStorage.bookings.size
    };
  }
  
  // Автоматическая очистка старых данных
  cleanupExpiredSessions(): void {
    const expiredSessions = Array.from(this.userStorage.sessions.entries())
      .filter(([_, session]) => session.expiresAt < new Date());
    
    expiredSessions.forEach(([sessionId]) => {
      this.userStorage.sessions.delete(sessionId);
    });
    
    console.log(`🧹 Очищено ${expiredSessions.length} истекших сессий`);
  }
}
```

## Миграционная стратегия к PostgreSQL

### Подготовка к миграции (6 месяцев)
```typescript
// Миграционная готовность код
interface MigrationReadiness {
  // Экспорт всех данных в формат миграции
  exportForMigration(): MigrationData {
    return {
      users: Array.from(this.userStorage.users.entries()),
      bookings: Array.from(this.bookingStorage.bookings.entries()),
      trailers: Array.from(this.trailerStorage.trailers.entries()),
      transactions: Array.from(this.paymentStorage.transactions.entries()),
      metadata: {
        exportDate: new Date(),
        version: 'v1.0.0',
        userCount: this.userStorage.users.size
      }
    };
  }
  
  // Валидация целостности данных перед миграцией
  validateDataIntegrity(): ValidationResult {
    // Проверки на консистентность данных
    const issues: string[] = [];
    
    // Проверка связности пользователей и бронирований
    for (const booking of this.bookingStorage.bookings.values()) {
      if (!this.userStorage.users.has(booking.userId)) {
        issues.push(`Бронирование ${booking.id} ссылается на несуществующего пользователя ${booking.userId}`);
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues: issues
    };
  }
}
```

## Общие требования к безопасности

### Безопасность данных в памяти
- **Шифрование чувствительных данных:** JWT токены, номера телефонов
- **Защита от переполнения памяти:** мониторинг ограничений RAM
- **Изоляция процессов:** предотвращение утечек между сессиями пользователей
- **Регулярные патчи зависимостей:** обновление Express, Node.js библиотек

### HTTPS обязательность
- **Обязательные SSL сертификаты** для всех production доменов
- **HSTS headers** для принуждения всех трафика через HTTPS
- **Certificate transparency** мониторинг для валидации легитимности сертификатов
- **Автоматическое обновление сертификатов** через Let's Encrypt

Эти технические требования обеспечивают быстрый запуск MVP на in-memory архитектуре с возможностью плавного перехода к полноценной базе данных в будущих версиях продукта.