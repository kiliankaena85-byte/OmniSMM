# SPEC-2026-09-14: Архитектурный рефакторинг URL-валидатора и движка каталога услуг

## 1. Метаданные спецификации
- **Статус:** DRAFT (Ожидает согласования пользователя — Human Approval Gate FA-2026)
- **Версия:** 2.0.0
- **Класс риска:** Tier 1 (Критическая бизнес-логика: валидация ссылок, маршрутизация каталога, финансовая безопасность заказов)
- **Авторы:** Principal Fullstack Systems Analyst & Lead Architect
- **Контур:** OmniSMM 1.0 (SMMplan & SMMflux)

---

## 2. Проблема и цели рефакторинга

### 2.1. Контекст и выявленные архитектурные дефекты
1. **Контекстная слепота и ложный Telegram-хардкод (Context Blindness):**
   - В текущей реализации `IntelligenceLinkAnalyzer.analyze()` любой ввод, начинающийся с `@` или не содержащий точек и слэшей (`durov`, `my_shop`), безусловно трансформируется в `https://t.me/...`.
   - **Последствия:** Если пользователь находится на вкладке Instagram, TikTok или VK и указывает свой никнейм, система подменяет ссылку на Telegram, переключает соцсеть и отправляет заказ не тому шлюзу. Случайные слова (`test`, `beauty`) ошибочно определяются как Telegram-канал.
   - **Решение пользователя:** Принят **Вариант Б (Strict Domain Requirement)** — полный отказ от слепых догадок; требование явного указания домена соцсети.
2. **Асинхронный водопад при отборе категорий (Catalog Waterfall & Latency):**
   - `getPublicCatalogAction` возвращает только `serviceCount`, не предоставляя информацию о целевых типах (`targetTypes`) услуг внутри категории.
   - Клиент вынужден делать каскадный запрос `getServicesByCategoryAction` для каждой категории, чтобы понять, есть ли в ней подходящие тарифы, что создает лаг 200–400 мс.
3. **Хрупкость строковых эвристик (`inferTargetTypeFromName`):**
   - Распознавание типа услуги по названию строилось на цепочке неструктурированных проверок `name.includes(...)`, уязвимых к вариациям написания от поставщиков (`Авто - Просмотры`, транслит, эмодзи).

### 2.2. Цели рефакторинга
- 🛡️ **Zero-Ambiguity Validation:** Внедрить строгий парсер доменов (Вариант Б): ввод `@handle` или слов без домена отклоняется с понятной подсказкой.
- ⚡ **Zero-Waterfall Catalog:** Обогатить `PublicCategory` предрассчитанным массивом `targetTypes: TargetTypeEnum[]` на уровне SSR/кэша Redis для мгновенной фильтрации пустых категорий в памяти (0 ms).
- 🧩 **Deterministic Tokenizer:** Заменить разрозненные `includes` на строгий токенизатор названий услуг `ProviderServiceNameTokenizer`.

---

## 3. Архитектурные инварианты (Core Invariants)

### INV-1: Strict Domain Requirement (Вариант Б)
- Запрещено неявно подставлять протокол или домен `t.me` для ввода без доменной зоны.
- Валидная ссылка обязана содержать известный домен социальной сети (`t.me`, `telegram.me`, `vk.com`, `vkvideo.ru`, `youtube.com`, `youtu.be`, `instagram.com`, `tiktok.com`, `rutube.ru`, `dzen.ru` и др.).
- При вводе никнейма с `@` (например, `@durov`) анализатор возвращает типизированную ошибку:
  `{ success: false, error: 'INVALID_FORMAT_MISSING_DOMAIN', message: 'Укажите полную ссылку с адресом сайта (например: t.me/durov, vk.com/durov или instagram.com/durov)' }`.
- При вводе одиночных слов без точек (`durov`, `test`) ввод классифицируется как незавершенный.

### INV-2: Zero Dead-End Catalog Invariant
- Категория отображается пользователю на Шаге 2 **ТОЛЬКО** если пересечение её поддерживаемых типов с типом ссылки не пусто:
  $\text{category.targetTypes} \cap \text{compatibleTypes}(\text{detectedLinkType}) \neq \emptyset$.
- Фильтрация выполняется синхронно в UI на основе метаданных категории без сетевых задержек.

### INV-3: State Preservation on Step 4
- При редактировании ссылки на Шаге 4 (чекаут) выбранный тариф (`selectedService`) и категория сохраняются, если новый URL совместим с текущей услугой. Запрещен неконтролируемый сброс `selectedService = null`.

### INV-4: Token-Based TargetType Inference
- Распознавание типа услуги от поставщика опирается на очищенные токены (`tokens`), исключая влияние пробелов, дефисов и мусорных префиксов поставщиков (`[ID: ...]`, `Vexboost`).

---

## 4. Контракты данных и DTO (TypeScript Contracts)

### 4.1. Результат анализа URL (`IntelligenceAnalysisResult`)
```typescript
export type LinkAnalysisErrorCode =
  | 'EMPTY_INPUT'
  | 'MISSING_DOMAIN'
  | 'UNSUPPORTED_PLATFORM'
  | 'INVALID_OBJECT_FORMAT'
  | 'SSRF_BLOCKED'
  | 'RATE_LIMITED';

export interface IntelligenceAnalysisResult {
  success: boolean;
  platform: IntelligencePlatform;
  type: TargetTypeEnum;
  id: string;
  canonicalUrl: string;
  metadata: {
    isLive?: boolean;
    isAlbum?: boolean;
    isMediaGroupCandidate?: boolean;
    advice?: string;
  };
  suggestedCategories: string[];
  errorCode?: LinkAnalysisErrorCode;
  userHint?: string;
}
```

### 4.2. Обогащенная модель категории (`PublicCategory`)
```typescript
export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  networkId: string | null;
  serviceCount: number;
  targetTypes: TargetTypeEnum[]; // Предрассчитанные уникальные типы активных услуг в категории
  requireWarning?: boolean;
  warningMessage?: string | null;
  analyzerTags?: string | null;
}
```

---

## 5. План тестирования и верификации (TDD Verification)

1. **Red Phase (Падающие тесты):**
   - Тест `strict-domain-validator.test.ts`:
     - `@durov` $\to$ ошибка `MISSING_DOMAIN` с текстом подсказки (НЕ Telegram!).
     - `durov` $\to$ ошибка `MISSING_DOMAIN`.
     - `https://t.me/durov` $\to$ `success: true, platform: TELEGRAM, type: CHANNEL`.
     - `https://instagram.com/durov` $\to$ `success: true, platform: INSTAGRAM, type: PROFILE`.
     - `https://vk.com/durov` $\to$ `success: true, platform: VK, type: PROFILE`.
2. **Green Phase (Реализация):**
   - Рефакторинг `IntelligenceLinkAnalyzer`.
   - Обновление `getPublicCatalogAction` для включения `targetTypes`.
   - Обновление `useOrderEngine` и компонентов визарда.
3. **Регрессионная верификация:**
   - Полный прогон тестового сьюта: `npm run test`.
   - Проверка типов: `npx tsc --noEmit`.
   - Аудит секретов: `node scripts/check-bundle-secrets.mjs`.
