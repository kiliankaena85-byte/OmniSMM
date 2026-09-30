# SPEC-2026-09-30-OMNIORGANIC-NATURAL-GROWTH

**Статус:** DRAFT  
**Дата:** 2026-09-30  
**Автор:** OmniSMM Architecture Team  
**Тип:** Tier 1 (деньги, заказы, новый продукт)

---

## 1. Проблема

### 1.1 Провал классической SMM-накрутки

Telegram Analytics, TGStat, Telemetr и встроенная аналитика Telegram **мгновенно детектируют** ботов по паттерну роста:

```
Бот-накрутка (красные флаги):
  День 1:  +10 000 подписчиков, -0 отписок  ← аномалия
  День 2:  +0,    -0                         ← нет органики
  День 60: +0,    -9 800 отписок             ← массовый drop (боты умерли)
```

Последствия для клиента:
- Канал помечается как «накрученный» в TGStat
- Рекламодатели отказываются от размещений
- Telegram может ограничить продвижение канала
- Репутационный ущерб необратим

### 1.2 Что нужно рынку

Клиенты хотят **не просто цифру** подписчиков — они хотят **выглядеть органически**:
- Плавный рост без скачков
- Естественный процент отписок (8-15%)
- Активность по времени суток (больше утром/вечером)
- Реакции на посты коррелируют с ростом аудитории

### 1.3 Риски для нод (пользователей DePIN)

Реальные люди выполняющие однотипные действия могут быть ограничены Telegram:

| Тип задания | Риск для аккаунта | Telegram знает кто? | Лимит |
|------------|------------------|---------------------|-------|
| VIEW_POST | ~0% | ❌ Счётчик анонимен | Нет |
| REACT_POST | ~1% | ✅ Да | 10-20/день |
| FOLLOW_CHANNEL | ~5% | ✅ Да | 3/день (наш лимит) |
| Комментарии | ~15% | ✅ Да | Не реализуем |

**Решение:** нода сама выбирает какие типы заданий принимает (Risk Opt-In).

---

## 2. Три продуктовые линейки

### 2.1 OmniViews — просмотры (SAFE)
- Telegram счётчик просмотров анонимен
- Нет лога «кто смотрел»
- Риск для аккаунта ноды: ~0%
- **Цена: 0.01 ₽/просмотр** (100 ₽ за 10 000)

### 2.2 OmniReact — реакции (STANDARD)
- Один тап — не паттерн
- Любой живой пользователь ставит реакции
- Риск для аккаунта ноды: ~1%
- **Цена: 0.50 ₽/реакция**

### 2.3 OmniOrganic — подписчики с natural churn (ORGANIC)
- Реальные ноды, управляемый churn 8-12%
- Подача по расписанию (органический паттерн)
- Риск для аккаунта ноды: ~5% (opt-in!)
- **Цена: 400 ₽/1000 net подписчиков**

> **Ключевое преимущество:** Мы единственные на рынке кто может управлять и FOLLOW и UNFOLLOW через одну систему нод. Это невозможно реализовать с классическими ботами.

---

## 3. Архитектура

### 3.1 Модели данных

```prisma
model OrganicGrowthCampaign {
  id                String   @id @default(cuid())
  tenantId          String
  orderId           String   @unique         // связь с Order
  channelUsername   String                   // @target_channel
  targetNetGain     Int                      // +500 подписчиков net
  durationDays      Int      @default(30)
  churnRateMin      Float    @default(0.08)  // 8% минимум
  churnRateMax      Float    @default(0.12)  // 12% максимум
  activeHourStart   Int      @default(7)     // 07:00 МСК
  activeHourEnd     Int      @default(23)    // 23:00 МСК
  weekendMultiplier Float    @default(0.6)   // 60% темпа в выходные
  status            String   @default("SCHEDULED") // SCHEDULED|ACTIVE|PAUSED|COMPLETED|CANCELLED
  startDate         DateTime
  endDate           DateTime
  followsDelivered  Int      @default(0)
  unfollowsDelivered Int     @default(0)
  netGainActual     Int      @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  dailyPlans        OrganicDailyPlan[]

  @@index([tenantId])
  @@index([status, startDate])
}

model OrganicDailyPlan {
  id           String   @id @default(cuid())
  campaignId   String
  planDate     DateTime
  targetFollows Int
  targetUnfollows Int
  actualFollows Int     @default(0)
  actualUnfollows Int   @default(0)
  completed    Boolean  @default(false)

  campaign     OrganicGrowthCampaign @relation(fields: [campaignId], references: [id])

  @@unique([campaignId, planDate])
  @@index([planDate, completed])
}
```

