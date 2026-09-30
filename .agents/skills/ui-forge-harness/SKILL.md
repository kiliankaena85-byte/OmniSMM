---
name: ui-forge-harness
description: Автоматизированный харнес и арсенал дизайн-системы SMMflux/SMMplan для AI-агентов Antigravity. Включает готовые примитивы, микроанимации и генератор страниц по стандарту Obsidian Slate & Cobalt Matrix.
---

# UI Forge Harness & Visual Arsenal v2.0 (Obsidian Slate & Cobalt Matrix)

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
   - `primary`: Премиальный дизайн Cobalt Matrix (`bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-sm`), форма `rounded-xl`, активное hover-состояние.
   - `loading`: Автоматический спиннер без сдвига верстки.
2. **`<FluxInput label="..." error="..." leftIcon={...} />`**:
   - Автоматическая тряска (`animate-shake`) при ошибках валидации.
3. **`<FluxCard variant="glass|solid|glow|interactive">`**:
   - Стандарт **Obsidian Slate**: полупрозрачные карточки `border-border/40`, фон `bg-card/40 backdrop-blur-xl`, радиус `rounded-2xl`.
4. **`<FluxBadge variant="primary|success|warning|destructive" pulse>`**:
   - Деликатные акцентные бейджи `bg-primary/10 text-primary border border-primary/20` с пульсирующей точкой.
5. **`<NumberTicker value={...} />`**:
   - Плавное накручивание чисел цен и баланса с `tabular-nums`.
6. **`<BorderBeam duration={8} />`**:
   - Деликатный луч по контуру карточки без кислотной засветки.
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

# 3. Сгенерировать готовую страницу по стандартам SMMflux (Obsidian Slate & Cobalt Matrix)
npx tsx scripts/harness/ui-forge.ts scaffold --brand=flux <slug-страницы>

# 4. Сгенерировать готовую API-страницу SMMplan
npx tsx scripts/harness/ui-forge.ts scaffold --brand=smmplan <slug-страницы>
```

---

## 3. Жесткие запреты и стандарты (Hard Rules)
- ❌ **Запрещены кислотно-неоновые градиенты** (`from-purple-600 via-fuchsia-600 to-pink-600`, radial blur blobs), прямо нарушающие «THE LILA RULE» из `taste-skill` и штрафуемые в Laya MCP как `generic_slop`.
- 💎 **Премиальный стандарт Obsidian Slate & Cobalt Matrix**: глубокий нейтральный фон `bg-[#0B0E14]`, полупрозрачные карточки `border-border/40`, высококонтрастные заголовки `text-foreground`, деликатные акцентные бейджи `bg-primary/10 text-primary border border-primary/20`.
- ❌ Запрещено использовать сырые теги `<button>` и `<input>` без дизайн-системы.
- ❌ Запрещено писать инлайн-цвета (`text-blue-500`, `bg-black`, `text-white`).
- ❌ Запрещено отключать кнопку отправки формы (`disabled`). Кнопка всегда активна, перехватывает клик и подсвечивает ошибки.
- 📏 Максимальный размер создаваемых файлов компонентов и скриптов строго $\le 200$ строк.
