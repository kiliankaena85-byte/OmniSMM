# yandex-seo-search-architect (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **SSR-First Invariant:** Каталог, цены за 1 шт. и описания услуг обязаны отдаваться в начальном SSR HTML. Запрещено полагаться на клиентский рендеринг для YandexBot.
2. **Absolute Canonical Invariant:** Тег `<link rel="canonical">` обязан быть строго абсолютным через `absoluteCanonical(tenantId, path)` без UTM и query-параметров.
3. **Clean-param in Robots.txt:** `robots.txt` обязан содержать директиву `Clean-param: utm_source&utm_medium&token /` для исключения дублей страниц в индексе Яндекса.
4. **Baden-Baden Keyword Floor:** Плотность ключевых слов в SEO-текстах строго < 2.5%. Запрещен переспам коммерческими ключами («купить накрутку дешево»).
5. **Schema.org JSON-LD Standard:** Страницы услуг обязаны иметь микроразметку `Product` / `AggregateOffer` (валюта RUB, `InStock`) и `BreadcrumbList`.

## ⚡ FAST RULES & FORMULAS
- Каноникал: `<link rel="canonical" href="${getTenantHost(tenantId)}${cleanPath}" />`.
- Schema Offer: `{"@type": "Offer", "price": "${priceRub}", "priceCurrency": "RUB", "availability": "https://schema.org/InStock"}`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Контент первого экрана доступен в исходном коде страницы (Ctrl+U) без выполнения JS?
- [ ] Указан ли Clean-param в robots.txt?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
