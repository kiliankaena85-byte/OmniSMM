# Архитектурный анализ и ТЗ: «Умный Dripfeed 2.0» для Smmplan

Этот документ содержит глубокий технический и UX-анализ интеграции модуля «Умный Dripfeed 2.0» в существующую экосистему Smmplan. Мы проанализировали исходный PHP/Telethon план клиента и адаптировали его под реальный технологический стек проекта **(Next.js 16, React 19, TypeScript, Prisma 5, BullMQ/Redis, HeroUI v3)**, соблюдая жесткие правила безопасности и эргономики контракта **AGENTS.md**.

---

## 1. Сопоставление технологического стека (Tech Stack Adaptation)

Исходный план был ориентирован на PHP-архитектуру (PHP-контроллеры, Cron-скрипты, PHP-сервисы). Ниже приведено соотнесение с реальной архитектурой Smmplan:

| Модуль / Задача в PHP-плане | Реализация в стеке Smmplan (Next.js 16 / TypeScript) | Обоснование и преимущества |
| :--- | :--- | :--- |
| **PHP Controller & Routing** (`orders.php`, `OrderController`) | **Server Actions (`src/actions/order/checkout.ts`)** + Zod-валидация | Исключает накладные расходы на HTTP-запросы, гарантирует строгую типизацию на стыке фронтенд/бэкенд. |
| **PHP Service** (`SmartDripService.php`) | **TypeScript Service (`src/services/dripfeed/smart-drip.service.ts`)** | Инкапсулирует бизнес-логику разбиения заказов на порции (чанковые задачи) с использованием Prisma. |
| **Provider Adapter** (`ProviderAdapter.php`) | **Service Routing Engine (`src/lib/providers/`)** | Использование существующей API-системы роутинга провайдеров (`ServiceRoute`) с поддержкой автоматического failover. |
| **PHP Cron скрипты** (`smart_scheduler.php`, `smart_worker.php`) | **Фоновые воркеры BullMQ (`src/workers/dripfeed.worker.ts`)** | Вместо шедулинга cron каждую минуту, BullMQ на базе Redis обеспечивает высокую скорость обработки, повторные попытки при сбоях (Retry Backoff) и параллельную обработку очередей без утечек памяти. |
| **Python Telethon** (`snapshot.py`) | **Python-микросервис / NodeJS GramJS** | Легковесный фоновый сканер каналов, запускаемый через BullMQ. Интегрирован через защищенный API/Redis, полностью изолирован от клиентского фронтенда. |

---

## 2. Проектирование схемы базы данных (Prisma 5 Mapping)

Вместо сырых SQL-миграций мы интегрируем сущности «Умного Dripfeed» непосредственно в `prisma/schema.prisma`. 

```prisma
enum SmartCampaignStatus {
  PLANNED
  RUNNING
  PAUSED
  COMPLETED
  ERROR
}

enum SmartTaskStatus {
  PLANNED
  SENT
  COMPLETED
  ERROR
}

model SmartCampaign {
  id             String              @id @default(cuid())
  userId         String
  user           User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  serviceId      String
  service        Service             @relation(fields: [serviceId], references: [id], onDelete: Restrict)
  status         SmartCampaignStatus @default(PLANNED)
  link           String
  totalQuantity  Int
  totalDays      Int
  isTestMode     Boolean             @default(false)
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt
  
  tasks          SmartTask[]
  snapshots      SmartSnapshot[]

  @@index([userId])
  @@index([serviceId])
}

model SmartTask {
  id         String          @id @default(cuid())
  campaignId String
  campaign   SmartCampaign   @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  quantity   Int
  runAt      DateTime
  status     SmartTaskStatus @default(PLANNED)
  error      String?
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt
  
  executions SmartExecution[]

  @@index([campaignId])
  @@index([runAt, status])
}

model SmartExecution {
  id               String    @id @default(cuid())
  taskId           String
  task             SmartTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  providerId       String?
  provider         Provider? @relation(fields: [providerId], references: [id], onDelete: SetNull)
  externalOrderId  String?   // ID заказа у внешнего провайдера (например, VexBoost)
  qtySent          Int
  qtyDelivered     Int       @default(0)
  status           String    @default("PENDING") // PENDING, IN_PROGRESS, COMPLETED, FAILED
  error            String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([taskId])
}

model ServiceSmartConfig {
  id                String   @id @default(cuid())
  serviceId         String   @unique
  service           Service  @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  isEnabled         Boolean  @default(false)
  isTestMode        Boolean  @default(false)
  minChunk          Int      @default(50)
  maxChunk          Int      @default(200)
  markup            Float    @default(0.15) // +15% наценка за умное растягивание
  providersPriority String[] @default([])   // Упорядоченный список предпочтительных провайдеров
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model SmartSnapshot {
  id         String        @id @default(cuid())
  campaignId String
  campaign   SmartCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  channelUrl String
  members    String[]      // Массив отпечатков/хешей Telegram ID подписчиков
  createdAt  DateTime      @default(now())
}

model SmartDetectedUser {
  id         String   @id @default(cuid())
  campaignId String
  telegramId String
  score      Int      @default(0)
  reasons    String[] // e.g. ["NO_PHOTO", "RECENT_JOIN", "NUMERIC_USERNAME"]
  createdAt  DateTime @default(now())
}
```

