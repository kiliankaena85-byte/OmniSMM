# ADR-2026-16: Санация мобильного визарда заказа: устранение дублирования соцсетей, ликвидация мёртвого кода авто-выбора категорий и архитектурная чистота Step 1
## Архитектурное решение, системный анализ и спецификация требований (ADR / SAD / BRD)

**Платформа:** OmniSMM 1.0 (SMMplan / SMMflux)  
**Статус:** PROPOSED / PENDING HUMAN APPROVAL  
**Автор:** Lead Solution Architect & Senior Business Analyst (OmniSMM Core Team)  
**Целевая аудитория:** Frontend Engineers, Fullstack Developers, UX/UI Designers, QA Engineers, Product Owner  
**Дата:** 4 сентября 2026 г.  
**Связанные документы:** 
- [`docs/architecture/ADR-2026-09-UNIFIED-ORDER-ENGINE.md`](file:///d:/SMM_plan_2/docs/architecture/ADR-2026-09-UNIFIED-ORDER-ENGINE.md)
- [`docs/architecture/ADR-2026-14-SEAMLESS-CHECKOUT-AUTH.md`](file:///d:/SMM_plan_2/docs/architecture/ADR-2026-14-SEAMLESS-CHECKOUT-AUTH.md)
- [`docs/RELEASE_ACCEPTANCE_CRITERIA_2026.md`](file:///d:/SMM_plan_2/docs/RELEASE_ACCEPTANCE_CRITERIA_2026.md)
- [`AGENTS.md` (Правило 3: Стандарты верстки, UX и Дизайн-Системы)](file:///d:/SMM_plan_2/AGENTS.md)

---

## 1. Executive Summary & As-Is Audit

### 1.1. Контекст проблемы
Пользователь обратил внимание на два взаимосвязанных дефекта мобильного визарда оформления заказа на главном экране (предоставлены скриншоты `media_1788519694301.png`, `media_1788519739288.png`, `media_1788519745651.png`):
1. **Дублирование иконки Telegram («вылез ещё один Telegram»):**  
   В мобильном виде в Шаге 1 прямо под инпутом отображаются 4 кнопки быстрого выбора соцсетей (`Или выберите соцсеть для заказа: [Telegram] [ВКонтакте] [Instagram] [YouTube]`), хотя ниже расположена кнопка ручного выбора из каталога (`📁 Или выбрать услугу вручную из каталога →`), которая открывает каталог с тем же набором соцсетей.
2. **Ложный авто-предвыбор категории («Подписчики на канал и в группу»):**  
   При первом открытии сайта чистым пользователем-гостем, когда в поле ввода ссылки ещё ничего не введено и каталог вручную не открывался, под кнопкой каталога уже отображается свернутый аккордеон Шага 2:
   ```text
   2. КАТЕГОРИЯ: Подписчики на канал и в группу <
   ```
   Пользователь ещё не выбрал ни платформу, ни цель продвижения, а система уже самовольно «зафиксировала» категорию подписчиков Telegram. Это сбивает с толку клиента, создает ощущение «багованности» интерфейса и нарушает базовый контракт UX Smart Link First.

---

### 1.2. Детальный аудит кодовой базы (As-Is Defect Matrix)

В ходе углубленного архитектурного аудита кодовой базы выявлены точные первопричины обоих дефектов:

| № | Файл / Компонент | Локализация | Описание дефекта в коде | Последствия для пользователя (UX & Business) |
| :- | :--- | :--- | :--- | :--- |
| **D-01** | `src/components/landing/order-engine/wizard-steps/MobileStep1Link.tsx` | Строки 248–281 | **Хардкод-блок `Quick Platform Shortcuts`:**  <br>При пустом `url` рендерится дополнительная сетка из 4 жестко закодированных соцсетей (`Telegram`, `ВКонтакте`, `Instagram`, `YouTube`). Код добавлен в коммите `cc9ee1b5` в качестве экспериментального шортката. | **Визуальный шум и дублирование:** В интерфейсе Шага 1 возникает смысловая коллизия: пользователю предлагается «Вставить ссылку», затем «Или выберите соцсеть из 4 кнопок», затем «Или выбрать вручную из каталога» (где снова те же соцсети). Иконка Telegram дублируется. Первый экран перегружен. |
| **D-02** | `src/hooks/useOrderEngine.ts` | Строки 97–108 | **Принудительный легаси авто-предвыбор сети и категории:**  <br>```typescript<br>const defaultNet = sortedInitialCatalog.find(n => n.slug === 'telegram') \|\| sortedInitialCatalog[0];<br>const defaultCat = defaultNet?.categories.find(c => c.name.toLowerCase().includes('подписчики')) \|\| defaultNet?.categories[0];<br>const [networkId, setNetworkId] = useState(defaultNet?.id \|\| "");<br>const [categoryId, setCategoryId] = useState(defaultCat?.id \|\| "");<br>``` | **Нарушение чистого состояния:** Даже при абсолютно пустом вводе хук ядра инициализирует `categoryId` значением категории подписчиков Telegram. Стейт-машина считает, что категория «уже выбрана». |
| **D-03** | `src/components/landing/order-engine/wizard-steps/MobileStep2Category.tsx` | Строки 62, 194–210 | **Преждевременный рендер свернутого аккордеона:**  <br>Условие показа свернутого аккордеона Шага 2: `currentStep !== 2 && !!categoryId`. Из-за дефекта D-02 флаг `!!categoryId === true` с первой миллисекунды загрузки страницы, поэтому Шаг 2 отображается прямо под Шагом 1 на экране пустого визарда. | **Когнитивный диссонанс гостя:** Пользователь видит под инпутом надпись «2. КАТЕГОРИЯ: Подписчики на канал и в группу». Возникает впечатление, что сайт «глючит», помнит чей-то чужой заказ или принуждает заказывать подписчиков в Telegram. |
| **D-04** | `src/components/landing/order-engine/wizard-steps/useMobileWizard.ts` | Строки 204–208 | **Флаги видимости шагов:** `hasCategory = Boolean(categoryId)` возвращает `true` на Шаге 1, искажая расчет прогресса в мобильном степпере `MobileWizardStepper`. | В степпере Шаг 2 может выглядеть наполовину активным/пройденным до какого-либо действия пользователя. |

---

## 2. Business Requirements Document (BRD) & User Stories

### 2.1. Концепция целевого взаимодействия (Target UX)
Мобильный визард оформления заказа должен быть **предельно чистым, сфокусированным и не содержать дублирующих или преждевременных элементов**:
1. **Правило единого фокуса Шага 1 (Single Intent Focus):**
   - На Шаге 1 пользователь видит:
     * Поле ввода ссылки с кнопкой «Вставить».
     * Компактную подсказку «❓ Где взять ссылку?».
     * Кнопку альтернативного сценария: «📂 Или выбрать услугу вручную из каталога →».
   - Никаких разрозненных плашек и повторных кнопок «Или выберите соцсеть для заказа: [Telegram]...» в Шаге 1 быть не должно. Каталог открывается централизованно через `MobileCatalogModal`.
2. **Правило нейтрального старта (Zero Pre-Selection Invariant):**
   - При первом открытии сайта гостем без переданных URL-параметров (`?network=...`, `?category=...`, `?service=...`) и без драфта заказа:
     * `url = ""`
     * `networkId = ""`
     * `categoryId = ""`
     * `selectedService = null`
   - Никакая категория или соцсеть НЕ должна быть тайно или явно предвыбрана.
   - Аккордеон Шага 2 («2. КАТЕГОРИЯ») **НЕ отображается**, пока пользователь не сделал первый шаг (не вставил ссылку либо не выбрал категорию в каталоге).

### 2.2. Пользовательские сценарии (User Stories)
- **US-01 (Продвижение по ссылке — Smart Link First):**  
  *Как мобильный пользователь, я открываю главную страницу, вставляю ссылку на свой канал `https://t.me/mychannel` и вижу, как система мгновенно определяет «Telegram • Канал». Только после этого раскрывается Шаг 2 с релевантными целями продвижения для каналов (Подписчики, Просмотры, Бусты).*
- **US-02 (Ручной выбор из каталога — Catalog First):**  
  *Как мобильный пользователь без готовой ссылки, я нажимаю «📂 Или выбрать услугу вручную из каталога →». Передо мной открывается модальный каталог `MobileCatalogModal`, где я выбираю соцсеть (например, ВКонтакте), затем категорию, затем тариф. После выбора тарифа я возвращаюсь в визард для ввода ссылки и завершения заказа.*
- **US-03 (Сохранение сессии и Magic Link):**  
  *Если я возвращаюсь по Magic Link (`?auth_resume=1`) или перехожу по прямой ссылке на категорию (`?network=telegram&category=subscribers`), система корректно восстанавливает предвыбранные значения из снапшота или URL-параметров.*

---

## 3. Архитектурный дизайн To-Be (SAD & State Machine)

### 3.1. Диаграмма состояний мобильного визарда (State Transition Diagram)

```mermaid
stateDiagram-v2
    [*] --> Step1_Empty: Открытие страницы (гость)

    state Step1_Empty {
        [*] --> InputFocused
        note right of Step1_Empty
            Чистое состояние:
            - url: ""
            - networkId: ""
            - categoryId: ""
            Шаг 2 СКРЫТ
        end note
    }

    Step1_Empty --> Step1_Analyzed: Пользователь вставил ссылку
    Step1_Empty --> CatalogModal: Клик "Или выбрать услугу вручную из каталога"

    state Step1_Analyzed {
        note right of Step1_Analyzed
            LinkAnalyzer определяет:
            - platform: "Telegram"
            - detectedType: "CHANNEL"
            - availableCategories: [Subscribers, Boosts]
        end note
    }

    Step1_Analyzed --> Step2_CategorySelection: Автоматический переход к выбору цели (Step 2)

    state CatalogModal {
        ModalStep1_Networks --> ModalStep2_Categories: Выбор соцсети
        ModalStep2_Categories --> ModalStep3_Services: Выбор категории
    }

    CatalogModal --> Step1_WithPreselectedService: Выбран конкретный тариф
    Step1_WithPreselectedService --> Step4_Checkout: Пользователь вставил ссылку

    state Step2_CategorySelection {
        note right of Step2_CategorySelection
            Отображаются только подходящие категории.
            Аккордеон Шага 1 свернут (показывает URL).
        end note
    }

    Step2_CategorySelection --> Step3_TariffSelection: Клик по карточке категории
    Step3_TariffSelection --> Step4_Checkout: Выбор тарифа
```

---

### 3.2. Спецификация изменений в компонентах

#### 1. Очистка `MobileStep1Link.tsx`
- **Удаление:** Полностью демонтировать блок строк 248–281 (`{/* Quick Platform Shortcuts when link is empty */}`).
- **Результат:** 
  - Устраняется дублирование Telegram и других соцсетей.
  - Высота первого экрана сокращается на 85px.
  - Поле ввода ссылки и кнопка каталога находятся в фокусе внимания пользователя.

#### 2. Нормализация начального состояния в `useOrderEngine.ts`
- **Изменение:** Заменить жесткую привязку к Telegram и «Подписчикам»:
  ```typescript
  // Было (As-Is):
  const defaultNet = sortedInitialCatalog.length > 0 
    ? (initialNetworkId ? sortedInitialCatalog.find(n => n.id === initialNetworkId) : null) || (sortedInitialCatalog.find((n: PublicNetwork) => n.slug === 'telegram') || sortedInitialCatalog[0]) 
    : null;
  const defaultCat = defaultNet && defaultNet.categories.length > 0 
    ? (initialCategoryId ? defaultNet.categories.find(c => c.id === initialCategoryId) : null) || (defaultNet.categories.find((c: PublicCategory) => c.name.toLowerCase().includes('подписчики')) || defaultNet.categories[0]) 
    : null;

  // Стало (To-Be):
  // Инициализируем сеть и категорию ТОЛЬКО если они переданы явно через props
  // (например, при переходе по прямой ссылке, reorder или SSR параметрах)
  const defaultNet = initialNetworkId 
    ? sortedInitialCatalog.find(n => n.id === initialNetworkId) || null 
    : null;
  const defaultCat = defaultNet && initialCategoryId 
    ? defaultNet.categories.find(c => c.id === initialCategoryId) || null 
    : null;

  const [url, setUrl] = useState("");
  const [networkId, setNetworkId] = useState(defaultNet?.id || "");
  const [categoryId, setCategoryId] = useState(defaultCat?.id || "");
  ```
- **Десктопная обратная совместимость:**  
  В десктопном каталоге (`SmartLinkLanding.tsx`), если пользователь не ввёл ссылку и листает каталог внизу, `NetworkSelector` при клике на таб соцсети штатно устанавливает `setNetworkId` и `setCategoryId(net.categories[0].id)`. Если ничего не выбрано — `SmartLinkLanding` отображает аккуратный дефолтный экран «Вставьте ссылку или выберите платформу».

#### 3. Защита рендеринга в `MobileStep2Category.tsx`
- **Изменение:** Свернутый аккордеон Шага 2 (`2. Категория: ...`) должен отображаться ТОЛЬКО тогда, когда:
  1. Пользователь уже находится на более позднем шаге (`currentStep > 2`), И
  2. Категория действительно была осознанно выбрана (`!!categoryId`).
- При `currentStep === 1` Шаг 2 **НЕ рендерится вовсе**:
  ```typescript
  // В MobileStep2Category.tsx:
  if (currentStep === 1) {
    return null;
  }
  ```
- Когда пользователь вставляет валидную ссылку на Шаге 1, визард переводит `activeStep` на 2 (`setActiveStep(2)`), и Шаг 2 плавно разворачивается с анимацией framer-motion.

#### 4. Синхронизация флагов в `useMobileWizard.ts`
- `hasCategory`: истинно только когда `Boolean(categoryId && currentStep >= 2)`.
- `shouldShowCategories`: рендерится строго при `currentStep >= 2`.

---

## 4. Pre-Mortem анализ рисков и устойчивости (Failure Mode Simulation)

| Сценарий потенциального сбоя | Вероятность x Влияние | Защитный механизм в коде (Fail-Safe Guard) |
| :--- | :--- | :--- |
| **Сбой 1: На десктопе при пустом `networkId` развалится таблица тарифов** | Средняя x Высокая | **Защита:** В `SmartLinkLanding.tsx` (строки 372–380) уже заложены защитные ветки: при `!networkId` рендерится аккуратный пустой плейсхолдер с призывом вставить ссылку или выбрать соцсеть. Для десктопного каталога без ссылки при первом клике на `NetworkSelector` автоматически активируется первая категория сети. |
| **Сбой 2: Ломается возврат по ссылке Magic Link (`?auth_resume=1`)** | Низкая x Критическая | **Защита:** Снапшот заказа (`smmplan_pending_order` / `omni_pending_order_v1`) восстанавливает точные значения `networkId`, `categoryId` и `serviceId` из `sessionStorage` в хуке `useOrderEngine`. Инициализация пустыми строками не препятствует гидратации сохраненного заказа. |
| **Сбой 3: Падение существующих unit-тестов визарда** | Высокая x Средняя | **Защита:** Тест `mobile-wizard-smoke.test.tsx` проверял наличие строки `'Или выберите соцсеть для заказа:'`. Тест будет обновлен в соответствии с новой спецификацией (проверка отсутствия лишних кнопок и чистого перехода через кнопку каталога). |
| **Сбой 4: Регрессия в ручном выборе через `MobileCatalogModal`** | Низкая x Высокая | **Защита:** Коллбэк `handleSelectServiceFromCatalog` в `SmartLinkLanding.tsx` явно устанавливает `setNetworkId`, `setCategoryId` и `setSelectedService`, переводя визард на Шаг 4 (или Шаг 1 с заполненными данными тарифа). Процесс полностью изолирован и не зависит от дефолтов. |

---

## 5. План поэтапной реализации для команды (Task Breakdown)

### Фаза 1: Бэкенд и логика стейт-машины (Engine)
- [ ] **Task 1.1:** Рефакторинг `useOrderEngine.ts` — устранение принудительного хардкода `defaultNet` (Telegram) и `defaultCat` (Подписчики). Инициализация только при явных пропсах.
- [ ] **Task 1.2:** Обновление `useMobileWizard.ts` — корректировка вычисления `hasCategory` и блокировка отображения Шага 2 при `currentStep === 1`.

### Фаза 2: Интерфейс и санация разметки (UI & Clean-Up)
- [ ] **Task 2.1:** Зачистка `MobileStep1Link.tsx` — полное удаление избыточного блока `Quick Platform Shortcuts` (строки 248–281).
- [ ] **Task 2.2:** Корректировка `MobileStep2Category.tsx` — возврат `null` при `currentStep === 1`, чтобы исключить появление ложного свернутого аккордеона под инпутом.

### Фаза 3: Контроль качества и регрессионный сьют (Verification & QA)
- [ ] **Task 3.1:** Обновление тестов `src/__tests__/mobile-wizard-smoke.test.tsx` под новый контракт чистого первого экрана.
- [ ] **Task 3.2:** Проверка типов `npx tsc --noEmit` (0 ошибок).
- [ ] **Task 3.3:** Прогон полного сьюта визарда (`npx vitest run src/__tests__/mobile-wizard-smoke.test.tsx`).
- [ ] **Task 3.4:** Контроль утечек секретов (`node scripts/check-bundle-secrets.mjs`).
- [ ] **Task 3.5:** Фиксация результатов в `CURRENT_STATE.md` и коммит в `origin/main`.

---

## 6. Резюме архитектора для согласования
Предлагаемое решение:
1. Полностью ликвидирует дублирование Telegram и разгружает первый мобильный экран от визуального мусора.
2. Искореняет мёртвый легаси-код скрытого авто-выбора категорий («Подписчики на канал и в группу»), возвращая пользователю полный контроль над заказом.
3. Сохраняет 100% обратную совместимость с десктопным каталогом, восстановлением заказов через Magic Link и ручным выбором через модальный каталог.
