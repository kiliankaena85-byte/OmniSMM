# Bug Assessment: Mobile View & Wizard Layout Defects

- **Slug**: mobile-view-bugs
- **Created**: 2026-09-12
- **Source**: "твоя задача найти и справить баги в мобильном виде"
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)
Пользователь запросил поиск и исправление дефектов в мобильном представлении (Mobile View / Mobile Wizard / Mobile Header) платформы OmniSMM (SMMplan / SMMflux).

## Symptom
1. **Перегрузка шапки на мобильных экранах (< 640px)**: При авторизованном пользователе в хедере одновременно отображаются логотип, полноразмерная кнопка «Личный кабинет», кнопка «Выйти» и меню-гамбургер. На смартфонах с шириной 360–390px (iPhone SE, Galaxy A) это приводит к дефициту ширины (суммарно > 360px) и риску распирания/сжатия логотипа. При этом те же действия уже дублируются внутри меню-гамбургера.
2. **Лишние сетевые запросы при выборе оплаты (`MobileStep4Checkout.tsx`)**: Хук `useEffect` перехватывает изменение `selectedGateway`, вызывая повторный динамический импорт и повторный запрос к `getAvailableGatewaysAction()` при каждом переключении радиокнопки способа оплаты.
3. **Антипаттерн динамических классов Tailwind (`MobileCheckoutGateways.tsx`)**: Конструкция `"sm:grid-cols-" + gateways.length` генерирует динамические имена классов, которые не попадают в статический CSS-бандл Tailwind v4, что приводит к некорректной сетке на планшетах/смартфонах.
4. **Перекрытие контента плавающим CTA-баром (`MobileStickyCTA.tsx`)**: Нижняя плавающая панель `MobileStickyCTA` (`z-[150]`, высота ~65px + safe-area) перекрывает элементы внизу страницы, так как нижний паддинг контейнера составляет лишь `pb-10` (40px) вместо `pb-28`.
5. **Превышение архитектурного лимита строк (`arch-boundary-guard`)**: `MobileStep1Link.tsx` (295 строк) и `MobileStep2Category.tsx` (202 строки) превышают лимит $\le 200$ строк, установленный контрактом разработки.

## Reproduction
1. Открыть гостевой или пользовательский экран на мобильном вьюпорте (360x800 или 390x844).
2. Авторизоваться и открыть шапку — зафиксировать скученность кнопок «Личный кабинет», «Выйти» и иконки меню в строке высотой 64px.
3. Вставить ссылку в визард, перейти на шаг 4 («Оплата»).
4. Открыть вкладку Network в DevTools и кликать между СБП, Криптой и Балансом — зафиксировать избыточный вызов `getAvailableGatewaysAction()` на каждый клик.
5. Прокрутить мобильный экран вниз при видимом `MobileStickyCTA` — зафиксировать частичное перекрытие нижних кнопок/ссылок.

## Suspected Code Paths
- `src/components/landing/Header.tsx:89-140` — неадаптивный рендеринг кнопок авторизации и выхода на мобильных экранах.
- `src/components/landing/order-engine/wizard-steps/MobileStep4Checkout.tsx:46-58` — циклическая зависимость `useEffect` от `selectedGateway`.
- `src/components/landing/order-engine/wizard-steps/MobileCheckoutGateways.tsx:72` — динамическая конкатенация `sm:grid-cols-${gateways.length}`.
- `src/components/landing/order-engine/wizard-steps/MobileStickyCTA.tsx:31` и `src/components/landing/SmartLinkLanding.tsx:73` — недостаточный `padding-bottom` при фиксированном нижнем баре.
- `src/components/landing/order-engine/wizard-steps/MobileStep1Link.tsx:1-308` — монолитный компонент (295 строк), подлежащий декомпозиции бейджей детекции.

## Root Cause Hypothesis
Историческое накопление правок визарда привело к двум классам дефектов: 1) Реактивные сайд-эффекты (перезапрос шлюзов в `useEffect` при смене стейта выбора); 2) Нарушение адаптивной плотности (хедер не скрывает длинный текст кнопки профиля на экранах `< sm`, стики-бар не резервирует safe-area отступ снизу). Уверенность: **High** (подтверждено прямым анализом кода компонентов).

## Proposed Remediation

**Preferred**:
1. В `Header.tsx`: Для мобильных экранов (`< sm`) скрывать текстовую плашку «Личный кабинет» и отдельную кнопку выхода, оставив компактную иконку пользователя или перенеся управление профилем исключительно в гамбургер-меню (`md:hidden`).
2. В `MobileStep4Checkout.tsx`: Устранить `selectedGateway` из массива зависимостей `useEffect` загрузки шлюзов, выполняя проверку доступности единожды при монтировании или только при получении ответа.
3. В `MobileCheckoutGateways.tsx`: Заменить динамическую строку на детерминированные статические классы Tailwind: `grid-cols-2 sm:grid-cols-4`.
4. В `SmartLinkLanding.tsx` / `MobileWizard.tsx`: Добавить класс `pb-28` для контейнера мобильного визарда, гарантируя свободную зону прокрутки над `MobileStickyCTA`.
5. В `MobileStep1Link.tsx`: Вынести блок детекции ссылки (`Smart Detection Live Badge`) в субкомпонент `MobileStep1DetectionBadge.tsx`, сократив файл до $\le 180$ строк.

**Files likely to change**:
- `src/components/landing/Header.tsx`
- `src/components/landing/order-engine/wizard-steps/MobileStep4Checkout.tsx`
- `src/components/landing/order-engine/wizard-steps/MobileCheckoutGateways.tsx`
- `src/components/landing/order-engine/wizard-steps/MobileStickyCTA.tsx`
- `src/components/landing/order-engine/wizard-steps/MobileStep1Link.tsx`
- `src/components/landing/order-engine/wizard-steps/MobileStep1DetectionBadge.tsx` [NEW]

**Tests to add or update**:
- `src/__tests__/architecture/mobile-wizard-hygiene.test.ts` — тест на отсутствие динамических классов Tailwind, размер компонентов $\le 200$ строк и отсутствие циклических эффектов.

## Risks & Considerations
- **Регрессия верстки лендинга**: Изменения затрагивают только адаптивные классы `< md` и субкомпоненты мобильного визарда. Десктопный полноэкранный чекаут `PlanFullscreenCheckout` изолирован и не изменяется.
- **Связь с безопасностью**: 100% сохранение соответствия 152-ФЗ и 54-ФЗ.

## Next Step
Запустить команду устранения: `/speckit-bug-fix slug=mobile-view-bugs`