---

## 3. UX/UI Спецификация для Клиента (Premium Warm Theme)

Интерфейс должен строго соответствовать эргономической теплой теме Smmplan (Zinc/Ivory) для предотвращения усталости глаз и когнитивной перегрузки.

### А. Чек-ин в карточке заказа (Order Checkout)
В форму оформления заказа (`src/components/landing/CheckoutForm.tsx`) при выборе услуги с поддержкой `ServiceSmartConfig.isEnabled === true` встраивается интерактивный блок:

```
┌────────────────────────────────────────────────────────────────────────┐
│  [ ] Растянуть доставку во времени (Умный Dripfeed 2.0) [BETA]         │
│  └─ Искусственный интеллект автоматически распределит доставку случай-  │
│     ными порциями (от 50 до 200 единиц) по умному графику.             │
└────────────────────────────────────────────────────────────────────────┘
```

При включении чекбокса плавно (высота `transition-all duration-300`) раскрывается панель:
* **Слайдер выбора дней**: `[ 3 дня ]  [ 7 дней (Рекомендуется) ]  [ 14 дней ]` (touch target кнопок строго `>= 44px`).
* **Информационный блок**:
  * Расчетное количество траншей: `~12 случайных порций`.
  * Итоговая сумма с учетом наценки (+15%): `1,150.00 ₽` (вместо базовых `1,000.00 ₽`).
  * Полный расчет стоимости и наценки производится **исключительно на сервере** в Server Action для защиты от подмены цен.

### Б. Дашборд кампаний клиента (`/dashboard/smart-drip`)
Для визуализации процесса растягивания во времени для клиента создается современный лаконичный интерфейс:

```
+------------------------------------------------------------------------+
│ Кампания #cl89x1gift - Подписчики Telegram (Канал: @durov)              │
│ Статус: Выполняется [ RUNNING ]                       Прогресс: 45%     │
│ [=======================>..............................] 450 / 1000 шт  │
+------------------------------------------------------------------------+
│ Предстоящие порции:                                                     │
│ 🔘 Порция #5 - 120 шт  ───> Запланирована на сегодня, 18:45            │
│ 🔘 Порция #6 - 85 шт   ───> Запланирована на завтра, 09:12             │
+------------------------------------------------------------------------+
│ [ Кнопка: Поставить на паузу (44px) ]  [ Кнопка: Изменить линки ]       │
+------------------------------------------------------------------------+
```
* **Цветовая палитра**: Мягкие тона без кислотных цветов. Текст — графитовый slate, прогресс-бары — тональный HSL-цинковый акцент.
* **Скрытие детектора**: Клиент **НЕ** видит технические метрики детектора ботов. Для него это бесшовная, плавная естественная доставка.

---

## 4. Архитектурный премортем-анализ (Failure Simulation)

Согласно стандартам **AGENTS.md**, ниже приведена премортем-таблица рисков с конкретными защитными механизмами.

| Сценарий гипотетического сбоя | Вероятность (P) | Влияние (I) | Программный механизм защиты (Mitigation) |
| :--- | :---: | :---: | :--- |
| **Сбой API провайдера в момент отправки порции (chunk)** | Высокая (4/5) | Средняя (3/5) | **BullMQ Retry Backoff**: Задача не переходит в статус `ERROR` мгновенно. BullMQ выполняет 3 повторные попытки с интервалом в 15 минут. Если провайдер лежит более 45 минут, срабатывает автоматический API failover — порция перенаправляется на резервного провайдера из списка `providersPriority`. |
| **Гонка данных: повторный запуск шедулера** | Средняя (2/5) | Высокая (4/5) | **Строгая транзакционность Prisma**: Выборка и блокировка задач происходят атомарно: `UPDATE "SmartTask" SET status = 'SENT' WHERE id = $1 AND status = 'PLANNED'`. При совпадении транзакций повторный запуск вернет `count = 0` и не создаст дубликаты у провайдера. Дополнительно используется Redis Lock. |
| **Блокировка/бан Telethon-аккаунта детектора** | Высокая (4/5) | Низкая (1/5) | **Silent Isolation**: Все операции детектора вынесены в обособленный микросервис. При бане сессии Telegram система логирует ошибку в `AdminAuditLog` и ставит детектор на паузу, но **никак не мешает** работе Dripfeed-кампании. Для клиента доставка продолжается без сбоев. |

---

## 5. Пошаговый план внедрения (Phase Roadmap)

Для безопасного пошагового внедрения без поломки текущих заказов, мы декомпозировали проект на **9 атомарных спринтов (User Stories)**. Каждый шаг занимает до 2 часов и подлежит обязательной верификации тестами.

