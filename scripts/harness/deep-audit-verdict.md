

Отличная и очень детальная постановка задачи. Я, как ведущий системный архитектор, провожу глубокий аудит и подтверждают логическую неизбежность бага, а также готовлю комплексный план по исправлению и защитным мерам.

### 1. Подтверждение логической неизбежности бага

**Анализ цепочки выполнения:**

1.  **Данные (Prisma):** Услуга в БД имеет `targetType: "POST"` (значение по умолчанию). Это **истинное** значение, а не `null` или `undefined`.
2.  **Логика (useOrderEngine):** Вызов `isLinkServiceCompatible(detectedType, s.targetType || inferTargetTypeFromName(s.name))`.
    *   `s.targetType` — это строка `"POST"`.
    *   Оператор `||` (или) проверяет левый операнд на " falsy" значение. Строка `"POST"` — это **truthy** значение.
    *   Следовательно, правый операнд `inferTargetTypeFromName(s.name)` **ниогда не будет вычислен и не будет передан в функцию**.
    *   В функцию `isLinkServiceCompatible` передается `targetType = "POST"`.
3.  **Совместимость (link-service-compatibility.ts):**
    *   `detectedType = LinkType.CHANNEL` (для ссылки `t.me/durov`).
    *   Матрица совместимости для `LinkType.CHANNEL` содержит разрешенные типы: `[CHANNEL, PROFILE, CHANNEL_POSTS]`.
    *   `ServiceTargetType.POST` в этом списке **отсутствует**.
    *   Функция возвращает `false`.
4.  **Результат:** Все услуги, независимо от их реального назначения (например, "Подписчики Telegram в канал"), отсеиваются фильтром, так как их `targetType` равен `"POST"`, а не `"CHANNEL"`.

**Вывод:** Баг является прямой следствием порочного круга в коде: значение по умолчанию `"POST"` из схемы БД блокирует любую динамическую логику определения типа цели из названия услуги или категории. Логически неизбежен.

---

### 2. Анализ сопутствующих мест

*   **Валидация в useOrderEngine (строки 803-806 и 884-888):**
    *   `normalizeServiceTargetType(selectedService.targetType || inferTargetTypeFromCategory(activeCat?.name))`
    *   **Тот же дефект.** `selectedService.targetType` (строка `"POST"`) truthy, поэтому `inferTargetTypeFromCategory` не вызывается. Это приводит к неправильной нормализации типа цели при валидации формы заказа.

*   **Кэш categoryServicesCache:**
    *   **Высокий риск.** Если кэш заполняется на стороне сервера или при первом рендере, он может содержать services с `targetType: "POST"`. Клиентский код, работающий с этим кэшом, унаследует ту же проблему. Требуется инвалидация кэша при исправлении логики.

*   **Мобильный визард useMobileWizard:**
    *   **Высокий риск.** Вероятно, использует те же вспомоговые функции (например, `isLinkServiceCompatible`) или логику фильтрации, что и основной хук `useOrderEngine`. Требует отдельной проверки и, вероятно, аналогичных исправлений.

*   **Автоматическая мутация ссылки mutateLink (строка 815):**
    *   **Средний риск.** Если мутация обновляет данные ссылки, включая `detectedType`, и эти данные используются для фильтрации, то после исправления логики фильтрации мутация должна работать корректно. Однако важно убедиться, что при мутации не кэшируется неверный `detectedType`.

---

### 3. Точный пошаговый план исправления

**Общий принцип:** Везде, где используется `targetType` из объекта услуги,我们必须 сначала проверить его на валидность (наличие значения, отличного от `"POST"`). Если значение отсутствует, равно `null`/`undefined` или равно `"POST"`, то его следует переопределить с помощью функции `resolveServiceTargetType`.

#### Шаг 1: Исправление главного конфликта в `useOrderEngine.ts`

**Файл:** `hooks/useOrderEngine.ts` (или аналогичный)

**Проблемные строки (пример):**
```typescript
// Строка ~800 (фильтрация услуг)
const compatibleServices = allServices.filter(s => 
  isLinkServiceCompatible(detectedType, s.targetType || inferTargetTypeFromName(s.name))
);

// Строка ~803 (валидация)
const normalizedTargetType = normalizeServiceTargetType(
  selectedService.targetType || inferTargetTypeFromCategory(activeCat?.name)
);
```

**Исправление (diff):**
```diff
--- a/hooks/useOrderEngine.ts
+++ b/hooks/useOrderEngine.ts
@@ -1,5 +1,6 @@
 import { isLinkServiceCompatible } from '../lib/link-service-compatibility';
 import { inferTargetTypeFromName } from '../lib/target-type-mapper';
+import { resolveServiceTargetType } from '../lib/target-type-mapper'; // 1. Импортируем нужную функцию
 import { inferTargetTypeFromCategory } from '../lib/target-type-mapper';

 // ... внутри хука ...

@@ -800,7 +801,8 @@ export const useOrderEngine = () => {
   // Фильтрация услуг
   const compatibleServices = allServices.filter(s => {
-    const effectiveTargetType = s.targetType || inferTargetTypeFromName(s.name);
+    // 2. Используем resolveServiceTargetType для корректного определения типа
+    const effectiveTargetType = resolveServiceTargetType(s);
     return isLinkServiceCompatible(detectedType, effectiveTargetType);
   });

@@ -803,7 +805,8 @@ export const useOrderEngine = () => {
   // Валидация формы
   const normalizedTargetType = normalizeServiceTargetType(
-    selectedService.targetType || inferTargetTypeFromCategory(activeCat?.name)
+    // 3. Для выбранной услуги также используем resolveServiceTargetType
+    resolveServiceTargetType(selectedService) || inferTargetTypeFromCategory(activeCat?.name)
   );
```