### 3.2 Natural Churn Engine

```typescript
// src/services/organic/natural-churn-engine.ts

interface OrganicGrowthConfig {
  targetNetGain:      number    // +500 net подписчиков
  durationDays:       number    // за 30 дней
  churnRateMin:       number    // 0.08
  churnRateMax:       number    // 0.12
  activeHourStart:    number    // 7
  activeHourEnd:      number    // 23
  weekendMultiplier:  number    // 0.6
}

interface DailyPlan {
  date:        Date
  follows:     number
  unfollows:   number
  netGain:     number
  hourlySchedule: HourlySlot[]
}

interface HourlySlot {
  hour:        number
  follows:     number
  unfollows:   number
}

/**
 * Генерирует 30-дневное расписание подписок/отписок.
 * Паттерн соответствует статистике реальных Telegram-каналов.
 */
function generateCampaignSchedule(config: OrganicGrowthConfig): DailyPlan[] {
  const plans: DailyPlan[] = []

  // Gross follows нужно больше чем net из-за churn
  // net = gross * (1 - churnRate)
  // gross = net / (1 - churnRate)
  const avgChurn = (config.churnRateMin + config.churnRateMax) / 2
  const totalGross = Math.ceil(config.targetNetGain / (1 - avgChurn))

  for (let day = 0; day < config.durationDays; day++) {
    const date = new Date(Date.now() + day * 86_400_000)
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // Мультипликатор дня
    const dayMultiplier = isWeekend ? config.weekendMultiplier : 1.0

    // Случайная вариация ±25% (реалистичность)
    const variance = 0.75 + Math.random() * 0.5

    // Случайный churn в диапазоне min-max
    const dailyChurn = config.churnRateMin +
      Math.random() * (config.churnRateMax - config.churnRateMin)

    const baseDailyGross = totalGross / config.durationDays
    const follows = Math.max(1, Math.round(baseDailyGross * dayMultiplier * variance))
    const unfollows = Math.round(follows * dailyChurn)
    const netGain = follows - unfollows

    plans.push({
      date,
      follows,
      unfollows,
      netGain,
      hourlySchedule: distributeByHour(follows, unfollows, config.activeHourStart, config.activeHourEnd),
    })
  }

  return plans
}

/**
 * Распределяет подписки по часам активности.
 * Пик: утро 09-11, вечер 19-22 (паттерн российской аудитории).
 */
function distributeByHour(
  follows: number,
  unfollows: number,
  hourStart: number,
  hourEnd: number
): HourlySlot[] {
  // Весовая функция активности по часам (Российская аудитория, МСК)
  const HOURLY_WEIGHTS: Record<number, number> = {
    7: 0.5, 8: 0.8, 9: 1.2, 10: 1.3, 11: 1.1,
    12: 0.9, 13: 0.8, 14: 0.7, 15: 0.7, 16: 0.8,
    17: 1.0, 18: 1.1, 19: 1.3, 20: 1.4, 21: 1.3,
    22: 1.0, 23: 0.6,
  }

  const activeHours = Object.keys(HOURLY_WEIGHTS)
    .map(Number)
    .filter(h => h >= hourStart && h <= hourEnd)

  const totalWeight = activeHours.reduce((sum, h) => sum + (HOURLY_WEIGHTS[h] ?? 1), 0)

  return activeHours.map(hour => {
    const weight = (HOURLY_WEIGHTS[hour] ?? 1) / totalWeight
    return {
      hour,
      follows: Math.round(follows * weight),
      unfollows: Math.round(unfollows * weight),
    }
  })
}
```

### 3.3 Campaign Executor (BullMQ)

