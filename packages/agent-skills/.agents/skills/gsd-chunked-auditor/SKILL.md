---
name: gsd-chunked-auditor
description: Prepares chunked audit markdown prompts for external LLMs (Claude, GLM, etc.), grouping codebase files by logical domain and adding schema and project rules context.
---

# Chunked Audit Exporter Skill (gsd-chunked-auditor)

Этот скилл предназначен для подготовки и нарезки кодовой базы проекта SMMplan на логические чанки для передачи внешнему ИИ-аудитору (GLM-5.2, Claude 3.5 Sonnet и т.д.).

## 🚀 Как запустить

Вы можете подготовить чанки для аудита с помощью CLI-команды:

```bash
# Подготовить файлы для аудита конкретного домена (например, платежи)
npx tsx scripts/prepare-audit-chunks.ts --domain payments

# Подготовить файлы для всех поддерживаемых доменов
npx tsx scripts/prepare-audit-chunks.ts --domain all

# Подготовить файлы для аудита конкретной папки или файла
npx tsx scripts/prepare-audit-chunks.ts --path src/utils/

# Изменить максимальный размер чанка в символах (по умолчанию 50,000)
npx tsx scripts/prepare-audit-chunks.ts --domain auth --max-size 30000
```

## 📦 Доступные архитектурные домены

| Домен (`--domain`) | Описание | Основные Prisma-модели |
| --- | --- | --- |
| `payments` | Транзакции, биллинг, Ledger логи, платежные шлюзы (YooKassa). | User, Payment, LedgerEntry, Invoice, PromoCode |
| `providers` | SMM панели, теневой Redis буфер, синхронизация каталога, Zombie Eraser. | Provider, Service, ShadowService, Category |
| `orders` | Создание заказов, валидация, расчет лимитов и ETA, BullMQ воркеры. | User, Order, Service, ServiceRoute |
| `auth` | Magic links, API-ключи, сессии, RBAC роли и Middleware. | User, AuthToken, Session, StaffRole |
| `support` | Поддержка клиентов, тикет-система, Telegraf Telegram-бот. | User, Ticket, AuditLog, UserNote |

## 📂 Где искать результаты
Все сгенерированные промпты сохраняются в каталоге:
`[workspace_root]/.planning/audit/`

Файлы именуются по шаблону: `audit_[domain]_part_[номер_части].md`

Каждая часть содержит:
1. Системные инструкции для внешнего ИИ-аудитора с фокусом на безопасность и OWASP Top 10.
2. Вырезанные релевантные Prisma-модели для контекста БД.
3. Проектные контракты и правила разработки из `AGENTS.md`.
4. Блоки исходного кода файлов, входящих в данную часть домена.

## 🏁 Шаги проведения аудита
1. Выполните команду для интересующего вас домена.
2. Откройте сгенерированный markdown-файл, скопируйте его содержимое полностью.
3. Отправьте во внешнюю LLM и дождитесь ответа с замечаниями и кодовыми фиксами.
4. Повторите для остальных частей домена.
5. Скопируйте итоговый отчет внешнего аудитора в файл `auditor-review-report.md` в корне проекта.
6. Передайте вашему основному AI-разработчику команду: *"Исправь ошибки по отчету аудитора"*.
