# LOVABLE REMOVAL & SMMFLUX CONSOLIDATION CHECKLIST

**Дата завершения:** 28 июля 2026  
**Статус:** ✅ COMPLETE  

---

### Сводная таблица проведенных работ

| Элемент / Компонент | До (Lovable) | После (SMMflux) | Статус |
| :--- | :--- | :--- | :---: |
| **Prisma SQL Migration** | `tenantId = 'lovable'` | `tenantId = 'flux'` в `User`, `Order`, `Ticket`, `Payment`, `Service` | ✅ Мигрировано |
| **Prisma Tenant Model** | `slug = 'lovable'` | Удалено из таблицы `Tenant` | ✅ Удалено |
| **SEO Helpers** | `getTenantHost('lovable') → 'lovable.pro'` | `getTenantHost('lovable') → 'smmflux.ru'` через `normalizeTenantId` | ✅ Консолидировано |
| **Root Layout** | `LOVABLE_APP_URL`, `LOVABLE_TELEGRAM_BOT` | Использование единых настроек `SMMflux` | ✅ Очищено |
| **301 Redirect /ab-lovable** | Отдельная страница A/B теста | `301 Permanent Redirect` на `/` в `next.config.mjs` | ✅ Настроено |
| **Middleware** | Запросы на `lovable.pro` | `301 Permanent Redirect` на `https://smmflux.ru` | ✅ Защищено |
| **Component: OrderClient** | `LovableOrderClient.tsx` | `FluxOrderClient.tsx` | ✅ Переименовано |
| **Component: FAQ** | `LovableFAQ.tsx` | `FluxFAQ.tsx` | ✅ Переименовано |
| **Component: Reviews** | `LovableReviews.tsx` | `FluxReviews.tsx` | ✅ Переименовано |
| **Component: TrustBar** | `LovableTrustBar.tsx` | `FluxTrustBar.tsx` | ✅ Переименовано |
| **Component: WhyUs** | `LovableWhyUs.tsx` | `FluxWhyUs.tsx` | ✅ Переименовано |
| **Component: DashboardHome** | `LovableDashboardHome.tsx` | `FluxDashboardHome.tsx` | ✅ Переименовано |
| **Login Page** | `isLovable` проверка параметров | `isFlux` проверка с ориентацией на `smmflux` | ✅ Обновлено |
| **Robots.txt** | `Disallow: /ab-lovable` | Удалены устаревшие запреты `ab-lovable` | ✅ Очищено |
| **Backward Compatibility** | `normalizeTenantId` | `case 'lovable': return 'smmflux'` (алиас старых сессий) | ✅ Сохранено |
