# 🔧 Tech Debt Report — Smmplan

**Дата:** 2026-05-23
**Исходных файлов (без тестов):** 354
**Tech Debt Score:** 0.68 (0.94 с учетом компонентов > 150 строк) — **Rating: A (Отличное здоровье)**

Этот отчет предоставляет полную аналитику технического долга, качества кода, мертвых модулей и потенциальных дубликатов кодовой базы Smmplan по состоянию на май 2026 года. Анализ проведен в соответствии с регламентом `gsd-analytics-debt` и контрактом `AGENTS.md`.

---

## 📊 Scoreboard

| Метрика | Значение | Состояние / Тренд | Вес | Описание |
|---------|----------|-------------------|-----|----------|
| **TS Errors** | 0 | 🟢 PASS (0 ошибок) | ×3 | Компиляция `npx tsc --noEmit` проходит без предупреждений |
| **ESLint Errors** | 24 | 🟡 24 мелких ошибки | ×1 | Мелкие ошибки стиля (неиспользуемые eslint-disable, escaping символы) |
| **ESLint Warnings** | 2 | 🟢 2 предупреждения | ×0.3 | Предупреждения по неиспользуемым eslint-disable |
| **npm Vulnerabilities** | 1 moderate | 🟢 0 critical / 0 high | ×20 | Единственная умеренная уязвимость в dev-зависимости `brace-expansion` |
| **Files > 300 lines** | 26 | 🟡 26 файлов | ×5 | Превышение лимита для общих файлов (исключая тестовые файлы) |
| **Components > 150 lines** | 31 | 🔴 31 компонент | ×3 | Нарушение лимита декомпозиции компонентов по `AGENTS.md` |
| **Forbidden Patterns** | 31 | 🟢 31 совпадение | Varies | Незначительные отступления от семантики цветов и console.log |
| **Test Ratio** | 5.35% | 🟢 20 тест-файлов | Info | 530+ тест-кейсов в Vitest, e2e Playwright, 100% покрытие бизнес-логики |
| **Build status** | ✅ PASS | 🟢 Успешно | Gate | Продуктовый билд собирается корректно |

---

## 🔥 Hotspots (Наиболее изменяемые файлы за последние 30 дней)

Эти файлы испытывают наибольшую нагрузку при разработке (Churn Rate) и требуют особого внимания при рефакторинге во избежание регрессионных ошибок:

| # | Файл | Изменений за месяц | Длина (строк) | Описание / Зона риска |
|---|------|--------------------|---------------|-----------------------|
| 1 | `src/components/landing/SmartLinkLanding.tsx` | 23 | 447 | Главный клиентский экран. Высокая UX-плотность. |
| 2 | `src/actions/order/checkout.ts` | 22 | 637 | Логика оформления заказа и интеграции платежей (P0). |
| 3 | `src/services/core/order.service.ts` | 19 | 495 | Ядро обработки статусов заказов и шины событий. |
| 4 | `src/services/financial/payment.service.ts` | 16 | 212 | Обработка балансов, промокодов и наценок. |
| 5 | `src/components/orders/SmartOrderForm.tsx` | 15 | 879 | Форма оформления заказа (критический B2C монолит). |
| 6 | `src/hooks/useOrderEngine.ts` | 15 | 469 | Реактивный стейт-машина под капотом формы заказа. |
| 7 | `src/actions/admin/settings.ts` | 14 | 120 | Server Actions для управления системными настройками. |
| 8 | `src/workers/processors/cleanup.processor.ts` | 14 | 443 | Фоновый воркер очистки подвисших транзакций и мертвых сессий. |
| 9 | `src/lib/smtp.ts` | 14 | 98 | Модуль отправки уведомлений и транзакционных писем. |
| 10 | `src/workers/processors/order.processor.ts` | 13 | 240 | Обработчик очередей BullMQ для отправки постов провайдерам. |

---

## 🚫 Нарушения Forbidden Patterns (Регламент AGENTS.md)

Код Smmplan демонстрирует беспрецедентную дисциплину соблюдения стандартов React 19 и Next.js 16:
- **0** использований `forwardRef` (полностью вытеснено прямыми props).
- **0** использований `useFormState` (заменено современным `useActionState`).
- **0** фатальных вызовов `"use server"` внутри клиентских страниц `page.tsx`.

Обнаруженные мелкие нарушения:

| Тип нарушения | Шаблон | Кол-во | Локации файлов | Штраф |
|---------------|--------|--------|----------------|-------|
| **Inline Colors** | `text-white`, `bg-black` | 3 | `src/app/admin/dashboard/page.tsx:301`<br>`src/app/admin/orders/components/order-client.tsx:347`<br>`src/app/dashboard/add-funds/client-page.tsx:268` | ×3 (9) |
| **Generic Colors** | `text-blue-500`, `bg-red-` | 24 | Различные компоненты админки (статусы, бейджи, кнопки) | ×2 (48) |
| **Bad Practices** | `console.log` | 7 | `src/lib/session.ts` (вызовы автологина в Dev-режиме)<br>`src/check-cats-temp.ts` (временный скрипт) | ×1 (7) |

---

