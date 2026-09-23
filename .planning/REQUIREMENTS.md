# Requirements: SMMplan_lite

**Current Milestone:** v2.0 Extensions & Integration
**Core Value:** Расширение рынка сбыта за счет оптовых реселлеров B2B и подготовки к выходу на зарубежные рынки.

## v2.0 Requirements

### B2B Reseller Gateway
- [ ] **B2B-01**: Публичный API-ключ в личном кабинете пользователя (с функцией ротации/регенерации).
- [ ] **B2B-02**: Метод `POST /api/v1/order` для создания заказа из внешней системы, использующий баланс аккаунта.
- [ ] **B2B-03**: Метод `POST /api/v1/status` для получения статуса заказа (или списка заказов) по внешнему ID.
- [ ] **B2B-04**: Метод `POST /api/v1/services` для экспорта каталога услуг в унифицированном формате (совместимом с популярными движками SMM-панелей).

### Internationalization (i18n)
- [ ] **I18N-01**: Роутинг на базе App Router, поддерживающий `[locale]` (например, `/en/dashboard`, `/ru/dashboard`).
- [ ] **I18N-02**: Подключение словарей переводов (JSON dictionaries) для статических текстов UI.
- [ ] **I18N-03**: Расширение моделей Prisma (Service, Category) для поддержки динамических названий на разных языках или JSON-полей.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Oauth Authorization | Внешние риски 2026 года в РФ. |
| Авто-конвертация валют | Усложняет биллинг; принимаем платежи и ведем баланс только в базовой валюте, UI может лишь отображать калькуляцию. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| B2B-01 | Phase 1 | Pending |
| B2B-02 | Phase 1 | Pending |
| B2B-03 | Phase 1 | Pending |
| B2B-04 | Phase 1 | Pending |
| I18N-01 | Phase 2 | Pending |
| I18N-02 | Phase 2 | Pending |
| I18N-03 | Phase 2 | Pending |
