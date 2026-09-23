# Phase 1: Foundation & Authentication - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Развертывание базового каркаса Next.js 16, настройка Prisma ORM с PostgreSQL и реализация системы безопасной авторизации (Auto-signup & Magic Link) без использования Oauth (zero-password flow).
</domain>

<decisions>
## Implementation Decisions

### Authentication Strategy
- **D-01:** Выбрана кастомная, наиболее надежная логика генерации одноразовых токенов (Magic Links) через Prisma + системный SMTP модуль (из существующего кода `D:\Smmplan`). Отказ от `NextAuth.js` EmailProvider во избежание конфликтов State и кеширования App Router.

### Database Schema (User Model)
- **D-02:** В модель User сразу закладывается строгая ролевая модель `Enum Role { USER, ADMIN, SUPPORT, SEO, INVESTOR }` для дальнейшего использования в RBAC (Phase 5).

### Email Handling
- **D-03:** Для Magic Link будут использоваться сверстанные HTML-шаблоны с красивой кнопкой входа (а не голый текст), для повышения конверсии и премиальности UX.

### General Instructions
- **D-04:** Версии фреймворков строго фиксированы (согласно глобальным User Rules): Next.js 16.0.10, React 19.0.0, Tailwind CSS 4.0.0, ESLint 10.0.0 (Flat Config).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Rules
- `.planning/PROJECT.md` — УТП, ограничения по инструментарию.
- `.planning/REQUIREMENTS.md` — Требования `AUTH-01`, `AUTH-02`, `AUTH-03` для Фазы 1.

</canonical_refs>

<specifics>
## Specific Ideas

- Возврат к старым SMTP-наработкам из D:\Smmplan позволит ускорить релиз и обеспечить 100% доставляемость без зависимости от облачных провайдеров Auth.
</specifics>

<deferred>
## Deferred Ideas

- Автоматическое создание сессии во время успешного HTTP-вызова платежного шлюза (будет реализовано в Phase 3).
</deferred>

---

*Phase: 01-foundation-authentication*
*Context gathered: 2026-04-16 via manual discuss-phase*
