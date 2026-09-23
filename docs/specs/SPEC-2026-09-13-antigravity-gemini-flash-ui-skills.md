# SPEC-2026-09-13: Antigravity Gemini Flash UI Creation & Refactoring Suite

## 1. Metadata
- **Status:** APPROVED
- **Author:** Lead Frontend Architect & AI Engine Lead
- **Risk-Tier:** Tier 2 (Specialized Agentic UI Skills)
- **Target Stack:** Google Antigravity, Gemini 3 / 3.8 Flash, React 19, Next.js 16, Tailwind CSS 4, HeroUI v3

---

## 2. Problem Statement & Motivation
Модель **Gemini Flash (Gemini 3 / 3.8 Flash)** обладает сверхбыстрой скоростью инференса и огромным контекстным окном, но при рефакторинге сложных интерфейсов подвержена специфическим рискам:
1. Попытка перезаписать весь файл целиком (более 300 строк) вместо точечного патча, что ведет к обрывам вывода токенов.
2. Случайная потеря мелких пропсов, обработчиков клика или неявных зависимостей при декомпозиции монолитов.
3. Генерация шаблонного кода или использование депрекейтнутых хуков React 18 вместо React 19.

Данный комплекс скиллов предоставляет высокоточные алгоритмы рефакторинга, протокол **Chunked Diff**, декомпозицию компонентов до 150–200 строк и Action-First синтез.

---

## 3. Core Architectural Invariants

### 3.1. Antigravity Flash UI Refactor
- **Лимит объема 150-200 строк:** Компоненты > 200 строк обязаны декомпозироваться на атомы и субкомпоненты.
- **Chunked Diff Protocol:** Запрет полной перезаписи больших файлов через `write_to_file`. Рефакторинг выполняется точечными блоками по 20–50 строк через `replace_file_content`.
- **Props Preservation Guard:** Перед сохранением рефакторинга проверяется сохранение контракта интерфейса TypeScript.
- **AST Flash Guard:** Автоматическое предотвращение забытых импортов React 19, потери ключей `key` и вызовов устаревших хуков.

### 3.2. Antigravity Widget Studio
- **Мгновенный Generative UI:** Быстрое прототипирование виджетов прямо в чате Antigravity через тег `<agent-embed>`.
- **Семантические токены Google Antigravity:** Использование переменных `var(--card)`, `var(--primary)`, `var(--foreground)` с официального gstatic CDN.
- **1-Шаговая компиляция:** Трансляция одобренного HTML-прототипа в чистый React 19 компонент.

### 3.3. Flash Component Decomposer
- **Разделение View и Logic:** Вынос бизнес-логики, Server Actions и стейта в кастомные хуки (`use...`), оставляя JSX-компонент чистым представлением.
- **React 19 Compiler Optimization:** Отсутствие избыточных ручных мемоизаций (`useCallback`, `useMemo`) там, где компилятор справляется автоматически.
- **Modal Hoisting:** Все диалоговые окна и шторки выносятся на верхний уровень дерева компонентов.

---

## 4. Verification & Testing Strategy
- Unit-тесты контрактов в `src/__tests__/skills/antigravity-gemini-flash-ui-skills.test.ts`.
- Тесты маршрутизации через JIT Router `routeSkillIntent`.
- Проверка типов `tsc --noEmit`, аудит секретов и валидация пакета.