### 🏁 Спринт 0: Подготовка и создание PR-ветки
* **Задача**: Создание ветки `feature/smart-drip` и файла `/docs/project_map.md` с точной разметкой. Проверка готовности dev-окружения.

### 🏁 Спринт 1: Интеграция схемы БД и миграции Prisma
* **Задача**: Добавление новых моделей (`SmartCampaign`, `SmartTask`, `SmartExecution`, `ServiceSmartConfig`, `SmartSnapshot`, `SmartDetectedUser`) в `schema.prisma`.
* **Верификация**: Запуск `npx prisma migrate dev --create-only` с последующим накатом миграций и верификацией индексов.

### 🏁 Спринт 2: Ядро бизнес-логики (SmartDripService)
* **Задача**: Создание `src/services/dripfeed/smart-drip.service.ts` с методами `createCampaign` (математическое распределение объема на случайные порции) и `splitIntoTasks`.
* **Верификация**: Unit-тесты: создание кампании на 1000 шт на 7 дней должно генерировать ровно 7-10 порций объемом в рамках `[minChunk, maxChunk]` с датами `runAt`, распределенными по дням.

### 🏁 Спринт 3: Интеграция в Checkout Server Action
* **Задача**: Доработка Server Action `src/actions/order/checkout.ts` и Zod-валидаторов. Если у услуги включен умный режим, транзакция списывает баланс (с учетом +15% наценки), создает запись в `SmartCampaign` и планирует задачи, минуя прямую отправку провайдеру.
* **Верификация**: Баланс пользователя списывается корректно. Обычные заказы создаются по старому пути, новые с флагом — по новым моделям.

### 🏁 Спринт 4: BullMQ Очереди и Планировщик (Scheduler)
* **Задача**: Создание `dripfeed.worker.ts` in `src/workers/`. BullMQ с периодичностью в 1 минуту выбирает задачи `SmartTask` с наступившим временем `runAt` и отправляет их провайдеру.
* **Верификация**: Имитация наступления времени отправки чанка $\rightarrow$ автоматический запуск, создание заказа на внешнем API, логирование `externalOrderId`.

### 🏁 Спринт 5: Административный интерфейс и Kill-Switch
* **Задача**: Разработка страницы `/admin/smart` на HeroUI с таблицей активных кампаний, кнопкой "Глобальный стоп" (Kill-Switch через Redis-флаг `smart:disabled`) и конфигуратором услуг.
* **Верификация**: Включение Kill-Switch мгновенно останавливает отправку чанков шедулером.

### 🏁 Спринт 6: Премиальный клиентский UI (React 19)
* **Задача**: Добавление тумблера «Умный Dripfeed» в `CheckoutForm.tsx` и страницы отслеживания прогресса кампании в ЛК клиента.
* **Верификация**: Проверка адаптивности UI от 320px до 4K, отсутствие сдвигов макета, touch targets >= 44px.

### 🏁 Спринт 7: Тихий детектор качества Telegram-подписчиков
* **Задача**: Реализация легковесного фонового Telegram-парсер-скрипта на NodeJS/Python. Сравнение списков подписчиков до чанка и после чанка для расчета `smart_detected_users.score`.
* **Верификация**: Запуск парсинга тестового канала, корректная запись результатов в базу данных без влияния на скорость обработки заказов.

### 🏁 Спринт 8: Финальное приемочное тестирование (UAT)
* **Задача**: Тестирование полной цепочки: клиент оформляет умную кампанию $\rightarrow$ списываются средства с Ledger $\rightarrow$ задачи планируются $\rightarrow$ чанки отправляются $\rightarrow$ бот шлет уведомления $\rightarrow$ на дашборде отображается прогресс $\rightarrow$ налог УСН в дашборде владельца пересчитывается с учетом наценки.
* **Верификация**: 0 ошибок компиляции (`npx tsc --noEmit`), успешный билд `npm run build`, все тесты зеленые.

---

## 6. Открытые вопросы к Владельцу

> [!IMPORTANT]
> Для финализации архитектурного плана, пожалуйста, ответьте на 3 уточняющих вопроса:
> 1. **Детектор качества (Quiet Mode)**: Нужен ли парсинг Telethon на первом этапе? Если да, есть ли у вас готовый Telegram-аккаунт для тестов (session-файл), или мы можем использовать заглушку (Mock-анализатор), которая имитирует расчет скоринга на первом этапе?
> 2. **Приоритеты провайдеров**: Хотите ли вы настраивать мультивыбор провайдеров для каждой услуги вручную в админке, или система должна автоматически использовать существующий каскадный роутинг `ServiceRoute`, настроенный для этой услуги? (Рекомендуется использовать `ServiceRoute` для экономии времени разработки).
> 3. **Воркеры и Cron**: Smmplan использует BullMQ для фоновых задач. Мы планируем интегрировать планировщик Dripfeed именно в BullMQ-очереди. У вас на продакшене BullMQ воркеры запускаются отдельным PM2-процессом/Docker-контейнером? (Это важно для бесперебойной отправки порций).
