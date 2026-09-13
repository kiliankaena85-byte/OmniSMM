# multi-tenant-isolation-arch (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Tenant Where Clause:** Все запросы выборки и мутации к моделям категорий, услуг, заказов обязаны содержать `where: { tenantId }`.
2. **Tenant-Aware Cache:** Ключи в `unstable_cache` ОБЯЗАНЫ включать `tenantId` (например, `catalog-${tenantId}`).
3. **Запрет фантомных брендов:** Брендов `lovable` и `smmboost` НЕ существует. Допустимы только `smmplan` и `flux`.
4. **Абсолютные Canonical URL:** Canonical теги обязаны быть абсолютными через `absoluteCanonical(tenantId, path)`. Запрещен хардкод хостов.
5. **Глобальный переключатель сайтов:** Переключение между тенантами осуществляется через `<GlobalSiteSwitcher />` в шапке.

## ⚡ FAST RULES & FORMULAS
- Fallback тенанта: `tenantId || user?.tenantId || 'smmplan'`.
- Нормализация: `normalizeTenantId(raw) === 'flux'`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Содержит ли Prisma запрос `where: { tenantId }`?
- [ ] Включен ли `tenantId` в ключ кэша?

---
*Для полного дерева решений и премортема см. [SKILL.md](./SKILL.md) (L2 Deep).*\n