---
name: omnismm-checkout-integrity-guard
description: Используй этот скилл ВСЕГДА, когда Инженерный стандарт надежности
  витрин, чекаута и визардов в OmniSMM 1.0 (ExactMath копейка-в-копейку,
  Drip-Feed Floor, изоляция tenantId, активный CTA, эргономика мобильного
  чекаута и декомпозиция монолитов). НЕ применять для настройки системных
  демонов Docker или Linux cgroups.
metadata:
  tags:
    - omnismm
    - checkout
    - wizard
    - exactmath
    - drip-feed
    - tenant-isolation
    - mobile-cro
    - heroui-v3
    - react-19
---

# omnismm-checkout-integrity-guard — OmniSMM Checkout & Wizard Integrity Standard

## Назначение и границы (Overview & Scope)
Скилл `omnismm-checkout-integrity-guard` регламентирует целостность чекаута, валидацию ссылок, расчет стоимости и защиту от мошенничества при оформлении заказов в OmniSMM.

---

## 1. Концепция: Защита витрины и чекаута OmniSMM 1.0
Чекаут — это главная точка конверсии платформы, где сходятся деньги, каталог поставщика (Vexboost), мульти-тенантность и мобильные пользователи.
Любая ошибка при рефакторинге визарда (например, в `SmmplanOrderWizard.tsx` на 1739 строк) приводит к прямым финансовым потерям.

---

## 2. 7 Жестких Инвариантов чекаута

### 2.1. INV-1: Зеркалирование ExactMath (Zero Float Drift)
Расчет цены в браузере обязан давать ровно то же число копеек, что и серверный `ExactMath.calculateOrderCostKopecks`:
```ts
// ❌ ОШИБКА: JS Float дрейф дает погрешность в 1 копейку
const totalRub = (service.pricePerUnitRub * quantity).toFixed(2);

// ✅ ПРАВИЛЬНО: расчет в копейках
const priceKopecks = BigInt(Math.round(service.pricePerUnitRub * 100));
const totalKopecks = (priceKopecks * BigInt(quantity)) / BigInt(1);
const displayTotalRub = (Number(totalKopecks) / 100).toFixed(2);
```
В UI цена за единицу отображается СТРОГО: `₽ / шт` (запрещено писать "/ 1000 шт").

### 2.2. INV-2: Динамический синхронизатор Drip-Feed Floor
```tsx
// При изменении количества запусков или дней:
const effectiveMinQty = service.minQty * (isDripFeed ? runsCount : 1);

// При клике на степпер декремента:
const handleDecrement = () => {
  setQuantity((prev) => Math.max(effectiveMinQty, prev - stepQty));
};
```
Пользователю показывается пояснение: `Минимум для ${runsCount} запусков: ${effectiveMinQty} шт (по ${service.minQty} шт/запуск)`.

### 2.3. INV-3: Явная привязка tenantId
```tsx
// В вызове Server Action:
await checkoutAction({
  serviceId: selectedService.id,
  targetUrl: cleanUrl,
  quantity,
  tenantId: tenantId || 'smmplan', // ✅ СТРОГО ОБЯЗАТЕЛЬНО
  dripFeed: isDripFeed ? { runs: runsCount, interval } : undefined,
});
```

### 2.4. INV-4: Active CTA & Non-Blocking Validation
```tsx
// Кнопка НИКОГДА не disabled
<button
  type="submit"
  onClick={handleSubmitClick}
  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold"
>
  {isPending ? <Spinner /> : 'Оформить заказ'}
</button>

// Ошибка выводится строго над кнопкой
{validationError && (
  <div className="mb-2 p-2.5 rounded-lg bg-danger-50 border border-danger-200 text-danger text-xs animate-shake">
    {validationError}
  </div>
)}
```

