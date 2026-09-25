---
name: client-hydration-perf-guard
description: Используй этот скилл ВСЕГДА, когда Инженерный стандарт контроля
  гидратации React 19 / Next.js 16 (Zero Hydration Mismatch), предотвращения
  сдвигов макета (Cumulative Layout Shift CLS < 0.05) и изоляции SSR. НЕ
  применять для серверных очередей BullMQ или DDL миграций базы данных.
metadata:
  tags:
    - react-19
    - nextjs-16
    - hydration
    - cls-zero
    - suspense
    - skeletons
    - svg-guard
    - ssr-isolation
---

# Client Hydration & Layout Stability Engineering Standard

## 1. Концепция и Назначение
В Next.js 16 App Router с потоковым серверным рендерингом (Streaming SSR) и React 19 нестабильная разметка приводит к двум фатальным проблемам:
1. **Hydration Mismatch:** Разрыв согласованности между HTML сервера и DOM клиента, вызывающий сброс локального стейта, мерцание и краш приложения.
2. **Cumulative Layout Shift (CLS):** Сдвиг элементов страницы в момент подгрузки асинхронных данных, раздражающий пользователя и роняющий Core Web Vitals в Google Search и Яндекс.

---

## 2. Инварианты стабильности геометрии (Zero CLS Architecture)

### 2.1. Резервирование высоты для Suspense и Скелетонов
Скелетон загрузки обязан иметь точно такие же геометрические размеры (высоту и ширину), как и финальный отрендеренный компонент:
```tsx
// ❌ СБОЙ: сдвиг макета (CLS) — скелетон 40px, а контент 240px
<Suspense fallback={<div className="h-10 animate-pulse bg-muted rounded-xl" />}>
  <OrderMetricsCards /> {/* Высота 240px */}
</Suspense>

// ✅ ПРАВИЛЬНО: строгое резервирование высоты
<Suspense fallback={<div className="min-h-[240px] w-full rounded-2xl bg-muted/40 animate-pulse border border-border" />}>
  <OrderMetricsCards />
</Suspense>
```

### 2.2. Фиксированные соотношения сторон (Aspect Ratios)
Все динамические изображения, медиа-контейнеры и превью обязаны содержать класс соотношения сторон:
```tsx
// ✅ Защита от сдвига при медленной загрузке баннера
<div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-muted">
  <Image src={bannerUrl} alt="Promo" fill className="object-cover" />
</div>
```

---

## 3. Инварианты гидратации React 19 (Zero Hydration Mismatch)

### 3.1. Изоляция дат и клиентского времени
Серверный рендер в Node.js выполняется в UTC, тогда как браузер пользователя рендерит локальную таймзону (например, UTC+3 Москва). Прямой рендер `new Date().toLocaleString()` гарантирует ошибку гидратации:
```tsx
// ❌ СБОЙ: сервер и клиент отображают разные строки
<span>{new Date(order.createdAt).toLocaleDateString()}</span>

// ✅ ПРАВИЛЬНО: подавление ворнинга для форматированных дат
<span suppressHydrationWarning>
  {formatDate(order.createdAt)}
</span>
```

### 3.2. HTML5 Strict Nesting Guard
React 19 жестко наказывает за невалидную спецификацию HTML5. Браузер автоматически "чинит" невалидный DOM до того, как React завершит гидратацию:
* ❌ `<button>` внутри `<button>` $\to$ клики блокируются, гидратация ломается.
* ❌ `<p>` внутри `<p>` $\to$ внешний параграф немедленно самозакрывается браузером.
* ❌ `<a>` внутри `<a>` $\to$ краш перехода по ссылкам.
* ✅ Для сложных кликабельных карточек со вложенными кнопками используется паттерн `asChild` или `div role="group"`.

### 3.3. Уникальность SVG-градиентов и Clip-Path (Collision Guard)
Если в нескольких SVG-иконках или чартах используется одинаковый `id="gradient"` или `id="clip"`, браузер связывает их с первым попавшимся элементом DOM, вызывая визуальное искажение цветов:
```tsx
// ✅ ПРАВИЛЬНО: уникальные префиксы через React useId()
export function ChartGradient() {
  const id = useId();
  return (
    <svg>
      <defs>
        <linearGradient id={`grad-${id}`}>...</linearGradient>
      </defs>
    </svg>
  );
}
```

---

## 4. Чеклист приемки Client Hydration
1. [ ] В консоли разработчика браузера 0 ошибок `Hydration failed because the initial UI does not match`.
2. [ ] Показатель CLS $\le 0.05$ при первой загрузке страниц.
3. [ ] Скелетоны `Suspense` имеют `min-h-*`, соответствующий высоте контента.
4. [ ] Локальные даты содержат `suppressHydrationWarning`.
5. [ ] В коде отсутствуют `<button>` внутри `<button>` и `<p>` внутри `<p>`.

---

## Пошаговый алгоритм выполнения (Step-by-step Protocol)
1. **Шаг 1:** Анализ контекста задачи и определение границ влияния.
2. **Шаг 2:** Проверка соответствия архитектурным инвариантам.
3. **Шаг 3:** Реализация изменений с соблюдением контрактов.
4. **Шаг 4:** Верификация через автоматические тесты и линтеры.
5. **Шаг 5:** Документирование и сохранение точки стабильности.