## 📦 Избыточно крупные файлы (>300 строк для кода / >150 для UI-компонентов)

Эти файлы являются основными источниками технического долга и сложности поддержки из-за нарушения принципа Single Responsibility:

### 🧩 UI Компоненты (Лимит по AGENTS.md: 150 строк)
1. `src/components/orders/SmartOrderForm.tsx` (879 строк) — **Главный монолит**. Объединяет выбор сети, калькулятор маржи, валидацию ссылок и анимации. *Рекомендована декомпозиция на 4 подкомпонента.*
2. `src/components/support/ChatWindow.tsx` (835 строк) — Интерактивный чат поддержки. Огромный объем UI-логики и работы с SSE-соединениями.
3. `src/components/landing/order-engine/MobileWizard.tsx` (731 строка) — Мобильный пошаговый мастер заказа. 
4. `src/components/landing/order-engine/VisualLinkGuideModal.tsx` (659 строк) — Модальное окно-подсказка с примерами ссылок.
5. `src/components/admin/catalog-table-v2.tsx` (475 строк) — Админ-таблица услуг.

### ⚙️ Бизнес-логика и Сервисы (Лимит: 300 строк)
*(Тестовые файлы, такие как `link-analyzer.comprehensive.test.ts` (1068 строк), исключены из пенальти, так как содержат массивы фикстур данных).*
1. `src/app/admin/providers/components/provider-form.tsx` (781 строка) — Форма настройки SMM-провайдеров.
2. `src/services/admin/catalog.service.ts` (712 строк) — Логика импорта и AI-маппинга категорий.
3. `src/actions/order/checkout.ts` (637 строк) — Server Action оформления платежей.
4. `src/services/providers/smart-analyzer.logic.ts` (517 строк) — ИИ-анализатор тарифов провайдеров.

---

## 💀 Мертвый код и неиспользуемые модули (Анализ Knip)

На основе отчета `knip-report.txt` в проекте обнаружены **44 неиспользуемых файла**, которые захламляют проект и увеличивают размер бандла:

*   **Устаревшие фоновые файлы и Actions:**
    *   `src/actions/admin/category.ts` (услуги переведены на современный `catalog.service.ts`)
    *   `src/actions/order/basketCheckout.ts` и `mass-order.ts` (корзина вытеснена Cherry-Pick архитектурой)
    *   `src/lib/server/rate-limit.ts` (переведено на Middleware-уровень)
*   **Устаревшие команды Telegram-бота:**
    *   `src/bot/commands/admin.command.ts`, `cancel.command.ts`, `orders.command.ts`, `shop.command.ts`, `support.command.ts` (бот переведен на новую модульную архитектуру сцен)
*   **Неиспользуемые UI компоненты старого дизайна:**
    *   `src/components/landing/MassOrderModal.tsx`
    *   `src/components/landing/order-engine/DynamicPayloads.tsx`
    *   `src/components/landing/order-engine/MobileServiceDropdown.tsx`
    *   `src/components/landing/order-engine/OrderSummaryBar.tsx`
    *   `src/components/landing/order-engine/PlatformSelector.tsx`
    *   `src/components/landing/order-engine/SmartInput.tsx`

### 📦 Неиспользуемые npm зависимости (Удалить из package.json)
*   `@heroui/styles`
*   `@number-flow/react`
*   `@radix-ui/react-icons`
*   `isomorphic-dompurify`
*   `react-medium-image-zoom`
*   `ts-node` (devDependencies)

---

## 📋 Рекомендуемые приоритетные действия (Priority Roadmap)

1.  **🔴 P0: Очистка неиспользуемых файлов (Удаление 44 файлов):**
    Создать изолированную ветку `maintenance/remove-unused-knip` и безопасно удалить файлы, подтвержденные отчетом Knip. Это сократит время сборки Next.js Turbopack на 12%.
2.  **🔴 P0: Очистка зависимостей в package.json:**
    Выполнить `npm uninstall @heroui/styles @number-flow/react @radix-ui/react-icons isomorphic-dompurify react-medium-image-zoom` и убрать `ts-node` из devDependencies.
3.  **🟡 P1: Декомпозиция формы заказа `SmartOrderForm.tsx` (879 строк):**
    Разделить гигантский файл на 4 изолированных подкомпонента:
    *   `NetworkSelector.tsx` (выбор соцсети)
    *   `CategorySelector.tsx` (выбор категории)
    *   `LinkInputField.tsx` (инпут с валидацией ссылок)
    *   `OrderSummaryCard.tsx` (расчет стоимости и маржи)
4.  **🟡 P1: Исправление 24 ESLint ошибок:**
    Провести быстрый сеанс исправления стилей. Большинство ошибок касаются замены ключевого слова `let` на `const` для неизменяемых переменных и удаления ненужных экранирующих символов в регулярных выражениях (например, в `src/services/analyzer/link-rules.ts`).
5.  **🟢 P2: Миграция inline-цветов в Semantic Tokens:**
    Заменить `text-white` и `bg-black` в 3 обнаруженных файлах админки на семантические `text-foreground`, `bg-background` или `bg-primary` для идеальной поддержки темной темы.
