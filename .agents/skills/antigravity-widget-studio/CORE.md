# antigravity-widget-studio (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Instant Chat Preview First:** Прототипы и интерактивные виджеты создаются в формате self-contained HTML с тегом <agent-embed> для мгновенной оценки в чате.
2. **Google gstatic CDN Only:** Внешние CDN скрипты запрещены CSP. Разрешен строго https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js.
3. **Theme CSS Variables:** Запрещен хардкод темной/светлой темы. Виджет обязан использовать семантические переменные var(--background), var(--card), var(--foreground), var(--primary).
4. **Transparent Root in Chat:** При встраивании в чат корневой body обязан иметь класс bg-transparent.
5. **Seamless React 19 Export:** Любой одобренный пользователем HTML-виджет обязан компилироваться в чистый React 19 компонент с типизированными пропсами.

## ⚡ FAST RULES & FORMULAS
- Базовый шаблон: `<div class="bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] rounded-xl p-5 shadow-sm">`.
- Встраивание: `<agent-embed src="file:///<path>/widget.html"></agent-embed>`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Подключен ли gstatic CDN скрипт в head?
- [ ] Проверена ли читаемость виджета в темной и светлой теме?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
