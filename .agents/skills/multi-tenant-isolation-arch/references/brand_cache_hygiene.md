# Brand Cache Hygiene — Защита от Brand Bleeding и Brand Ghosting

> **Стандарт:** OmniSMM 1.0 Design & Cache Isolation  
> **Инварианты:** Zero Brand Bleeding, Zero Brand Ghosting.

---

## 1. Brand Bleeding (Протекание бренда через кэш)

### Симптом
Пользователь заходит на витрину инвестора `investor-smm.com` и видит оптовые цены или логотип `smmplan.pro`.

### Корневая причина
Использование общего ключа кэширования в `unstable_cache` или общего ключа в Redis:
```typescript
// ❌ ОШИБКА:
unstable_cache(fetchCatalog, ['catalog-all']); // Кэш прогревается первым попавшимся тенантом!
```

### Защитный шаблон
Всегда интерполировать `tenantId` в ключ и теги:
```typescript
// ✅ ПРАВИЛЬНО:
export const getCatalogForTenant = (tenantId: string) => {
  return unstable_cache(
    async () => fetchServicesForTenant(tenantId),
    ['catalog-services', tenantId], // Изолированный ключ
    {
      revalidate: 600,
      tags: [`catalog-${tenantId}`]   // Точечная инвалидация
    }
  )();
};
```

---

## 2. Brand Ghosting (Фантомные бренды)

### Инвариант
В кодовой базе платформы OmniSMM 1.0 **НЕ СУЩЕСТВУЕТ** брендов `Lovable` или `SMMboost`.
- Любое использование строк `'lovable'` или `'smmboost'` в UI, метаданных SEO (title, description, canonical) или тестах расценивается как дефект Brand Ghosting.
- В `src/lib/tenant-resolver-edge.ts` сохранен единственный алиас обратной совместимости: `clean === 'lovable' ? 'flux' : clean` для перенаправления устаревших ссылок. Во всех остальных местах используется канонический бренд `flux` или динамический `tenantId`.
