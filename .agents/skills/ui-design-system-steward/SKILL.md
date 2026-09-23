---
name: ui-design-system-steward
description: Хранитель дизайн-системы, семантических токенов Tailwind CSS 4, цветовой палитры и тем оформления (Light/Dark) в платформе OmniSMM 1.0.
---

# UI Design System Steward — Стандарт Дизайн-Системы OmniSMM 1.0

## 1. Назначение и Зона Ответственности
Скилл регламентирует стилизацию компонентов, типографику, палитры тем и использование Tailwind CSS 4.0.0.

## 2. Ключевые Инварианты
- Все цвета определяются в `src/app/globals.css` через директиву `@theme` и CSS-переменные.
- Запрещены утилитарные классы фиксированных цветов (`text-white`, `bg-slate-900`).
- Изоляция брендов: SMMplan (Classic API) использует строгую сине-нейтральную палитру; SMMflux (Radiant Aurora) — градиенты и неоновые акценты.

## 3. Дерево Решений (Decision Tree)
1. Если создается новый компонент:
   - Использовать `bg-background` для страницы, `bg-card` для контейнеров.
   - Использовать `border-border` для всех разделителей.
2. Если создается бейдж статуса:
   - Успех: `bg-emerald-500/10 text-emerald-500 border-emerald-500/20`.
   - Ошибка: `bg-destructive/10 text-destructive border-destructive/20`.
   - В ожидании: `bg-amber-500/10 text-amber-500 border-amber-500/20`.\n