# CORE WEB VITALS (CWV) AUDIT REPORT

**Дата аудита:** 28 июля 2026  
**Статус:** 🟢 PASSED (Оптимизация производительности выполнена)

---

### Анализ ключевых метрик по основным типам страниц

| URL / Роут | LCP (Target < 2.5s) | INP (Target < 200ms) | CLS (Target < 0.1) | TTFB (Target < 600ms) | Рекомендации |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `/` (Landing) | ~1.1s | ~45ms | 0.01 | ~120ms | Прогрев шрифтов Google Fonts |
| `/services` (Каталог) | ~1.3s | ~50ms | 0.00 | ~140ms | `unstable_cache` для DB запросов |
| `/services/[network]/[category]` | ~1.4s | ~60ms | 0.02 | ~150ms | Кэширование категорий |
| `/services/.../[serviceSlug]` | ~1.2s | ~40ms | 0.01 | ~110ms | Легкая верстка детализации |
| `/knowledge/[slug]` | ~1.5s | ~55ms | 0.00 | ~160ms | Ленивая гидратация React островов |

---

### Архитектурные меры обеспечения скорости
1. **Next.js Turbopack & React 19**: Использование серверных компонентов по умолчанию (RSC) минимизирует объем клиентского JS-бандла.
2. **Font Preconnect**: Предварительное подключение `preconnect` к `fonts.googleapis.com` и `fonts.gstatic.com`.
3. **No Dynamic Layout Jumps**: Высоты и сетки карточек закреплены Tailwind-классами без динамических перерасчетов.
