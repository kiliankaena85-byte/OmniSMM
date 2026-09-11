# SPEC-2026-09-11: Provider Catalog AI Importer & Taxonomy Skill

## 1. Метаданные спецификации
- **Дата создания:** 11 сентября 2026 г.
- **Статус:** APPROVED
- **Уровень риска:** Tier 1 / Tier 2 (Финансовые цены услуг, создание категорий и каталожных записей в БД)
- **Исполнительный стек:** Next.js 16 (App Router), Prisma 5, PostgreSQL, TypeScript 5.7+ (strict mode), OpenRouter / Antigravity LLM, Redis 7+.

---

## 2. Контекст и Бизнес-Требования
Платформа OmniSMM 1.0 (витрины SMMplan и SMMflux) взаимодействует со множеством внешних SMM-провайдеров через API. Поставщики услуг отдают хаотичные, неструктурированные данные:
- Категории с рекламным мусором и техническими пометками (Telegram Живые Авто-Просмотры [Для закрытых каналов] [Сервер 3]).
- Отсутствие единого стандарта названия услуг (смесь капслока, эмодзи, английских и русских терминов).
- Дублирование категорий и отсутствие структурированных атрибутов (гео, гарантия, скорость, приватность).

**Цель:** Разработать аналитический скилл (provider-catalog-importer) и программный AI-движок импорта, который:
1. Выполняет семантическую классификацию услуг через генеративный AI-пайплайн (OpenRouter / Antigravity).
2. Распределяет услуги по жесткой канонической таксономии (<= 6-9 категорий первого уровня на соцсеть).
3. Применяет **Human-in-the-Loop Gate**: если ИИ сомневается в категории или соцсети (confidence < 0.85 или неизвестная категория), он обязан запросить уточнение у оператора перед созданием/привязкой.
4. Выполняет многофакторную сортировку:
   - Социальные сети: по популярности в РФ и СНГ (Telegram > Instagram > ВКонтакте > YouTube > TikTok > др.).
   - Категории: по воронке конверсии (Подписчики (10) > Лайки (20) > Просмотры (30) > Реакции (40) > Комментарии (50) > Репосты (60) > Истории (70) > Бусты (80) > Стримы (90) > Авто (100) > Другое (999)).
   - Услуги: по сегменту качества (VIP / Рекомендуемые / С гарантией -> Стандарт -> Эконом), отсортированные по цене внутри сегмента.
5. Рассчитывает розничные цены по адаптивной лестнице платформы (pplyPricingLadder) с защитным полом маржи (SAFETY_FLOOR_MARKUP = 3.0x) и красивым округлением (pplyBeautifulRounding).

---

## 3. Архитектурный Контракт и Схемы DTO

### 3.1. Схема Входных Сырых Услуг Провайдера
`	ypescript
export interface RawProviderServiceInput {
  service: string | number; // externalId
  name: string;
  category?: string;
  rate: string | number;
  min: string | number;
  max: string | number;
  type?: string;
  desc?: string;
  dripfeed?: boolean;
  refill?: boolean;
  cancel?: boolean;
}
`

### 3.2. Схема AI-Анализа и Классификации (LLM Output)
`	ypescript
export const AiAnalyzedServiceSchema = z.object({
  externalId: z.string(),
  networkCode: z.string(),       // e.g.  TELEGRAM, INSTAGRAM, VK, YOUTUBE, TIKTOK
  networkName: z.string(),       // e.g. Telegram, Instagram, ВКонтакте
  canonicalCategoryCode: z.string(), // e.g. SUBSCRIBERS, LIKES, VIEWS, REACTIONS
  categoryName: z.string(),      // e.g. Подписчики, Лайки, Просмотры
  cleanName: z.string().min(3),  // Чистое клиентское название
  description: z.string().optional(), // Маркированное описание с бейджами
  targetType: z.string().default(POST),
  qualityTier: z.enum([VIP, PREMIUM, STANDARD, ECONOMY]).default(STANDARD),
  geo: z.string().default(WORLDWIDE),
  warrantyDays: z.number().int().min(0).default(0),
  speedText: z.string().default(Стандартная),
  isPrivateAware: z.boolean().default(false),
  confidence: z.number().min(0).max(1), // Уверенность модели в классификации
  needsHumanReview: z.boolean().default(false),
  reviewReason: z.string().optional()
});

export type AiAnalyzedService = z.infer<typeof AiAnalyzedServiceSchema>;
`

### 3.3. Каноническая Таксономия Социальных Сетей и Категорий

#### Соцсети (с приоритетом сортировки sortOrder):
1. TELEGRAM (sortOrder: 10, name: 'Telegram', slug: 'telegram')
2. INSTAGRAM (sortOrder: 20, name: 'Instagram', slug: 'instagram')
3. VK (sortOrder: 30, name: 'ВКонтакте', slug: 'vk')
4. YOUTUBE (sortOrder: 40, name: 'YouTube', slug: 'youtube')
5. TIKTOK (sortOrder: 50, name: 'TikTok', slug: 'tiktok')
6. TWITCH (sortOrder: 60, name: 'Twitch', slug: 'twitch')
7. DISCORD (sortOrder: 70, name: 'Discord', slug: 'discord')
8. TWITTER (sortOrder: 80, name: 'Twitter (X)', slug: 'twitter')
9. RUTUBE (sortOrder: 90, name: 'Rutube', slug: 'rutube')
10. DZEN (sortOrder: 100, name: 'Дзен', slug: 'dzen')
11. OTHER (sortOrder: 999, name: 'Другое', slug: 'other')

