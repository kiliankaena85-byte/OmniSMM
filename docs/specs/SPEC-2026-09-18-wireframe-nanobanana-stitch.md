# SPEC-2026-09-18: Generative UI Pipeline Skill (wireframe-nanobanana-stitch)

## 1. Metadata
- **Status:** APPROVED
- **Author:** Fullstack Architect & Lead UI Engineer
- **Risk-Tier:** Tier 2 (Standard Architectural Skills)
- **Target Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4, Google Stitch / StitchMCP, Nano Banana (Gemini Flash Image)

---

## 2. Problem Statement & Motivation
Для ускорения разработки новых экранов платформы OmniSMM (SMMplan / SMMflux) необходим автоматизированный сквозной процесс:
От сырой идеи пользователя до готовых React 19 компонентов через:
1. **Информационную архитектуру & Low-Fi Wireframe:** быстрый каркас без цветов и визуального шума для валидации расположения элементов.
2. **Nano Banana (Gemini Flash Image):** трансформация вайрфрейма в фотореалистичный визуальный макет высокой четкости (High-Fidelity Mockup) с соблюдением дизайн-системы и геометрии.
3. **Google Stitch (Zero-Slop Synthesis):** декомпозиция визуала на чистые компоненты React 19 и стили Tailwind 4 без шаблонных ИИ-клише.

---

## 3. Core Architectural Invariants

### 3.1. 4-Фазный Пайплайн (Pipeline Sequencing)
1. **Фаза 1: Идея $\to$ Wireframe:**
   - Анализ пользовательского сценария и выбор сетки (Desktop 12-col или Mobile 1-col stack).
   - Генерация монохромного HTML/Tailwind каркаса (только серые оттенки, `border-dashed`, плейсхолдеры).
2. **Фаза 2: Wireframe $\to$ Nano Banana:**
   - Скриншот вайрфрейма как `[INPUT ANCHOR]`.
   - Применение выбранной дизайн-ДНК (Swiss Kinetic, Financial Terminal, Obsidian Monolith и др.).
   - Защита геометрии (Geometry Lock): запрет перемещения кнопок и полей.
3. **Фаза 3: Nano Banana $\to$ Google Stitch:**
   - Декомпозиция макета на независимые компоненты.
   - Фильтрация через 5 правил Zero-Slop (запрет неонового фиолетового на черном, эмодзи в бенто, пульсирующих пилюль, blob mesh, градиентного текста).
4. **Фаза 4: React 19 & Tailwind 4 Synthesis:**
   - Превращение в типизированные компоненты со строгими Server/Client границами.
   - Привязка к семантическим токенам `@theme` из `src/app/globals.css`.

### 3.2. Стандарты качества и доступности
- Контроль горизонтального скролла: 100% Fit по ширине видимого экрана.
- Touch Target $\ge 44\text{px}$ для всех мобильных интерактивных элементов.
- Контрастность текста по WCAG 2.2 AA $\ge 4.5:1$.

---

## 4. Verification & Testing Strategy
- Наличие файла L1 Fast Core `CORE.md` ($\le 30$ строк с Hard Invariants).
- Наличие файла L2 Deep Guide `SKILL.md` с точными промпт-шаблонами.
- Наличие базовых HTML-шаблонов для Desktop и Mobile.
- Покрытие тестами в `src/__tests__/skills/wireframe-nanobanana-stitch.test.ts`.
- Корректная маршрутизация через `routeSkillIntent` в `scripts/skill-router.ts`.