#### Шаг 2: Проверка и исправление `normalizeServiceTargetType`

**Файл:** `lib/target-type-mapper.ts`

Убедитесь, что функция `normalizeServiceTargetType` также корректно обрабатывает случай, когда ей передают `"POST"`. Идеально, если она внутри себя вызывает `resolveServiceTargetType` или имеет схожую логику.

#### Шаг 3: Исправление `categoryServicesCache`

**Файл:** Где создается/используется кэш (например, `lib/category-services-cache.ts` или в API route).

**Действие:** При создании кэша или при извлечении данных из него необходимо применять ту же логику `resolveServiceTargetType`. Например, при кэшировании массива услуг:

```typescript
// При сохранении в кэш (пример)
const servicesWithCorrectType = services.map(s => ({
  ...s,
  targetType: resolveServiceTargetType(s) // Перезаписываем targetType на корректный
}));
cache.set(categoryId, servicesWithCorrectType);
```

#### Шаг 4: Проверка мобильного визарда `useMobileWizard`

**Действие:** Визуально проверить код `useMobileWizard` на использование `s.targetType` напрямую. Вероятно, там есть аналогичные фильтры.

**Пример исправления (если нужно):**
```typescript
// В useMobileWizard.ts
import { resolveServiceTargetType } from '../lib/target-type-mapper';

// Вместо:
const isCompatible = isLinkServiceCompatible(linkType, service.targetType);

// Должно быть:
const isCompatible = isLinkServiceCompatible(linkType, resolveServiceTargetType(service));
```

#### Шаг 5: Тестирование

1.  **Юнит-тесты:** Добавить тесты для функции `resolveServiceTargetType`, чтобы она корректно возвращала `"CHANNEL"` для услуги с именем "Подписчики Telegram" и `targetType: "POST"`.
2.  **Интеграционное тестирование:** Протестировать сценарий из баг-репорта: ввести `https://t.me/durov`, убедиться, что в каталоге отображаются услуги для Telegram-каналов.

---

### 4. Pre-Mortem: 3 главных риска после исправления и защита

**Риск 1: Конфликт типов и непреднамеренное поведение для услуг с `targetType: "POST"` по назначению.**
*   **Описание:** Некоторые услуги действительно могут быть ориентированы на "POST" (например, "Лайки под пост"). Наше исправление будет принудительно переопределять `targetType` для таких услуг, если их название не содержит ключевых слов (например, "канал", "профиль"). `resolveServiceTargetType` может определить их как `CHANNEL` или `PROFILE`, что приведет к неправильной фильтрации.
*   **Защита:**
    1.  **Улучшение `resolveServiceTargetType`:** Функция должна быть умной. Она должна переопределять тип **только если** `targetType` равен `"POST"` **и** в названии услуги есть четкий маркер другого типа (например, "канал", "человек", "группа"). Если маркеров нет, оставлять `"POST"`.
    2.  **Явное указание типа:** Для услуг, которые действительно являются `POST`, но не имеют маркеров в названии, в админке должна быть возможность явно задать `targetType = "POST"`, и эта настройка должна具有 приоритет перед логикой `resolveServiceTargetType`. То есть, функция должна работать по схеме: `if (service.targetType && service.targetType !== 'POST') return service.targetType; else return inferFromName(service.name);`.

**Риск 2: Устаревшие данные в кэше и на стороне клиента.**
*   **Описание:** После развертывания исправленного кода старые версии страниц могут загрузиться с кэшированными данными, где `targetType` остался `"POST"`. Это временно усугубит проблему.
*   **Защита:**
    1.  **Инвалидация кэша:** При деплое необходимо инвалидировать `categoryServicesCache`.
    2.  **Кэширование на клиенте:** Использовать `revalidateTag` или `fetchOptions.cache = 'no-store'` для critical API endpoints, связанных с услугами, чтобы клиент всегда получал свежие данные.
    3.  **Градуальное rollout:** При возможности, развертывать изменения постепенно, чтобы минимизировать количество пользователей, столкнувш sich с несогласованными версиями кода и данных.

**Риск 3: Нарушение работы `mutateLink`.**
*   **Описание:** Если после мутации ссылки (например, изменения её описания) происходит повторная фильтрация услуг, и в этот момент `detectedType` не обновился корректно, мы можем снова попасть в ловушку.
*   **Защита:**
    1.  **Проверка обновления `detectedType`:** Убедиться, что в логике `mutateLink` после обновления ссылки принудительно пересчитывается `detectedType` с помощью analyzer, и это значение немедленно используется для фильтрации.
    2.  **Зависимости хука:** В `useOrderEngine` должны быть правильно указаны зависимости (например, `detectedType`), чтобы при его изменении фильтр пересчитывался.

**Резюме:** Исправление требует не просто замены `||` на умную функцию, а комплексного подхода, включающего пересмотр логики определения типа, работы с кэшем и тщательное тестирование для минимизации рисков. Главная защита — сделать логику `resolveServiceTargetType` максимально умной и предсказуемой, а кэширование — надежным.