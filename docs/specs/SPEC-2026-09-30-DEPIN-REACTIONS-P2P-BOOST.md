# SPEC-2026-09-30-DEPIN-REACTIONS-P2P-BOOST
## Спецификация: Интерактивный выбор реакций, P2P-буст каналов за кредиты и OWASP 2026 защита

| Параметр | Значение |
| :--- | :--- |
| **Статус** | APPROVED (Human Approval Received) |
| **Tier** | Tier 2 (Standard SDD-TDD 2026) |
| **Автор** | Dual Agent Self-Improving Loop (Antigravity & OmniSMM Core Team) |
| **Дата** | 2026-09-30 |
| **Стандарты** | OWASP Top 10:2026 (A01, A03, A05, A08, A10), RAC-2026, ExactMath |

---

## 1. Контекст и бизнес-логика (MADR 3.0 Context)

### Проблема
1. В интерфейсе DePIN TMA во вкладке «Настройки» присутствовал лишь один неизменяемый тумблер `👍 Реакции`. Пользователь не мог указать, какие конкретно реакции (огонь 🔥, сердечко ❤️, аплодисменты 👏) он готов ставить.
2. Не было механизма разделения на стандартные бесплатные реакции и Premium-реакции.
3. Отсутствовала функция взаимного обмена (P2P): пользователь тапает и накапливает кредиты (PTS), но не может прямо из приложения запустить продвижение своего собственного Telegram-канала за эти кредиты.

### Решение
1. **Расширенный селектор реакций в настройках узла:**
   - Поддержка набора эмодзи: `['👍', '❤️', '🔥', '🎉', '👏', '💩']`.
   - Тумблер `hasTelegramPremium` (готовность выполнять дорогие премиум-задания с наградой +25 кр.).
2. **P2P-Буст канала (Взаимный обмен):**
   - Пользователь вводит ссылку на свой пост (`https://t.me/channel/123`).
   - Выбирает тип: `Просмотры` (стоимость 2 кр. / шт.) или `Реакции` (стоимость 5 кр. / шт. с выбором конкретного эмодзи: 🔥, ❤️, 👍 и др.).
   - Атомарное списание кредитов с баланса `DePinNode` и регистрация цели в `DePinTarget`.
   - Другие активные узлы тапалки получают этот пост в очередь исполнения.

---

## 2. DTO и Zod Схемы (Data Contracts)

### 2.1. Расширенные настройки узла
```ts
export const ALLOWED_REACTIONS_LIST = ['👍', '❤️', '🔥', '🎉', '👏', '💩'] as const;

export const UpdateNodePreferencesSchema = z.object({
  nodeId: z.string().trim().min(3),
  acceptsViewTasks: z.boolean().optional(),
  acceptsReactTasks: z.boolean().optional(),
  acceptsFollowTasks: z.boolean().optional(),
  allowedReactions: z.array(z.enum(ALLOWED_REACTIONS_LIST)).optional(),
  hasTelegramPremium: z.boolean().optional(),
});
```

### 2.2. Заказ P2P-буста за кредиты
```ts
export const CreateP2PBoostSchema = z.object({
  nodeId: z.string().trim().min(3),
  postUrl: z.string().trim().regex(
    /^https:\/\/t\.me\/([a-zA-Z0-9_]{4,32})\/(\d+)$/,
    'Ссылка должна быть формата https://t.me/channel/123'
  ),
  boostType: z.enum(['VIEW', 'REACT']),
  reactionEmoji: z.enum(ALLOWED_REACTIONS_LIST).optional(),
  count: z.number().int().min(5).max(500),
});
```

---

## 3. OWASP Top 10:2026 Защита

1. **A01: Broken Access Control & Double Spending:**
   - Списание кредитов выполняется строго в транзакции с условием `creditsBalance >= requiredCredits`.
   - Невозможно заказать буст, если на балансе узла недостаточно очков.
2. **A03: Injection & ReDoS:**
   - Регулярное выражение URL ограничено фиксированной длиной имени канала (4..32) и числовым ID поста.
   - Эмодзи валидируются строгим `z.enum`.
3. **A05: SSRF Prevention:**
   - Принимаются исключительно ссылки с доменом `https://t.me/`.
   - Любые попытки передать внутренние IP (`127.0.0.1`, `169.254.169.254`, `localhost`) блокируются до парсинга.

---

## 4. План реализации (WBS)

- **Шаг 1:** Обновление `src/actions/depin/ai-assistant.ts`: внедрение схем и Server Action `createP2PBoostAction`.
- **Шаг 2:** Написание модульных тестов в `src/__tests__/unit/depin-p2p-boost.test.ts`.
- **Шаг 3:** Обновление UI `src/app/depin/page.tsx`:
  - Вкладка «⚙️ Настройки»: интерактивные чипсы выбора реакций + тумблер Telegram Premium.
  - Вкладка «🪙 Тапер»: блок «🚀 Продвинуть свой канал» с быстрым чекаутом за кредиты.
- **Шаг 4:** Верификация `npx tsc --noEmit` и прогон тестов Vitest.
