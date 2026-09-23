---
name: ui-forge-harness
description: Автоматизированный харнес и арсенал дизайн-системы SMMflux/SMMplan для AI-агентов Antigravity. Включает готовые примитивы, микроанимации и генератор страниц.
---

# UI Forge Harness & SMMflux Visual Arsenal (v1.0)

Этот скилл предписывает AI-агентам использовать готовый арсенал компонентов и CLI-харнес при создании и модификации пользовательских интерфейсов SMMflux и SMMplan.

## 1. Доступные компоненты (`@/components/ui`)

Любой интерфейсный блок собирается из готовых примитивов:

```tsx
import { 
  FluxButton, 
  FluxInput, 
  FluxCard, 
  FluxBadge, 
  NumberTicker, 
  BorderBeam, 
  TiltCard, 
  Marquee, 
  Confetti,
  triggerConfetti 
} from "@/components/ui";
```

### Спецификация компонентов:
1. **`<FluxButton variant="primary|secondary|outline|ghost">`**:
   - `primary`: Неоновый градиент `from-purple-600 via-fuchsia-600 to-pink-600`, форма Pill (`rounded-full`), hover-свечение.
   - `loading`: Автоматический спиннер без сдвига верстки.
2. **`<FluxInput label="..." error="..." leftIcon={...} />`**:
   - Автоматическая тряска (`animate-shake`) при ошибках валидации.
3. **`<FluxCard variant="glass|solid|glow|interactive">`**:
   - Радиус `rounded-[2.5rem]`, эффект матового стекла (`backdrop-blur-2xl`) и глубокая тень.
4. **`<FluxBadge variant="primary|success|warning|destructive" pulse>`**:
   - Индикаторы категорий и статусов с пульсирующей точкой.
5. **`<NumberTicker value={...} />`**:
   - Плавное накручивание чисел цен и баланса с `tabular-nums`.
6. **`<BorderBeam duration={8} />`**:
   - Неоновый луч, бегущий по контуру карточки.
7. **`<TiltCard tiltAngle={10}>`**:
   - Интерактивный 3D-наклон карточки за курсором мыши.
8. **`<Marquee pauseOnHover>`**:
   - Бесконечная плавная лента логотипов соцсетей и отзывов.
9. **`<Confetti />` / `triggerConfetti()`**:
   - Праздничный салют при успешном создании заказа или пополнении счета.

---

## 2. CLI-команды Харнеса (`scripts/harness/ui-forge.ts`)

Агент может запускать харнес напрямую через терминал:

```bash
# 1. Посмотреть весь арсенал компонентов
npx tsx scripts/harness/ui-forge.ts list

# 2. Проверить верстку на соблюдение токенов
npx tsx scripts/harness/ui-forge.ts validate

# 3. Сгенерировать готовую страницу по стандартам SMMflux
npx tsx scripts/harness/ui-forge.ts scaffold <slug-страницы>
```

---

## 3. Жесткие запреты (Hard Rules)
- ❌ Запрещено использовать сырые теги `<button>` и `<input>` без дизайн-системы.
- ❌ Запрещено писать инлайн-цвета (`text-blue-500`, `bg-black`, `text-white`).
- ❌ Запрещено отключать кнопку отправки формы (`disabled`). Кнопка всегда активна, перехватывает клик и подсвечивает ошибки.