```typescript
// Каждый час BullMQ запускает:
async function executeHourlySlot(campaignId: string, hour: number) {
  const plan = await getTodayPlanForCampaign(campaignId)
  const slot = plan.hourlySchedule.find(s => s.hour === hour)
  if (!slot) return

  // 1. Назначить N нод на FOLLOW задание
  for (let i = 0; i < slot.follows; i++) {
    await dispatcher.addTarget({
      type: 'FOLLOW_CHANNEL',
      channel: campaign.channelUsername,
      postId: 0,
      targetViews: 1,
      orderId: campaign.orderId,
      campaignId,
    })
  }

  // 2. Назначить M нод на UNFOLLOW задание
  // Берём ноды которые подписались >24 часа назад
  const nodesToUnfollow = await getEligibleUnfollowNodes(campaign.channelUsername, slot.unfollows)
  for (const nodeId of nodesToUnfollow) {
    await dispatcher.addTarget({
      type: 'UNFOLLOW_CHANNEL',
      channel: campaign.channelUsername,
      postId: 0,
      targetViews: 1,
      nodeId, // конкретной ноде
      orderId: campaign.orderId,
    })
  }
}
```

### 3.4 API эндпоинты

```
POST /api/organic/campaign/create
  Body: { channelUsername, targetNetGain, durationDays, tier }
  → OrganicGrowthCampaign

GET  /api/organic/campaign/{id}/status
  → { follows, unfollows, netGain, retentionRate, churnRate, chart[] }

POST /api/organic/campaign/{id}/pause
POST /api/organic/campaign/{id}/resume
POST /api/organic/campaign/{id}/cancel
  → { refundAmount }

GET  /api/organic/campaign/{id}/analytics
  → { dailyStats[], retentionCurve, peakHours, projectedCompletion }
```

---

## 4. Продуктовые тарифы

### Tier 1 — Basic (существующий продукт)
- Просто подписчики без churn
- Подача в течение 24-48 часов
- **Цена: 150 ₽ / 1000 подписчиков**

### Tier 2 — OmniOrganic (новый продукт)
- Natural churn 8-12%
- Равномерная подача по расписанию 7-30 дней
- Активность по московскому времени
- **Цена: 400 ₽ / 1000 net подписчиков**
- **Маржа: ~60%** (основная стоимость — кредиты нодам)

### Tier 3 — OmniOrganic Premium (новый продукт)
- Всё из Tier 2
- + Реакции на посты (коррелируют с ростом аудитории)
- + Просмотры постов от тех же нод-подписчиков
- + Retention Boost (медленная замена старых ботов на реальные ноды)
- **Цена: 800 ₽ / 1000 net подписчиков**
- **Маржа: ~55%**

### Retention Boost (отдельный продукт)
- Для каналов с мёртвой накрученной аудиторией
- Медленно заменяем ботов на реальных нодовых подписчиков
- -200 ботов / день + +150 реальных / день
- **Цена: 2000 ₽ / месяц** (фиксированная подписка)

---

## 5. Конкурентное преимущество

| Возможность | Обычные SMM-панели | OmniOrganic |
|------------|-------------------|-------------|
| Реальные аккаунты | ❌ Боты | ✅ Реальные ноды |
| Управляемый churn | ❌ Невозможно | ✅ Точный контроль |
| Органический паттерн | ❌ Нет | ✅ Алгоритм |
| Bot API верификация | ❌ Нет | ✅ Точная |
| Retention Boost | ❌ Нет | ✅ Уникально |
| Детектирование TGStat | ❌ Флагируется | ✅ Проходит |

---

## 6. Anti-Gaming защита

### 6.1 Минимальное время подписки перед unfollow
```typescript
const MIN_FOLLOW_DURATION_BEFORE_UNFOLLOW = 24 * 60 * 60 * 1000 // 24 часа
// Нода не может получить UNFOLLOW задание на канал
// если подписалась менее 24 часов назад
```

### 6.2 Разные ноды для follow и unfollow
```
FOLLOW задание → случайная свободная нода
UNFOLLOW задание → та же нода что подписывалась (по nodeId)
→ Нельзя использовать одну ноду для циклической подписки/отписки
```

### 6.3 Velocity throttling
```typescript
// Не более 500 подписок/час на один канал (Telegram лимит)
const MAX_FOLLOWS_PER_HOUR_PER_CHANNEL = 500
// Не более 100 отписок/час (выглядит органично)
const MAX_UNFOLLOWS_PER_HOUR_PER_CHANNEL = 100
```

