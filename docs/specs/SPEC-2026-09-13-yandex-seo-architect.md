# SPEC-2026-09-13: Yandex SEO & Search Engine Architecture

## 1. Metadata
- **Status:** APPROVED
- **Author:** Fullstack Architect & Search Engineering Lead
- **Risk-Tier:** Tier 2 (Standard Architectural Skill)
- **Target Stack:** Next.js 16 (App Router), SSR, Yandex.Webmaster, Schema.org, robots.txt, sitemap.xml

---

## 2. Problem Statement & Motivation
В русскоязычном сегменте интернета поисковая система Яндекс обеспечивает более 70% коммерческого органического трафика.
Алгоритмы Яндекса (Y1, YATI, фильтры Баден-Баден, Мимикрия, оценка ИКС, поведенческие и коммерческие факторы ранжирования) имеют глубокие отличия от Google.
Ошибки в SSR, отсутствие специфических директив Яндекса (`Clean-param`), некорректные canonical-теги или переспам текстов приводят к мгновенной пессимизации сайта в выдаче Яндекса.

Скилл `yandex-seo-search-architect` фиксирует единый норматив поисковой оптимизации платформы OmniSMM 1.0 под требования Яндекса.

---

## 3. Core Architectural Invariants

### 3.1. SSR First for YandexBot
- Весь индексируемый контент каталога, цен, категорий и описаний обязан рендериться на сервере (Server Components / SSR) в начальном HTML.
- ❌ **ЗАПРЕЩЕНО** отдавать пустые контейнеры, ожидающие рендеринга на клиенте через `useEffect`.

### 3.2. Clean-param & Robots.txt Invariant
- Файл `robots.txt` обязан содержать директиву `Clean-param` для отсечения дублей страниц с UTM-метками и сессионными токенами:
  `Clean-param: utm_source&utm_medium&utm_campaign&token /`.
- Обязательно указание корректной ссылки на `Sitemap: https://<domain>/sitemap.xml`.

### 3.3. Absolute Canonical Invariant
- Канонический тег обязан быть строго абсолютным и динамически учитывать домен тенанта (`smmplan.pro` или `smmflux.ru`).
- ❌ **ЗАПРЕЩЕНО** указывать относительные canonical (`/services`) или каноникалы с query-параметрами.

### 3.4. Rich Snippets & Schema.org (JSON-LD)
- Каждая страница услуги обязана содержать разметку `Product` и `AggregateOffer` (валюта `RUB`, статус `InStock`, цена за 1 шт.).
- Страницы сайта обязаны содержать навигационную цепочку `BreadcrumbList` и блок частых вопросов `FAQPage`.

### 3.5. Защита от фильтров «Баден-Баден» и «Мимикрия»
- Плотность вхождения ключевых слов в текстах строго < 2.5%.
- Полный отказ от серых методов накрутки поведенческих факторов. Фокус на реальный UX: скорость первого байта (TTFB < 200ms) и низкий показатель отказов (Bounce Rate).

---

## 4. Verification & Testing Strategy
- Unit-тесты контрактов в `src/__tests__/skills/yandex-seo-search-architect.test.ts`.
- Тесты маршрутизации через JIT Router `routeSkillIntent` по запросам «ceo», «seo», «яндекс поиск».
- Проверка типов `tsc --noEmit`, аудит секретов и валидация пакета.
