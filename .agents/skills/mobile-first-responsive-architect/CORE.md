# CORE: mobile-first-responsive-architect (Mobile & Touch Standard)
1. **Mobile-First (320–390px):** Стили по умолчанию строятся для смартфона (`w-full flex-col`). Брейкпоинты (`sm:`, `md:`, `lg:`) — только для прогрессивного расширения.
2. **Touch Target Floor:** Минимальная область клика интерактивных элементов $\ge 44 \times 44\text{px}$ (WCAG 2.2 AA). Зазор между кнопками $\ge 8\text{px}$.
3. **Safe Area Insets:** Нижние фиксированные панели обязаны включать `pb-[calc(1rem+env(safe-area-inset-bottom,0px))]` или `pb-safe`.
4. **Dynamic Viewport:** Запрещен `100vh`. Использовать строго `100dvh` / `min-h-dvh` для защиты от прыжков адресной строки Safari/Chrome.
5. **iOS Auto-Zoom Guard:** Шрифты в `<input>`, `<select>`, `<textarea>` строго $\ge 16\text{px}$ на мобилке (`text-base sm:text-sm`).
6. **Thumb Zone:** Главные CTA-кнопки оформляются в нижней трети экрана. Таблицы на мобилке сворачиваются в карточки (`block md:table`).
