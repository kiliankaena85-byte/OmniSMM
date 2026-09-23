# SERVICE PAGES SPECIFICATION

**Дата:** 28 июля 2026  
**Модуль:** Service-Level SEO Pages (`/services/[network]/[category]/[serviceSlug]`)

---

### 1. URL и адресация
- **Формат URL:** `/services/[network]/[category]/[serviceSlug]`
- **Слаг:** Формируется транслитерацией имени услуги с добавлением `numericId` (`podpischiki-telegram-fast-1234`).
- **Каноникализация:** Вычисляется с помощью `absoluteCanonical(tenantId, path)`.

### 2. Quality Gate & Индексация
Страница сервиса считается индексируемой (`index, follow`), если:
- `isActive === true`
- `isQuarantined === false`
- `cooldownUntil === null` или `cooldownUntil < now()`
- `pricePer1000Cents > 0`
- Сеть и категория активности (`isActive === true`)

Если любой из пунктов нарушен → `robots: { index: false, follow: false }`.

### 3. Структурные схемы (JSON-LD)
1. **BreadcrumbList**: Главная → Услуги → Сеть → Категория → Имя Сервиса.
2. **Service & Offer**: Указывает точное наименование услуги, провайдера, категорию и предложение `Offer` с точной розничной ценой за 1000 единиц (`priceCurrency: RUB`, `price: pricePer1kRub`).
3. **FAQPage**: Набор из 3-5 часто задаваемых вопросов по услуге.

### 4. Комплексная интеграция E-E-A-T
- **Характеристики**: Скорость ETA (P50/P90), лимиты `minQty`/`maxQty`, флаги Drip-Feed и Refill.
- **Требования к клиенту**: Специфика отправки ссылки (`targetType`), предупреждения `warningMessage`, юридические отметки `clientRequirement`.
- **Перелинковка**: Ссылки на смежные услуги категории, категории сети и релевантные статьи базы знаний.