### 2.5. INV-5: Мобильный тач и отступ под Sticky CTA
```tsx
// Инпут объема
<input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  value={quantity}
  onChange={(e) => setQuantity(Number(e.target.value.replace(/\D/g, '')))}
  onFocus={(e) => setTimeout(() => e.target.select(), 10)}
  className="text-base md:text-sm h-11 px-3 rounded-xl border border-border"
/>

// Скролл-контейнер формы
<div className="flex flex-col gap-4 pb-28 md:pb-6">
  {/* форма */}
</div>
```

### 2.6. INV-6: HeroUI v3 Compound Components
```tsx
<Select
  selectedKeys={new Set([selectedCategory])}
  onSelectionChange={(keys) => {
    const selected = Array.from(keys)[0] as string;
    if (selected) setSelectedCategory(selected);
  }}
>
  {/* опции */}
</Select>
```

### 2.7. INV-7: Декомпозиция монолитов (<= 200 строк)
Монолит `SmmplanOrderWizard.tsx` (1739 строк) декомпозируется на структуру:
- `src/components/orders/wizard/WizardContainer.tsx` (оркестратор, ~120 строк)
- `src/components/orders/wizard/ServiceSelectorStep.tsx` (~140 строк)
- `src/components/orders/wizard/QuantityDripStep.tsx` (~150 строк)
- `src/components/orders/wizard/PaymentGatewayStep.tsx` (~130 строк)
- `src/components/orders/wizard/StickySummaryBar.tsx` (~90 строк)

### 2.8. INV-8: Семантическое разрешение TargetType (Zero False-Incompatibility)
В схеме БД поле `Service.targetType` по умолчанию равно `"POST"`.
Запрещено доверять `service.targetType` напрямую или использовать fallback через логическое ИЛИ:
```tsx
// ❌ БАГ: "POST" truthy, inferTargetTypeFromName никогда не вызовется!
const target = s.targetType || inferTargetTypeFromName(s.name);

// ✅ ПРАВИЛЬНО: умное разрешение дефолтов
import { resolveServiceTargetType } from '@/utils/target-type-mapper';
const target = resolveServiceTargetType(s);
const isCompatible = isLinkServiceCompatible(detectedLinkType, target);
```
При любой фильтрации каталога по типу ссылки (`channel`, `post`, `profile`) или проверке совместимости в чекауте обязательно использовать `resolveServiceTargetType(service)`.

---

## Жесткие инварианты (Hard Invariants)
- 🛑 **ИНВАРИАНТ 1:** Server-Side Price Calculation: цена заказа рассчитывается строго на сервере в копейках BigInt.
- 🛑 **ИНВАРИАНТ 2:** TargetType Semantic Resolution: тип услуги определяется через resolveServiceTargetType.
- 🛑 **ИНВАРИАНТ 3:** Drip-Feed Floor Enforcement: минимальный объем заказа с автоподачей масштабируется кратно запускам.
- 🛑 **ИНВАРИАНТ 4:** No Phantom Brands: поддержка строго брендов SMMplan (smmplan.pro) и SMMflux (smmflux.ru).
- 🛑 **ИНВАРИАНТ 5:** Idempotent Order Creation: каждый заказ создается с уникальным ключом дедупликации.

---

## Пошаговый алгоритм выполнения (Step-by-step Protocol)
1. **Шаг 1:** Анализ контекста задачи и определение границ влияния.
2. **Шаг 2:** Проверка соответствия архитектурным инвариантам.
3. **Шаг 3:** Реализация изменений с соблюдением контрактов.
4. **Шаг 4:** Верификация через автоматические тесты и линтеры.
5. **Шаг 5:** Документирование и сохранение точки стабильности.

---

## Чеклист верификации (Verification Checklist)
- [ ] Проверены ли ключевые архитектурные инварианты?
- [ ] Укладывается ли код в лимиты сложности и размера?
- [ ] Отсутствуют ли регрессии в смежных подсистемах?
- [ ] Пройден ли автоматический запуск npm run lint:skills?
