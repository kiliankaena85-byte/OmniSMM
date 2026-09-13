# SPEC-2026-09-13: Google Stitch & Yandex Frontend Ecosystem Skills

## 1. Metadata
- **Status:** APPROVED
- **Author:** Fullstack Architect & Lead UI Engineer
- **Risk-Tier:** Tier 2 (Standard Architectural Skills)
- **Target Stack:** Next.js 16 (App Router), React 19, Google Stitch / StitchMCP, Yandex Gravity UI, Tailwind CSS 4

---

## 2. Problem Statement & Motivation
Для создания интерфейсов мирового уровня и суверенной надежности в РФ платформе требуются специализированные знания двух экосистем:
1. **Google Stitch (Generative UI & Design-to-Code):** генерация интерфейсов и макетов из референсов без шаблонных «AI-Slop» клише с последующим синтезом в React 19 код.
2. **Yandex Frontend & UI Ecosystem:**
   - **Gravity UI:** открытая дизайн-система и библиотека React-компонентов Яндекса для создания высокоплотных enterprise-интерфейсов (таблицы, навигация, формы).
   - **Yandex Services (SmartCaptcha, Metrika/WebVisor, Yandex Pay):** интеграция суверенных сервисов защиты от ботов, UX-аналитики и быстрой оплаты в 1 клик.

---

## 3. Core Architectural Invariants

### 3.1. Google Stitch Architect (Zero-Slop Standard)
- **Сквозной пайплайн 4 шагов:** DOM-анализ референса -> Структурированный промпт Stitch -> Генерация макета -> Синтез React 19 кода.
- **5 Запретов AI-Клише (Zero-Slop Engine):**
  1. Запрет фиолетового/цианового неона на черном.
  2. Запрет случайных эмодзи в бенто-сетках.
  3. Запрет пилюль с пульсирующей точкой над заголовками.
  4. Запрет размытых фоновых пятен-кругов (Blob Mesh).
  5. Запрет градиентного текста поперек ключевых слов.
- **6 Дизайн-ДНК:** Swiss Kinetic, Financial Terminal, Industrial Hardware, Neo-Editorial, Obsidian Monolith, Bio-Mechanical.

### 3.2. Yandex Gravity UI Steward
- **Семантические токены слоев:** `--g-color-base-background`, `--g-color-base-generic`, `--g-color-text-primary`.
- **Высокая информационная плотность:** компактные таблицы `Table`, экшн-панели `ActionPanel`, модальные окна `Dialog`, шторки `Drawer`.
- **Типографика:** шрифтовые шкалы YS Text и YS Display.
- **Доступность (WCAG 2.2 AA):** контрастность >= 4.5:1, клавиатурная навигация, фокусные кольца.

### 3.3. Yandex Services Integrator
- **Yandex SmartCaptcha:** серверная валидация токена капчи на бэкенде (`requireCaptchaVerification`), скрытая (invisible) капча.
- **Yandex Metrika & WebVisor:** защита от падений при наличии AdBlock (`typeof window.Ya !== 'undefined'`), сбор ecommerce-целей.
- **Yandex Pay:** интеграция быстрой оплаты в 1 клик с фискализацией 54-ФЗ.

---

## 4. Verification & Testing Strategy
- Unit-тесты контрактов в `src/__tests__/skills/stitch-and-yandex-skills.test.ts`.
- Тесты маршрутизации через JIT Router `routeSkillIntent`.
- Проверка типов `tsc --noEmit`, аудит секретов и валидация пакета.
