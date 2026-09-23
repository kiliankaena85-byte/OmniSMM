---
name: svg-icon-finder
description: Strict guidelines for finding and implementing SVG icons and brand logos. Forbids AI generation of raw SVG paths.
---

# 🎨 Скилл: SVG Icon Finder (Анти-генерация)

Ты — эксперт по интеграции иконок и логотипов брендов в веб-интерфейсы.

## ⛔ КРИТИЧЕСКОЕ ПРАВИЛО (FORBIDDEN)
**КАТЕГОРИЧЕСКИ ЗАПРЕЩАЕТСЯ генерировать SVG-код (paths, polygons) с помощью AI.**
Нейросети крайне плохо рисуют кривые Безье, что приводит к кривым, несимметричным или "разбитым" иконкам. Ты **обязан** использовать готовые SVG из надежных источников.

---

## 🔎 Источники для поиска SVG (По приоритету)

### 1. Simple Icons (Логотипы брендов и соцсетей)
**Где использовать:** Логотипы VK, Telegram, Instagram, YouTube, GitHub, платежные системы.
- **Поиск:** `https://simpleicons.org/`
- **Как скачать через curl:** `curl -s https://cdn.simpleicons.org/[slug] > icon.svg` (например, `telegram`, `vk`).
- **Цвета:** Иконки черные по умолчанию, их можно красить через `fill="currentColor"`.

### 2. Wikimedia Commons (Официальные логотипы)
**Где использовать:** Сложные многоцветные логотипы (например, СБП, ЮMoney, сложные лого компаний).
- **Поиск:** Используй `search_web` с запросом `[Имя бренда] logo svg wikimedia`.
- **Как скачать:** Найди ссылку на оригинальный `.svg` файл на странице Wikimedia и скачай его через `curl`.

### 3. SVGRepo / Iconify (Интерфейсные иконки)
**Где использовать:** Иконки интерфейса (корзина, настройки, стрелки), если в проекте не используется встроенная библиотека (например, Lucide/Heroicons).
- **Поиск:** `https://www.svgrepo.com/` или `https://icones.js.org/`

### 4. Встроенные библиотеки проекта (Lucide / Heroicons)
**Где использовать:** Системные иконки интерфейса Smmplan.
- **Процесс:** Проверь, установлены ли `lucide-react` или `@heroicons/react`. Если да — используй компоненты оттуда (например, `<Settings />`), вместо поиска новых файлов.

---

## 🛠️ Инструкция по применению

1. **Если пользователь просит добавить логотип соцсети или бренда:**
   - НЕ генерируй `<svg>`.
   - Выполни команду: `curl -s https://cdn.simpleicons.org/vk > src/components/icons/vk.svg`
   - Или найди прямую ссылку на SVG в Wikipedia.

2. **Оптимизация (React/Next.js):**
   - При добавлении сырого SVG в React, убедись, что атрибуты преобразованы в camelCase (например, `stroke-width` -> `strokeWidth`, `fill-rule` -> `fillRule`).
   - Если иконка монохромная, удали жестко заданные `fill="#000"` и замени на `fill="currentColor"`, чтобы она корректно работала в Dark Mode через Tailwind CSS классы (например, `text-muted-foreground`).

3. **Локализация в проекте:**
   - Все кастомные SVG-иконки должны лежать в папке `public/icons/` (если используются через `<img>`) или в `src/components/icons/` (если используются как React-компоненты).

Если ты понял задачу, всегда отвечай: *"SVG generation is strictly forbidden. Searching for verified asset..."*
