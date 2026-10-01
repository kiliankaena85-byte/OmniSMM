# SPEC-2026-09-30: Dynamic Provider Currency & Intelligent Pricing Engine (DPC-Engine)

> **Статус:** DRAFT $\to$ IMPLEMENTING  
> **Контекст:** OmniSMM 1.0 (SMMplan / SMMflux)  
> **Протокол:** SIL-2026 / AAA-2026 / TDD (Red-Green-Refactor)  
> **Связанные анти-паттерны:** `[ANTI-PATTERN-006] Cross-Currency Raw Rate Comparison & Unchecked Currency Shift`

---

## 1. Проблема и цели (Problem & Goals)

### 1.1. Текущая уязвимость (Root Cause)
1. **Десинхронизация валюты провайдера и услуги:**
   - Таблица `Provider` хранит `balanceCurrency` (например, `'RUB'`).
   - Таблица `Service` хранит `providerCurrency` (по умолчанию `'USD'`), `rate` (ставка поставщика) и `costPer1kRub` (себестоимость в рублях).
   - При добавлении услуг или смене настроек аккаунта провайдера происходило расхождение: ставка поставщика в рублях (например, 2.61 ₽) сохранялась со статусом `'USD'`, из-за чего `costPer1kRub` ошибочно умножался на курс доллара (2.61 × 87 = 227 ₽).
2. **Ложный карантин каталога (Quarantine Trap):**
   - Фоновый синхронизатор `CatalogSyncService` при последующей сверке цен сравнивал `newCostRub` с `oldCostRub`.
   - Если происходило несовпадение валют, фиксировалось отклонение -98.9% или +8600%, из-за чего 345 услуг мгновенно уходили в карантин (`isQuarantined: true`) с отключением от витрины.
3. **Отсутствие обработки смены валюты поставщиком (Currency Shift Event):**
   - Если внешний провайдер (Vexboost, SMM Prime и т.д.) переключает валюту аккаунта с USD на RUB или наоборот, все услуги поставщика одномоментно меняют номинал ставок в ~90 раз.
   - Текущий алгоритм воспринимает это как глобальный спайк цен и блокирует весь каталог провайдера, вместо автоматического определения смены валюты и бесшовного обновления.
4. **Негибкость при плавающем курсе валют:**
   - Колебания курса USD/RUB (например, рост с 85 до 105 ₽) при жестком пороге карантина в 20% приводят к отключению услуг с валютой USD, даже если провайдер не менял свою исходную цену в долларах.

### 1.2. Цели проектирования
- **Цель 1:** Создать надежный сервис детекции валюты поставщика `ProviderCurrencyEngine` с 2-уровневой верификацией:
  1. *Direct Probe:* определение валюты из прямого ответа `/balance` поставщика.
  2. *Statistical Shift Detection (Catalog Heuristic):* статистический анализ каталога при синхронизации — если $\ge 70\%$ услуг провайдера синхронно изменили номинал ставки пропорционально курсу валют ($USD \leftrightarrow RUB$), система регистрирует событие смены валюты поставщика.
- **Цель 2:** Автоматическое самоисцеление (Auto-Healing) без карантина:
  - Авто-обновление `Provider.balanceCurrency` и всех связанных `Service.providerCurrency`.
  - Авто-пересчет `costPer1kRub` без ложных спайков.
- **Цель 3:** Динамическое управление розничной ценой (Dynamic Margin Guard):
  - При колебаниях валюты или умеренных изменениях себестоимости (< 50% в реальном исчислении) розничная цена `pricePer1000Cents` пересчитывается автоматически с сохранением маржи (`costPer1kRub * markup`) и красивым округлением (`applyBeautifulRounding`).
  - Карантин включается **ТОЛЬКО** при реальном скачке цены в валюте поставщика $\ge 50\%$, либо при превышении верхнего предела (`UPPER_SANITY_LIMIT_RUB = 100,000 ₽`), либо если розничная цена оказалась ниже себестоимости (Negative Margin Breach).

---

## 2. Архитектура решения (DPC-Engine Architecture)

