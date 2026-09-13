# SPEC-2026-09-13: UI Theme Architect & Automated Theme Harness (2026)

## 1. Метаданные спецификации
- **Дата создания:** 13 сентября 2026 г.
- **Статус:** APPROVED / ACTIVE
- **Область действия:** Платформа OmniSMM 1.0 (витрины SMMplan `smmplan.pro` и SMMflux `smmflux.ru`, админ-панель OmniSMM, генеративные виджеты).
- **Стек:** Next.js 16 (App Router), React 19, Tailwind CSS 4.0.0 (`@theme`, CSS-first), HeroUI v3, TypeScript 5.7+ (Strict Mode).

---

## 2. Бизнес-цели и Архитектурный контекст
Платформа OmniSMM 1.0 обслуживает различные бренды с контрастными дизайн-ДНК:
1. **SMMplan (`smmplan.pro`):** Classic B2B SaaS (High-Density, Swiss Kinetic, палитры Slate/Sky, строгий контраст, tabular-nums).
2. **SMMflux (`smmflux.ru`):** Radiant Aurora / Obsidian Monolith (Neon accents, Glassmorphism, темный монохром, градиентные микро-грани).

### Проблематика 2026 года:
- Ранее цвета прописывались вручную через произвольные hex-коды, что приводило к утечкам `text-white`, `bg-black` и падению читаемости интерфейса при переключении тем.
- Отсутствовал инструментальный контроль контрастности пар `foreground / background` по стандарту WCAG 2.2 AA ($\ge 4.5:1$).
- Не было автономного механизма синтеза новых тем для $N$ тенантов из одного Seed Color.

---

## 3. Математические стандарты и инварианты

### 3.1. Стандарт контрастности WCAG 2.2 AA / APCA
Относительная яркость (Relative Luminance $L$) вычисляется по формуле W3C:
$$L = 0.2126 \cdot R_{lin} + 0.7152 \cdot G_{lin} + 0.0722 \cdot B_{lin}$$
где $C_{lin} = \frac{C}{255} \le 0.04045 \ ? \ \frac{C/255}{12.92} \ : \ \left(\frac{C/255 + 0.055}{1.055}\right)^{2.4}$.

Коэффициент контрастности ($CR$):
$$CR = \frac{L_1 + 0.05}{L_2 + 0.05} \quad (L_1 > L_2)$$

**Инварианты:**
- Обычный текст (`body`, таблицы, инпуты): $CR \ge 4.5:1$.
- Крупный текст ($18\text{pt}+$ или $14\text{pt}$ bold) и бейджи: $CR \ge 3.0:1$.
- Интерактивные границы и фокусные кольца (`ring`, `border` на инпутах): $CR \ge 3.0:1$.

### 3.2. Токены Tailwind 4 CSS-First (@theme)
Все цвета объявляются строго в `src/app/globals.css`:
```css
@theme {
  --color-background: #...;
  --color-foreground: #...;
  --color-card: #...;
  --color-card-foreground: #...;
  --color-muted: #...;
  --color-muted-foreground: #...;
  --color-border: #...;
  --color-primary: #...;
  --color-primary-foreground: #...;
  --color-secondary: #...;
  --color-secondary-foreground: #...;
  --color-ring: #...;
}
```

---

## 4. Контракт CLI-Харнеса `theme-harness.ts`

### 4.1. Команда `theme:audit`
Сканирует файлы в `src/components/`, `src/app/` на предмет:
- Использования фиксированных цветов: `text-white`, `text-black`, `bg-white`, `bg-black`, `bg-slate-900`, `border-gray-200`;
- Использования произвольных значений цветов: `bg-[#...]`, `text-[#...]`, `border-[#...]`.
- Выводит отчет с процентом покрытия семантическими токенами.

### 4.2. Команда `theme:contrast`
- Парсит все зарегистрированные блоки тем в `src/app/globals.css` (`:root`, `.dark`, `.sky-light`, `.sky-dark`, `.emerald-light`, `.emerald-dark`, `.violet-light`, `.violet-dark`, `.warm-light`, `.warm-dark`).
- Вычисляет контраст ключевых пар:
  - `foreground` на `background` ($\ge 4.5:1$);
  - `card-foreground` на `card` ($\ge 4.5:1$);
  - `muted-foreground` на `muted` или `card` ($\ge 4.5:1$);
  - `primary-foreground` на `primary` ($\ge 4.5:1$).
- Возвращает статус PASS/FAIL с подробной детализацией по каждой теме.

### 4.3. Команда `theme:generate`
- Принимает параметры: `--name=<theme-name>`, `--seed=<hex-color>`, `--mode=<light|dark|both>`.
- Алгоритмически рассчитывает гармоничную пару (Light & Dark) с гарантированным контрастом $CR \ge 4.5:1$.
- Выводит готовый CSS-блок для вставки в `globals.css`.

---

## 5. План тестирования и критерии приемки
1. Тесты Vitest в `src/__tests__/skills/ui-theme-architect.test.ts` (100% PASS).
2. Запуск `npm run theme:contrast` с подтверждением соответствия всех основных тем стандарту WCAG 2.2 AA.
3. Проверка статического сканера `npm run theme:audit`.
4. Сборка `npx tsc --noEmit` без ошибок компиляции TypeScript.