### 6.4 Churn Rate Invariant (защита от мошенничества клиента)
```typescript
// Клиент не может заказать churnRate > 50% или < 3%
// Слишком высокий churn = накрутка+дроп схема
// Слишком низкий = неправдоподобно
const CHURN_RATE_MIN = 0.03 // 3%
const CHURN_RATE_MAX = 0.50 // 50%
```

---

## 7. UI для клиента (Admin/Client Dashboard)

### 7.1 Форма создания кампании
```
╔═══════════════════════════════════════╗
║  🌱 Создать OmniOrganic кампанию      ║
╠═══════════════════════════════════════╣
║  Канал:          @my_channel          ║
║  Целевой прирост: [500] подписчиков   ║
║  Срок:           [30] дней            ║
║  Тариф:          ○ Basic              ║
║                  ● OmniOrganic        ║
║                  ○ Premium            ║
║  Churn rate:     [10]%  (авто)        ║
║  Активные часы:  [7] - [23]           ║
╠═══════════════════════════════════════╣
║  Стоимость:  200 ₽                    ║
║  [Предпросмотр расписания] [Заказать] ║
╚═══════════════════════════════════════╝
```

### 7.2 График кампании (Preview)
```
Предпросмотр роста:
День:  1   5   10  15  20  25  30
Net:  +14 +72 +148 +222 +298 +390 +500
Churn: 9% 10% 9.5% 11% 10%  9%   10%

[Экспортировать расписание CSV]
```

### 7.3 Live Dashboard
```
╔════════════════════════════════════════════╗
║  🌱 OmniOrganic — @my_channel              ║
╠════════════════════════════════════════════╣
║  Прогресс: ████████░░░░░░░ 340/500  68%   ║
║  Осталось: 11 дней                         ║
╠════════════════════════════════════════════╣
║  Сегодня:                                  ║
║    ✅ Подписок:   +47                       ║
║    ↩️  Отписок:   -5                        ║
║    📈 Net:        +42                       ║
║    🎯 Retention:  91.3%                     ║
╠════════════════════════════════════════════╣
║  [⏸ Пауза] [⚙️ Настройки] [📊 Аналитика] ║
╚════════════════════════════════════════════╝
```

---

## 8. Acceptance Criteria

- [ ] `OrganicGrowthCampaign` и `OrganicDailyPlan` модели в Prisma schema
- [ ] `NaturalChurnEngine.generateCampaignSchedule()` — генерация расписания
- [ ] BullMQ hourly job: `organic-campaign-executor` (cron `0 * * * *`)
- [ ] `POST /api/organic/campaign/create` — создание кампании
- [ ] `GET /api/organic/campaign/{id}/status` — статус и аналитика
- [ ] `POST /api/organic/campaign/{id}/pause|resume|cancel` — управление
- [ ] UI: форма создания + preview графика + live dashboard
- [ ] Anti-gaming: velocity throttle, min follow duration, churn rate invariant
- [ ] TSC: 0 ошибок, Vitest: все тесты green
- [ ] Интеграция с существующим `DePinTaskDispatcher` (FOLLOW + UNFOLLOW типы)
- [ ] Ценообразование в БД: Tier 2 = 0.40 ₽/подписчик, Tier 3 = 0.80 ₽/подписчик

---

## 9. Зависимости

| Зависимость | Статус |
|-------------|--------|
| DePIN Phase 1 (TMA, SSE, BullMQ) | ✅ DONE |
| DePIN Phase 2 (FOLLOW_CHANNEL, Escrow, Watchdog) | 🔄 IN PROGRESS |
| `UNFOLLOW_CHANNEL` тип в dispatcher | ❌ TODO |
| Telegram Bot API getChatMember | ✅ PLANNED (Phase 2) |

---

## 10. Сроки

| Спринт | Задачи | Срок |
|--------|--------|------|
| Sprint 3 | DB schema + NaturalChurnEngine + BullMQ executor | 3 дня |
| Sprint 4 | API эндпоинты + Client UI + Preview график | 3 дня |
| Sprint 5 | Admin UI + Analytics dashboard + Тесты | 2 дня |
| Sprint 6 | QA + Security audit + Боевой деплой | 1 день |

**Итого: ~9 рабочих дней до production.**
