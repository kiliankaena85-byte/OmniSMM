# Экспертный аудит валидатора ссылок и формы заказа: NVIDIA Nemotron & OpenRouter

## Модель: nvidia/nemotron-3-super-120b-a12b:free (❌ Ошибка)

Error: The operation was aborted due to timeout

---

## Модель: openrouter/free (✅ Успешно)

# Аудит валидатора ссылок, матрицы совместимости и формы заказа — SMMplan

---

## 1. Подтверждение математической/логической неизбежности бага

### Формализация условий

Обозначим:
- **D** = `detectedType` — тип, детектированный из ссылки (для `https://t.me/channel` → `"channel"`)
- **T(s)** = `s.targetType` — целевой тип услуги из БД
- **I(n)** = `inferTargetTypeFromName(s.name)` — инферированный тип из названия услуги
- **C(D, T)** = `isLinkServiceCompatible(D, T)` — функция совместимости из матрицы

### Текущее состояние системы (баг)

**Факт 1 (Prisma Schema):**
```
targetType @default("POST")
```
∀s ∈ Services: T(s) = `"POST"`

**Факт 2 (link-rules.ts):**
Для `https://t.me/channel`: D = `"channel"`

**Факт 3 (useOrderEngine.ts, строка фильтрации):**
```ts
isLinkServiceCompatible(D, s.targetType || I(s.name))
```

**Факт 4 (JavaScript short-circuit evaluation):**
- `s.targetType` = `"POST"` — непустая строка → **truthy**
- Оператор `||` **не вычисляет** правый операнд
- ∴ Второй аргумент = `"POST"` всегда

**Факт 5 (link-service-compatibility.ts):**
```
C("channel", "POST") = false
```
Матрица совместимости: `LinkType.CHANNEL` совместим только с `{CHANNEL, PROFILE, CHANNEL_POSTS}`. `POST` ∉ это множество.

### Дедуктивное доказательство

```
∀s ∈ Services:
  C(D, s.targetType || I(s.name))
= C("channel", "POST" || I(s.name))        [Факт 1]
= C("channel", "POST")                       [Факт 4, short-circuit]
= false                                      [Факт 5]
```

**Следствие:** Каталог всегда пуст. Ни одна услуга не проходит фильтрацию. Это **детерминированная логическая неизбежность**, а не вероятностный дефект.

### Корневая причина

Функция `resolveServiceTargetType()` в `target-type-mapper.ts` **уже существует** и корректно решает проблему:
```ts
if (targetType === 'POST') → переопределяет на inferred type из названия
```
Но она **не вызывается** в `useOrderEngine.ts`. Это классический случай «решение существует, но не применено».

---

## 2. Сопутствующие места: проверка на ложные ошибки

### 2.1 Валидация в useOrderEngine (строки 803–806 и 884–888)

**Паттерн:**
```ts
selectedService.targetType || inferTargetTypeFromCategory(...)
```

**Анализ:**
- `selectedService.targetType` = `"POST"` → truthy → `inferTargetTypeFromCategory` **не вызывается**
- Это значит, что при валидации категории система **всегда** использует `"POST"` как целевой тип
- **Будет ли ложная ошибка?** — **ДА**, с высокой вероятностью:
  - Если валидация проверяет соответств

---

