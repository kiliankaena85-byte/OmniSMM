---
name: antigravity-widget-studio
description: Студия мгновенного прототипирования и генерации интерактивных UI-виджетов в Antigravity с Gemini Flash (Generative UI, agent-embed, Tailwind gstatic CDN, React 19 экспорт).
tags: [antigravity, generative-ui, interactive-widget, agent-embed, tailwind, gemini-flash, prototyping]
---

# antigravity-widget-studio — Antigravity Interactive Generative UI Studio

## 1. Концепция: Generative UI в чате Antigravity
Вместо долгого описания словами агент на базе **Gemini Flash** мгновенно генерирует работающий интерактивный прототип прямо в окне чата.

### 3-Шаговый пайплайн:
1. **[Interactive Prototype]** — Создание самодостаточного `.html` файла с инлайн-JS калькулятором, фильтрами или переключателями.
2. **[Live Embed]** — Отображение виджета в чате через тег `<agent-embed src="file:///..."></agent-embed>`.
3. **[React 19 Synthesis]** — Перевод утвержденного прототипа в продакшен-компонент Next.js 16.

---

## 2. Базовый шаблон интерактивного виджета
```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
</head>
<body class="bg-transparent text-[var(--foreground)] antialiased p-4">
  <div class="bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] rounded-xl p-5 shadow-sm max-w-md mx-auto">
    <div class="flex justify-between items-center mb-4">
      <h3 class="font-semibold text-base">Интерактивный калькулятор</h3>
      <span class="text-xs px-2 py-0.5 rounded bg-[var(--primary)] text-[var(--primary-foreground)]">Live</span>
    </div>
    <!-- Интерактивные элементы управления -->
    <div class="space-y-3">
      <input type="range" id="slider" min="100" max="10000" step="100" class="w-full accent-[var(--primary)]" />
      <div class="flex justify-between text-sm">
        <span class="text-[var(--muted-foreground)]">Объем заказа:</span>
        <span id="volume" class="font-semibold">1,000 шт</span>
      </div>
    </div>
  </div>
</body>
</html>
```
