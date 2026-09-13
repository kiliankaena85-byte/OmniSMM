---
name: mobile-cro-interaction
description: Стандарты мобильной конверсии (CRO), тач-интерфейсов, степперов и чекаут-визардов для платформ OmniSMM 1.0.
tags: [mobile-cro, wizard, touch-ergonomics, scroll-jump-guard, safe-focus, omnismm]
---

# Mobile CRO & Touch Interaction Standard (OmniSMM 1.0)

## 1. Назначение
Максимизация конверсии мобильного трафика (75%+ пользователей платформы OmniSMM), исключение случайных мисскликов, предотвращение сбоев скролла на WebKit/Blink и обеспечение предсказуемого чекаута.

---

## 2. Антипаттерны и Инварианты мобильного чекаута

### 2.1. Защита от подпрыгивания страницы (Scroll-Jumping Guard)
- **Запрет сырого `focus()` и `select()`:**
  - ❌ **СБОЙ:** `target.select()` или `element.focus()` без `preventScroll: true` вызывают мгновенный сброс скролла на iOS Safari / Chrome.
  - ✅ **ПРАВИЛЬНО:** Выделение текста (`select()`) разрешено СТРОГО на устройствах с точным указателем:
    ```ts
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
      e.currentTarget.select();
    }
    ```
  - ✅ Для фокуса инпутов использовать утилиту `safeFocus(element)` (`preventScroll: true`):
    ```ts
    import { safeFocus } from "@/utils/scroll-helpers";
    // ...
    safeFocus(urlInput);
    ```

### 2.2. Идемпотентность переходов в визарде (Step Transition Guard)
- **Идемпотентный охранник:** переключение шагов обязано проверять `if (step === prevStepRef.current) return;`.
- Повторный выбор сервиса или реактивная синхронизация формы на текущем шаге НЕ должны вызывать повторный скролл к началу секции.
- **Typing Guard:** если фокус находится в `INPUT`, `TEXTAREA` или интерактивном элементе формы, автоскролл блокируется:
  ```ts
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
  if (activeEl && activeEl.closest('#catalog-section') && (activeEl.tagName === 'BUTTON' || activeEl.tagName === 'INPUT')) return;
  ```
- **Очистка таймеров скролла:** таймеры скролла (`setTimeout`) обязаны сохраняться в `useRef` и сбрасываться через `clearTimeout` перед установкой нового таймера, исключая накопление очереди скроллов при быстрых тапах:
  ```ts
  if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
  scrollTimerRef.current = setTimeout(() => scrollToStep(step), 120);
  ```

### 2.3. Эргономика тача и Touch Targets (WCAG 2.2 Level AA $\ge 44\text{px}$)
- Любой интерактивный элемент (включая ссылки «Изменить», кнопки «+ Есть промокод?», «Показать все») ОБЯЗАН иметь физическую область клика $\ge 44 \times 44\text{px}$:
  ```tsx
  // ✅ Текстовая кнопка с полноценной touch-зоной
  <button className="text-[11px] font-bold text-primary min-h-[44px] min-w-[44px] px-2 flex items-center">
    Изменить
  </button>
  ```
- Запрещено использовать чисто текстовые микро-кнопки без внутренних отступов и минимальной высоты.

### 2.4. Плотность на узких экранах (320px Floor / iPhone SE)
- Текстовые метки на основных CTA кнопках («Оплатить...») должны оборачиваться в `<span className="truncate">`, а сопутствующие иконки обязаны иметь `shrink-0`.
- Тексты должны быть емкими (например, «Оплатить СБП / Картой» вместо длинных конструкций), предотвращая перенос строки и непреднамеренное увеличение высоты кнопки.

### 2.5. Чистота HTML & ARIA в динамических формах
- Запрещено создавать в DOM несколько элементов с одинаковым `id` для сообщений валидации (например, `id="*-url-error"`).
- Несколько условий ошибок объединяются в единый элемент:
  ```tsx
  {(validationErrors?.link || localUrlError) && (
    <p id="mobile-step1-url-error" role="alert" aria-live="assertive" className="text-[11px] font-bold text-danger pl-1 animate-pulse">
      {validationErrors?.link || localUrlError}
    </p>
  )}
  ```