#### Канонические Категории первого уровня (с sortOrder):
1. SUBSCRIBERS (10, 'Подписчики')
2. LIKES (20, 'Лайки')
3. VIEWS (30, 'Просмотры')
4. REACTIONS (40, 'Реакции')
5. COMMENTS (50, 'Комментарии')
6. REPOSTS (60, 'Репосты')
7. STORIES (70, 'Истории')
8. BOOSTS (80, 'Бусты')
9. STREAMS (90, 'Стримы')
10. AUTO_SERVICES (100, 'Авто-услуги')
11. OTHER (999, 'Другое')

### 3.4. Санитарная Фильтрация Мусора и Отсечение Нерабочих Услуг (Quality Gatekeeper)
Каждая услуга от провайдера до передачи в LLM и до записи в БД проходит аудит качества:
- **Критерии отбраковки (REJECT):**
  1. *Стоп-слова нерабочих/тестовых услуг:* `[TEST]`, `TEST ONLY`, `DO NOT ORDER`, `DO NOT USE`, `NOT WORKING`, `DISABLED`, `DOWN`, `STOP`, `PAUSED`, `TEMPORARILY UNAVAILABLE`, `MAINTENANCE`, `НЕ ЗАКАЗЫВАТЬ`, `ТЕСТ`, `НЕ РАБОТАЕТ`, `ОТКЛЮЧЕНО`, `ПАУЗА`, `СТОП`, `ТЕХРАБОТЫ`, `DEAD`, `BROKEN`, `DEPRECATED`, `BUG`.
  2. *Технический брак параметров:* `rate <= 0`, `minQty <= 0`, `minQty > maxQty`, `maxQty === 0`, `minQty > 500000`.
  3. *Бессмысленные сироты без категории и соцсети:* категория отсутствует (`null`, `""`, `Без категории`, `No Category`, `Uncategorized`, `Default`, `Other`, `0`, `-`) И в названии не обнаружено ни одной валидной соцсети платформы.
  4. *Токсичные / запрещенные действия:* жалобы, снос каналов, бан конкурентов (`report`, `жалоба`, `снос`, `claim`, `порнография`, `насилие`).
- **Критерии направления на модерацию (NEEDS_REVIEW):**
  - Категория отсутствует у провайдера, но распознана соцсеть (требует подтверждения канонической категории оператором).
  - Аномальный разрыв цен (`Price Spike / Dump`).

---

## 4. Алгоритм Многофакторной Сортировки

Для того чтобы каталог на витрине и в админке имел идеальную UX-структуру, сортировка выполняется на трех уровнях:
1. Сортировка Социальных Сетей: По популярности (TG -> IG -> VK -> YT -> TT -> Twitch -> Discord -> Twitter -> Rutube -> Dzen -> Другое).
2. Сортировка Категорий: По воронке конверсии (Подписчики -> Лайки -> Просмотры -> Реакции -> Комментарии -> Репосты -> Истории -> Бусты -> Стримы -> Авто-услуги -> Другое).
3. Сортировка Услуг:
   - Сегмент качества: VIP/Гарантия -> Стандарт -> Эконом
   - Внутри сегмента: По возрастанию цены закупки/продажи.

Формула вычисления service.sortOrder:
RankScore = TierWeight * 1000000 + PriceRank
где:
- VIP / Рекомендуемые: TierWeight = 1
- С гарантией (warranty > 0): TierWeight = 2
- Стандартное качество: TierWeight = 3
- Эконом / Боты: TierWeight = 4
- PriceRank: нормализованный порядок по розничной цене за единицу.

---

## 5. Human-in-the-Loop Protocol (HITL)

Если при анализе услуги выполняется хотя бы одно из условий:
1. confidence < 0.85 (модель сомневается в выборе социальной сети или категории).
2. 
etworkCode === 'OTHER' или canonicalCategoryCode === 'OTHER'.
3. Социальная сеть или категория отсутствуют в канонической матрице.

Движок импорта обязан:
1. Приостановить пакетную запись в БД.
2. Сформировать структурированный запрос оператору:
   - Исходное название услуги провайдера.
   - Предложенный ИИ вариант и причина сомнения.
   - Опции: [1] Привязать к существующей канонической категории, [2] Создать новую категорию, [3] Пропустить услугу.
3. Сохранить выбор оператора в словарь сессии для автоматического применения к аналогичным услугам в текущем батче.

---

## 6. Ценообразование и Финансовые Инварианты
1. Себестоимость закупки пересчитывается в рубли:
   CostRub = Rate * UsdRate (при валюте USD) или Rate (при RUB).
2. Розничная цена рассчитывается через pplyPricingLadder(CostRub).
3. Контроль пола наценки:
   EffectiveMarkup = Math.max(RetailFromLadder / CostRub, SAFETY_FLOOR_MARKUP (3.0))
4. Применение pplyAntiNegativeMargin(CostRub, RawRetail, 5).
5. Банковское округление розничной цены: pplyBeautifulRounding.
