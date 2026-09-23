# План задач: Революция техподдержки Smmplan (B2C & B2B — Этап 2)

## Шаг 1: Разработка B2B Bulk Order Parser & Attached Grid
- `[ ]` Создать утилитарный файл [ticket-parser.ts](file:///d:/SMM_plan_2/src/utils/ticket-parser.ts) с функцией регулярных выражений для парсинга ID заказов.
- `[ ]` Отредактировать Server Actions в [ticket.ts](file:///d:/SMM_plan_2/src/actions/support/ticket.ts), внедрив безопасные методы массовых операций `bulkRefillOrdersAction` и `bulkRefundOrdersAction` (с подсчетом в копейках).
- `[ ]` Спроектировать и внедрить компонент `AttachedOrdersGrid` в интерфейс диалога [unified-workspace.tsx](file:///d:/SMM_plan_2/src/app/admin/tickets/components/unified-workspace.tsx).
- `[ ]` Обеспечить корректное отображение карточек прикрепленных заказов в чате [ChatWindow.tsx](file:///d:/SMM_plan_2/src/components/support/ChatWindow.tsx).

## Шаг 2: ИИ-диагностика первого уровня (AI-First Triage) & Динамический шаблонизатор
- `[ ]` Обновить сервис [ai-support.service.ts](file:///d:/SMM_plan_2/src/services/admin/ai-support.service.ts), добавив автодиагностику (Remains, ETA, логи ошибок) на базе Gemini 3.5.
- `[ ]` Реализовать шаблонизатор с динамическими переменными (`{client_name}`, `{order_id}`, `{refund_amount}`, `{provider_error}`).

## Шаг 3: Разработка B2B Support API & Webhooks
- `[ ]` Создать новые API-роуты контроллеров во вкладке [route.ts](file:///d:/SMM_plan_2/src/app/api/v2/tickets/route.ts).
- `[ ]` Реализовать сервис вебхуков [webhook.service.ts](file:///d:/SMM_plan_2/src/services/support/webhook.service.ts) с интеграцией очередей BullMQ для надежного Retry Backoff.

## Шаг 4: Тестирование и Верификация (Zero-Defect)
- `[ ]` Проверить тайпчек всего проекта: `npx tsc --noEmit`.
- `[ ]` Запустить тесты Vitest: `npx vitest run`.
- `[ ]` Запустить полную боевую сборку проекта Next.js: `npm run build`.
- `[ ]` Проверить адаптивность сетки `AttachedOrdersGrid` на мобильных экранах (от 320px) и соответствие стандартам WCAG 2.2 AA.
