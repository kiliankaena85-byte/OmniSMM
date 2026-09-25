---
name: mobile-first-responsive-architect
description: Используй этот скилл ВСЕГДА, когда Архитектурный норматив
  Mobile-First разработки, проектирования сначала под смартфоны, адаптации под
  десктоп, Touch Ergonomics, Safe Area Insets и защиты от багов мобильных
  браузеров. НЕ применять для DDL миграций базы данных или настройки BullMQ.
metadata:
  tags:
    - mobile-first
    - responsive
    - tailwind-4
    - touch-target
    - safe-area
    - dvh
    - thumb-zone
    - ios-safari
---

# mobile-first-responsive-architect — Mobile-First Responsive Engineering Standard

## 1. Концепция: Mobile-First Mental Model
В платформе OmniSMM 1.0 **мобильный пользователь является приоритетным (Tier-1 First Citizen)**. Более 75% заказов и переходов оформляются со смартфонов через Telegram WebApp, мобильный Safari и Chrome.

### Фундаментальный принцип:
- Любой компонент верстается **СНАЧАЛА для узкого экрана смартфона (320–390px)**.
- Никаких стилей по умолчанию для десктопа! Базовые утилиты Tailwind пишутся без префиксов: `w-full flex-col gap-2 p-3 text-base`.
- Префиксы брейкпоинтов добавляются **только для прогрессивного расширения**:
  - `sm:` (640px+) — горизонтальный режим смартфона и мини-планшеты.
  - `md:` (768px+) — планшеты (iPad), двухколоночные макеты, появление классических таблиц.
  - `lg:` (1024px+) — ноутбуки, появление полноценного сайдбара, 3-колоночные сетки.
  - `xl:` (1280px+) — широкоформатные мониторы, 4-колоночные сетки.

---

## 2. Мобильные инварианты и решения частых багов

### 2.1. Единицы высоты: Замена `100vh` на `100dvh`
На мобильных устройствах адресная строка браузера сворачивается и разворачивается при скролле. Фиксированный `100vh` рассчитывается без учета адресной строки, из-за чего кнопки внизу экрана обрезаются.
```tsx
// ❌ СБОЙ: обрезается на iOS Safari
<div className="h-screen flex flex-col justify-between">...</div>

// ✅ ПРАВИЛЬНО: динамическая высота экрана
<div className="min-h-dvh flex flex-col justify-between">...</div>
```

### 2.2. Защита от системных панелей (Safe Area Insets)
Экраны iPhone с вырезами Dynamic Island и нижней полосой жестов (Home Indicator), а также Android-жесты требуют обязательного отступа:
```tsx
// В globals.css или inline utility
<div className="fixed bottom-0 inset-x-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] bg-background/90 backdrop-blur border-t border-border z-40 md:static md:p-0 md:border-0">
  <button className="h-12 w-full rounded-xl bg-primary text-primary-foreground font-semibold md:h-10 md:w-auto">
    Оформить заказ
  </button>
</div>
```

### 2.3. Защита от авто-зума на iOS — iOS Auto-Zoom Guard (Input Font Floor $\ge 16\text{px}$)
Если инпут имеет размер шрифта менее 16px, iOS Safari автоматически приближает всю страницу при фокусе, ломая центрирование и навигацию:
```tsx
// ❌ СБОЙ: iOS принудительно приближает экран на 150%
<input className="text-xs h-8 px-2" />

// ✅ ПРАВИЛЬНО: 16px на мобилке, компактный 14px на планшетах/десктопе
<input className="text-base md:text-sm h-11 md:h-9 px-3 rounded-lg border border-border" />
```

### 2.4. Защита от залипания ховеров (:hover sticky bug)
На сенсорных экранах ховер срабатывает при тапе и остается залипшим до тапа в другое место.
```tsx
// ❌ СБОЙ: карточка остается вечно подсвеченной после тапа
<div className="hover:bg-primary/20 hover:scale-105 transition-transform">...</div>

// ✅ ПРАВИЛЬНО: ховер активен только на десктопе с мышью
<div className="active:scale-[0.98] md:hover:bg-primary/10 md:hover:scale-[1.01] transition-all">...</div>
```

### 2.5. Эргономика касания (WCAG 2.2 Level AA Touch Target $\ge 44\text{px}$)
По стандарту WCAG 2.2 (Success Criterion 2.5.8 Target Size) и рекомендациям Apple HIG / Google Material:
- Минимальный физический размер кликабельной области кнопки, иконки или таба на сенсорном экране обязан быть **не менее $44 \times 44\text{px}$** (допускается видимый значок $16$–$20\text{px}$ с внутренними отступами `p-2.5` или `h-11 w-11 flex items-center justify-center`).
- Зазор между центрами соседних интерактивных элементов — **не менее $8\text{px}$**, предотвращая ошибочные случайные тапы.
```tsx
// ❌ СБОЙ: микро-кнопка 24x24px, сложно попасть пальцем
<button className="h-6 w-6 p-0.5 rounded"><TrashIcon className="w-4 h-4 shrink-0" /></button>

// ✅ ПРАВИЛЬНО: видимая компактность, но область тапа 44x44px
<button className="h-11 w-11 flex items-center justify-center rounded-lg active:bg-accent md:h-8 md:w-8">
  <TrashIcon className="w-4 h-4 shrink-0" />
</button>
```

