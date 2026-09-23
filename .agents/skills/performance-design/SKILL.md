---
name: performance-design
description: "Core Web Vitals → дизайн-решения: LCP, FID, CLS оптимизация через дизайн. 57% уходят если >3с загрузки. Активировать при оптимизации производительности, при влиянии дизайна на скорость, при Core Web Vitals. ALWAYS activate for performance optimization, Core Web Vitals, when design decisions impact loading speed, LCP/FID/CLS. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Performance → Design — дизайн для скорости

## When to activate

- Дизайн-решения влияют на скорость загрузки
- Нужно оптимизировать Core Web Vitals
- Пользователь жалуется на медленную загрузку
- Проектируется image-heavy страница
- LCP > 2.5s или CLS > 0.1

## Core Web Vitals → Дизайн-решения

### LCP (Largest Contentful Paint) — цель < 2.5s

**Дизайн-решения:**
- Hero image: WebP/AVIF + lazy loading для non-hero
- Above the fold: минимальный CSS, критический путь
- Font loading: font-display: swap, preload critical fonts
- Server-side rendering для первого экрана

### FID / INP (Interaction) — цель < 100ms

**Дизайн-решения:**
- Минимизировать JavaScript для interactive elements
- Skeleton screens вместо loading spinners
- Progressive enhancement: базовый HTML работает без JS
- Defer non-critical scripts

### CLS (Cumulative Layout Shift) — цель < 0.1

**Дизайн-решения:**
- Explicit dimensions для images и embeds (width + height)
- Font fallback с matching metrics (size-adjust)
- Placeholder space для dynamic content
- Avoid layout shifts от late-loading elements

## Performance Budget по типу страницы

| Тип страницы | LCP | CLS | JS Budget | Image Budget |
|-------------|-----|-----|-----------|-------------|
| Landing page | < 2.0s | < 0.05 | < 100KB | < 200KB |
| Dashboard | < 2.5s | < 0.1 | < 300KB | < 100KB |
| Blog / Editorial | < 1.5s | < 0.05 | < 50KB | < 150KB |
| E-commerce | < 2.0s | < 0.05 | < 200KB | < 300KB |

## Анти-паттерны Performance

- Hero video autoplay (LCP killer)
- Unoptimized hero images (no WebP, no lazy loading)
- Custom fonts without fallback (FOUT/FOIT)
- Client-side rendering для критического контента
- Third-party scripts в critical path

## Step-by-step execution protocol

1. **Measure current**: Запустить Lighthouse / Web Vitals measurement
2. **Identify bottlenecks**: Найти элементы с наибольшим влиянием на LCP/FID/CLS
3. **Set budgets**: Определить performance budgets по типу страницы
4. **Optimize LCP**: Критический путь, hero image, fonts, SSR
5. **Optimize CLS**: Explicit dimensions, font fallbacks, placeholders
6. **Optimize FID**: Reduce JS, skeleton screens, progressive enhancement
7. **Implement budget**: Добавить performance monitoring
8. **Re-measure**: Сравнить до/после, итерировать

## Scope boundaries

### DOES
- Оптимизировать Core Web Vitals через дизайн-решения
- Устанавливать performance budgets
- Идентифицировать дизайн-анти-паттерны, убивающие скорость
- Интегрировать performance в дизайн-процесс

### DOES NOT
- Заменять backend optimization (CDN, caching, server response)
- Настраивать Webpack / Vite bundling
- Оптимизировать базу данных
- Проводить load testing

## Error handling

| Scenario | Response |
|----------|----------|
| Дизайн требует тяжёлые изображения | Предложить progressive loading, WebP/AVIF, CDN |
| Клиент хочет video hero | Предложить альтернативы: cinemagraph, CSS animation, poster image |
| Performance budget превышен | Приоритизировать: LCP > CLS > FID, убрать non-critical |
| Third-party script тормозит | Предложить lazy load или async для non-critical скриптов |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)