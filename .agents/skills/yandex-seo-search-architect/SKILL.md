---
name: yandex-seo-search-architect
description: Архитектурный норматив SEO-оптимизации под поисковую систему Яндекс, алгоритмы ранжирования (Y1, YATI, Баден-Баден), Яндекс.Вебмастер, ИКС, микроразметку Schema.org и поведенческие факторы.
tags: [yandex, seo, yandex-webmaster, schema-org, robots-txt, canonical, rich-snippets, baden-baden, iks]
---

# yandex-seo-search-architect — Yandex Search Engine Optimization & Architecture

## 1. Концепция: Специфика поисковой оптимизации Яндекса
Поисковая система Яндекс обладает собственной экосистемой алгоритмов ранжирования, где ключевую роль играют:
- **Поведенческие факторы (ПФ):** время на сайте, глубина просмотра, отсутствие быстрого возврата в выдачу (Last Click / Решение проблемы).
- **Коммерческие факторы:** прозрачные цены за 1 штуку в рублях, наличие реквизитов (ИНН/ОГРН), онлайн-консультант, контакты, 152-ФЗ.
- **Индекс качества сайта (ИКС):** показатель масштаба аудитории, доверия и востребованности сервиса.
- **Нейросетевые алгоритмы (Y1 / YATI):** понимание смыслового контекста запроса и смысловая близость (LSI-копирайтинг).

---

## 2. Технические инварианты для робота YandexBot

### 2.1. SSR First (Server-Side Rendering в Next.js 16)
Хотя современный YandexBot умеет выполнять JavaScript, он делает это в отложенной очереди (Render Queue), что может задерживать индексацию новых услуг на недели.
```tsx
// ✅ ПРАВИЛЬНО: данные каталога рендерятся в Server Component
export default async function ServiceCatalogPage({ params }: PageProps) {
  const services = await getCachedCatalog(params.tenantId);
  return <ServiceCatalogView services={services} />;
}
```

### 2.2. Настройка `robots.txt` с директивой `Clean-param`
Яндекс поддерживает уникальную директиву `Clean-param`, которая предотвращает повторный обход страниц с техническими GET-параметрами:
```txt
User-agent: Yandex
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /dashboard/
Clean-param: utm_source&utm_medium&utm_campaign&ref&token /
Sitemap: https://smmplan.pro/sitemap.xml
```

### 2.3. Абсолютный Canonical Invariant
```tsx
export function generateMetadata({ params }): Metadata {
  const canonicalUrl = absoluteCanonical(params.tenantId, '/services/telegram');
  return {
    alternates: {
      canonical: canonicalUrl,
    },
  };
}
```

---

## 3. Микроразметка Schema.org (JSON-LD) для богатых сниппетов

### 3.1. Разметка услуги и цены (`Product` + `AggregateOffer`)
```tsx
export function ServiceJsonLd({ service, tenantId }: { service: Service; tenantId: string }) {
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: service.name,
    description: service.description,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'RUB',
      lowPrice: (service.pricePerUnitKopecks / 100).toFixed(2),
      price: (service.pricePerUnitKopecks / 100).toFixed(2),
      offerCount: '1',
      availability: 'https://schema.org/InStock',
      url: absoluteCanonical(tenantId, `/services/${service.slug}`),
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
    />
  );
}
```

### 3.2. Хлебные крошки (`BreadcrumbList`)
Формируют аккуратную кликабельную цепочку страниц прямо в поисковой строке Яндекса.

---

## 4. Защита от санкций и фильтров Яндекса

1. **Фильтр «Баден-Баден»:**
   - Избегать искусственных «портянок» текста с перечислением ключей.
   - Плотность каждого ключевого слова < 2.5%.
   - Заменять длинные тексты на емкие таблицы параметров услуги (скорость запуска, гарантия, качество).
2. **Фильтр «Мимикрия»:**
   - Полная визуальная и брендовая изоляция между тенантами SMMplan и SMMflux. Запрет клонирования идентичных фавиконок, логотипов и текстов оферты.
3. **Бан за накрутку поведенческих факторов:**
   - Никаких серых клик-ботов на сайт из поисковой выдачи. Яндекс детектирует бот-фермы с вероятностью 99% и накладывает бан на 8–12 месяцев.