```
       [ Входящий синк от провайдера (rawServices, balance) ]
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │       ProviderCurrencyEngine.analyzeSync     │
        └──────────────────────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
 1. Direct Currency Probe              2. Statistical Shift Detector
 (balanceData.currency !==             (>=70% услуг изменили rate
  provider.balanceCurrency)            пропорционально usdRate +-30%)
            │                                     │
            └──────────────────┬──────────────────┘
                               │
                    [ Shift Detected? ]
                      /             \
                    ДА              НЕТ
                   /                 \
  ┌─────────────────────────┐   ┌──────────────────────────────┐
  │ Auto-Heal Currency:     │   │ Standard Normalized Compare: │
  │ - Provider.currency     │   │ - oldCostRub vs newCostRub   │
  │ - Service.currency      │   │ - rawRateChange vs rubChange │
  │ - fresh costPer1kRub    │   └──────────────┬───────────────┘
  │ - NO QUARANTINE!        │                  │
  └───────────┬─────────────┘                  │
              │                                │
              └────────────────┬───────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │            Price Decision Engine             │
        │                                              │
        │ - newCostRub > 100 000 ₽?  -> QUARANTINE     │
        │ - rawRateChange >= +50%?   -> QUARANTINE     │
        │ - Margin Breach (cost>ret)?-> AUTO-RAISE / Q │
        │ - Normal drift (<50%)?     -> DYNAMIC UPDATE │
        └──────────────────────────────────────────────┘
```

---

## 3. Математическая модель детекции смены валюты

Пусть:
- $S = \{s_1, s_2, \dots, s_n\}$ — активные услуги провайдера, присутствующие и в БД, и в новом ответе провайдера ($n \ge 3$).
- $r_i^{\text{old}}$ — текущая ставка в БД (`Service.rate`).
- $r_i^{\text{new}}$ — новая ставка от провайдера (`rawRate`).
- $K_{\text{usd}}$ — актуальный курс доллара (например, 90.0).

Для каждой пары вычисляется коэффициент изменения $k_i = r_i^{\text{new}} / r_i^{\text{old}}$.

1. **Детекция USD $\to$ RUB (Провайдер переключил аккаунт в рубли):**
   - Базовый диапазон смены валюты: $k_i \in [0.65 \times K_{\text{usd}}, 1.35 \times K_{\text{usd}}]$ (для курса 90 это диапазон от ~58 до ~121).
   - Если доля таких услуг $\frac{|\{s_i \mid k_i \in \text{Range}\}|}{n} \ge 0.70$ (70%):
     $\implies$ **Вердикт:** `PROVIDER_CURRENCY_SHIFT_USD_TO_RUB`.

2. **Детекция RUB $\to$ USD (Провайдер переключил аккаунт в доллары):**
   - Базовый диапазон смены валюты: $k_i \in \left[\frac{0.65}{K_{\text{usd}}}, \frac{1.35}{K_{\text{usd}}}\right]$ (для курса 90 это диапазон от ~0.0072 до ~0.015).
   - Если доля таких услуг $\frac{|\{s_i \mid k_i \in \text{Range}\}|}{n} \ge 0.70$ (70%):
     $\implies$ **Вердикт:** `PROVIDER_CURRENCY_SHIFT_RUB_TO_USD`.

---

## 4. Контракт интерфейсов (TypeScript DTO)

```typescript
export interface CurrencyShiftDetectionResult {
  isShiftDetected: boolean;
  detectedCurrency: 'USD' | 'RUB' | null;
  previousCurrency: string;
  confidence: number; // 0.0 - 1.0
  reason: string;
  affectedServiceCount: number;
}

export interface ServicePriceEvaluation {
  action: 'UPDATE_SILENT' | 'QUARANTINE_PRICE_SPIKE' | 'QUARANTINE_SANITY_LIMIT' | 'KEEP_UNCHANGED';
  oldRate: number;
  newRate: number;
  oldCostRub: number;
  newCostRub: number;
  newRetailPriceCents: number;
  rawRateChangePct: number;
  rubCostChangePct: number;
  quarantineReason?: string;
}
```

---

## 5. План TDD (Red-Green-Refactor)

1. **Тест 1 (Direct Probe):** Провайдер возвращает `currency: 'RUB'` в `/balance`, в БД было `'USD'`. Детектор фиксирует смену валюты.
2. **Тест 2 (Statistical Shift USD $\to$ RUB):** 10 услуг, у 9 из них `rawRate` вырос в 85–95 раз (курс 90). Детектор без `/balance` определяет смену USD $\to$ RUB с уверенностью > 80%.
3. **Тест 3 (Statistical Shift RUB $\to$ USD):** 10 услуг, у 9 из них `rawRate` упал в ~90 раз ($k \approx 0.011$). Детектор определяет смену RUB $\to$ USD.
4. **Тест 4 (Плавающий курс валют без карантина):** Курс доллара изменился с 85 до 100 (+17.6%). Провайдер не менял rate (1.00 USD). Услуга НЕ уходит в карантин, розничная цена динамически корректируется.
5. **Тест 5 (Реальный спайк цен):** Провайдер поднял ставку с 1.00 USD до 1.80 USD (+80%). Услуга корректно отправляется в карантин (`Price Spike (+80%)`).
6. **Тест 6 (Negative Margin Protection):** Себестоимость поднялась в допустимых пределах, розничная цена автоматически пересчитывается с сохранением наценки `markup` и красивым округлением.