### 2.6. Защита от GPU Containing Block Glitch (`will-change-transform`)
- ❌ **СБОЙ:** Добавление `will-change-transform` на родительские контейнеры страниц или секций каталога изолирует координаты для движка WebKit (iOS Safari). В результате системные скроллы и `getBoundingClientRect()` рассчитываются со смещением, подбрасывая страницу вверх при фокусе инпутов.
- ✅ **ПРАВИЛЬНО:** Использовать `will-change-transform` только точечно на конкретных микро-элементах с непрерывной анимацией, но никогда на структурных блоках или обертках форм.

### 2.7. Защита от Shimmer/Glow Overflow
- Элементы со сложными анимациями свечения (`google-border-shimmer`, `blur-md`, отрицательные inset) могут невидимо выходить за пределы экрана и вызывать горизонтальный скролл на мобильных устройствах.
- Корневые мобильные контейнеры обязаны иметь класс `overflow-x-hidden`.

### 2.8. Валидация токенов Tailwind CSS 4 и типографика
- ❌ **СБОЙ:** Использование фиктивных классов (например, `py-0.2`, `scale-98`) игнорируется компилятором Tailwind 4, приводя к нулевым отступам.
- ✅ **ПРАВИЛЬНО:** Использовать стандартные шаги шкалы (`py-0.5`, `py-1`) или явный синтаксис произвольных значений: `active:scale-[0.98]`.
- ❌ **Минимальный порог шрифта:** Текст смыслового интерфейса менее 10px (`text-[9px]`, `text-[8px]`) запрещен для читаемости по стандарту WCAG 1.4.3.

---

## 3. Thumb Zone Architecture (Эргономика одной руки)

Большинство пользователей держат смартфон одной рукой. Зона комфортного доступа большого пальца — это **нижняя половина экрана**.
- **Нижняя треть (Easy Zone):** Главная кнопка действия (CTA), табы навигации, кнопки выбора объема и степперы.
- **Средняя треть (Reach Zone):** Основной контент, карточки услуг, поля формы.
- **Верхняя треть (Hard Zone):** Вспомогательная информация, статус заказа, переключатель темы, аватар.

### Паттерн: Mobile Card Stack -> Desktop Compact Table
Таблицы со множеством колонок не помещаются на узких экранах. Правильный подход — полиморфный рендеринг:
```tsx
export function OrdersFeed({ orders }: { orders: Order[] }) {
  return (
    <>
      {/* 📱 Мобильный вид: Вертикальный стек карточек */}
      <div className="flex flex-col gap-3 md:hidden">
        {orders.map((order) => (
          <div key={order.id} className="p-3.5 rounded-xl bg-card border border-border flex flex-col gap-2">
            <div className="flex justify-between items-center text-sm font-semibold">
              <span>#{order.id}</span>
              <StatusBadge status={order.status} />
            </div>
            <div className="text-xs text-muted-foreground">{order.serviceName}</div>
            <div className="flex justify-between items-center pt-2 border-t border-border/50 text-sm">
              <span className="font-medium">{order.costRub} ₽</span>
              <button className="h-8 px-3 rounded-lg bg-secondary text-xs">Детали</button>
            </div>
          </div>
        ))}
      </div>

      {/* 💻 Десктопный вид: Компактная плотная таблица */}
      <div className="hidden md:block w-full overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Услуга</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2 text-right">Сумма</th>
              <th className="px-3 py-2 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-mono">#{order.id}</td>
                <td className="px-3 py-2 truncate max-w-[200px]">{order.serviceName}</td>
                <td className="px-3 py-2"><StatusBadge status={order.status} /></td>
                <td className="px-3 py-2 text-right font-medium">{order.costRub} ₽</td>
                <td className="px-3 py-2 text-right"><button className="h-7 px-2.5 rounded bg-secondary">Инфо</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
```

---

## 4. Чеклист приемки Mobile-First верстки
1. [ ] Базовые стили написаны без медиа-префиксов для экрана 360px.
2. [ ] Полное отсутствие горизонтального скролла на всем экране (`overflow-x-hidden` на корне).
3. [ ] Все интерактивные элементы $ge 44	ext{px} 	imes 44	ext{px}$.
4. [ ] Поля ввода имеют `text-base` (16px) на мобильных экранах для предотвращения зума iOS.
5. [ ] Нижние прилипающие панели имеют отступ под Home Indicator (`safe-area-inset-bottom`).
6. [ ] Экраны используют динамическую высоту `min-h-dvh` вместо `100vh`.
7. [ ] Ховер-эффекты экранированы префиксом `md:hover:` или медиа-запросом.
8. [ ] Отсутствие `will-change-transform` на родительских скролл-контейнерах (защита от WebKit GPU glitch).
9. [ ] Программный фокус инпутов выполняется строго через `safeFocus` (без прыжков страницы).
10. [ ] Классы Tailwind CSS 4 валидны, размер шрифтов смыслового контента $\ge 10\text{px}$.

---

## Пошаговый алгоритм выполнения (Step-by-step Protocol)
1. **Шаг 1:** Анализ контекста задачи и определение границ влияния.
2. **Шаг 2:** Проверка соответствия архитектурным инвариантам.
3. **Шаг 3:** Реализация изменений с соблюдением контрактов.
4. **Шаг 4:** Верификация через автоматические тесты и линтеры.
5. **Шаг 5:** Документирование и сохранение точки стабильности.
