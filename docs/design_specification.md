# Smmplan: FIGMA MAKE / AI AGENT MASTER BLUEPRINT SPECIFICATION
### Исчерпывающий пошаговый гид для генерации 26 интерфейсов SMM-панели (10 клиентских и 16 админ-вкладок) в Telegram UI Style

Этот документ спроектирован специально для копирования и вставки в ИИ-генераторы интерфейсов (Figma Make, v0, Lovable). Каждая вкладка представляет собой отдельную итерацию с детальной иерархией слоев, Auto-layout правилами, размерами в пикселях и точными промптами.

---

## 🎨 ГЛОБАЛЬНЫЙ СТИЛЕВОЙ ПАСПОРТ (FIGMA SYSTEM TOKENS)

При генерации используйте эти системные стили и переменные:
*   **Corner Radius (Скругления)**: Везде `12px` (`rounded-xl` в коде) для контейнеров, `8px` для мелких кнопок/инпутов.
*   **Сетка отступов (Paddings / Gaps)**: Шаг 8px. Внутренние отступы — `16px` или `24px`. Внешние расстояния — `24px` или `32px`.
*   **Типографика**: Шрифт `Inter`. Числовые значения, цены и ID — строго моноширинный `tabular-nums` (шрифт `Courier New` или `JetBrains Mono` в Figma).
*   **Telegram-Стили переписки**: Чат-пузыри с закруглением `16px` и "хвостом" сообщения.

---

## ЧАСТЬ I. КЛИЕНТСКИЙ КАБИНЕТ (10 Вкладок = 10 Итераций)

### Базовая структура основного экрана (Main Frame)
```
[Main App Canvas: 1440x900px, bg: #0e1621]
 ├── [Sidebar Frame: 240px x 100%, bg: #17212b, Auto-layout Vertical]
 └── [Content Canvas: w: Fill, h: 100%, bg: #0e1621, padding: 32px, Auto-layout Vertical]
```

---

### Итерация 1: Главная вкладка клиентского кабинета (`/dashboard`)
*   **Концепция**: Telegram Pinned Messages + Bot Quick Menu.
*   **Иерархия слоев Figma (Auto-layout Tree)**:
    ```
    [Content Canvas]
     ├── [Header Frame: h: 60px, Horizontal Auto-layout, w: Fill]
     │    ├── [Title: "Главная панель", 20px, bold, #ffffff]
     │    └── [User Indicator: Avatar 32x32px + "test@email.com" in #7f91a4]
     ├── [Pinned Cards Grid: w: Fill, Horizontal Auto-layout, gap: 16px]
     │    ├── [Card 1 - Balance: bg: #17212b, w: Fill, padding: 16px, left stripe: 3px bg #2481cc]
     │    │    └── [Text: "Ваш баланс" (11px, #7f91a4) + "₽ 1,234.50" (22px, bold, #4ab976)]
     │    ├── [Card 2 - Orders: bg: #17212b, w: Fill, padding: 16px, left stripe: 3px bg #2481cc]
     │    │    └── [Text: "Активные заказы" (11px) + "5 шт" (22px, bold, #ffffff)]
     │    └── [Card 3 - Discount: bg: #17212b, w: Fill, padding: 16px, left stripe: 3px bg #2481cc]
     │         └── [Text: "Личная скидка" (11px) + "7.5%" (22px, bold, #2481cc)]
     └── [Dashboard Content: Horizontal Auto-layout, gap: 24px, w: Fill]
          ├── [Quick Action Box: bg: #17212b, w: 2/3, padding: 24px, Vertical Auto-layout]
          │    ├── [Section Title: "Быстрые команды бота" (16px, bold)]
          │    └── [Button Grid: gap: 12px, Horizontal Auto-layout, 2 columns]
          │         ├── [Button 1: "Новый заказ", h: 48px, bg: #2481cc]
          │         ├── [Button 2: "Пополнить баланс", h: 48px, bg: #2481cc]
          │         ├── [Button 3: "Служба поддержки", h: 48px, bg: #2481cc]
          │         └── [Button 4: "Рефералы", h: 48px, bg: #2481cc]
          └── [Info Box: bg: #17212b, w: 1/3, padding: 24px, Vertical Auto-layout]
               ├── [Title: "Академия Smmplan", 14px, #ffffff]
               └── [Content: Telegram-like dialog bubble with bot helper advice]
    ```
*   **Системный промпт для Figma AI (Copy-Paste)**:
    `Generate a premium dark mode dashboard screen (1440x900px) named "/dashboard". The page canvas background is #0e1621. Use Inter font. Add a left sidebar navigation frame (width: 240px, bg: #17212b, stroke: #101924) resembling Telegram's chat sidebar with circular avatars. On the right, render a vertical auto-layout content container (padding: 32px). Include 3 pinned horizontal statistics cards at the top (bg: #17212b, corner radius: 12px, w: fill, px: 16, py: 16) representing Balance (showing green ₽ 1,234.50), Active Orders (showing 5), and Discount (showing 7.5%). Underneath, render a two-column grid. Left grid (width: 2/3, bg: #17212b, rounded-xl, padding: 24px) should contain a section title "Быстрые команды" and 4 big accent buttons (bg: #2481cc, text: #ffffff, h: 48px, rounded-lg). Right grid (width: 1/3, bg: #17212b, rounded-xl, padding: 24px) should showcase a simulated Telegram bot message bubble in soft Ivory text.`

---

### Итерация 2: Вкладка "Новый заказ" (`/dashboard/new-order`)
*   **Концепция**: Бот-интерфейс создания нового заказа с поштучным расчётом цены.
*   **Иерархия слоев Figma (Auto-layout Tree)**:
    ```
    [Content Canvas]
     └── [Order Form Box: max-w: 600px, bg: #17212b, padding: 32px, Vertical Auto-layout, gap: 16px]
          ├── [Header: "Оформить новый заказ" (20px, bold)]
          ├── [Category Field: w: Fill, Vertical Auto-layout, gap: 6px]
          │    ├── [Label: "1. Выберите платформу и категорию"]
          │    └── [Select Box: h: 44px, bg: #0e1621, padding: 12px, rounded-lg, Text: "Telegram - Подписчики"]
          ├── [Service Field: w: Fill, Vertical Auto-layout, gap: 6px]
          │    ├── [Label: "2. Услуга"]
          │    └── [Select Box: h: 56px, bg: #0e1621, padding: 12px, rounded-lg, Text: "ID 105 - Быстрые подписчики с гарантией"]
          │         └── [Sub-Label: "Цена: 0.08 ₽ / шт. | Скорость: 500 в день"]
          ├── [Link Field: w: Fill, Vertical Auto-layout, gap: 6px]
          │    ├── [Label: "3. Ссылка на канал"]
          │    └── [Input Box: h: 44px, bg: #0e1621, padding: 12px, rounded-lg, placeholder: "https://t.me/your_channel"]
          ├── [Quantity Field: w: Fill, Vertical Auto-layout, gap: 6px]
          │    ├── [Label: "4. Количество"]
          │    ├── [Input Box: h: 44px, bg: #0e1621, padding: 12px, rounded-lg, placeholder: "Минимум 100 - Максимум 10,000"]
          │    └── [Quick Selection Pills: Horizontal Auto-layout, gap: 8px]
          │         ├── [Pill 1: "+100", bg: #2481cc/15, text: #2481cc, rounded-full, px: 12, py: 6]
          │         ├── [Pill 2: "+500", bg: #2481cc/15, text: #2481cc]
          │         └── [Pill 3: "+1,000", bg: #2481cc/15, text: #2481cc]
          ├── [Total Banner: h: 52px, bg: #2481cc/10, rounded-lg, padding: 12px, Horizontal Auto-layout]
          │    └── [Text: "Итого к списанию:" + "₽ 120.00" (monospace, semibold, #2481cc)]
          └── [Submit Button: h: 44px, bg: #2481cc, text: "Подтвердить запуск", rounded-lg]
    ```
*   **Системный промпт для Figma AI (Copy-Paste)**:
    `Generate a clean card-based screen (max-w: 600px) centered inside the main dashboard named "/dashboard/new-order". The background of the card is #17212b, with corner radius 12px and 32px inner padding. The card is a vertical auto-layout form with gap 16px. Top header reads "Оформить новый заказ" in 20px bold white text. Render a structured Select Box for Category (h: 44px, bg: #0e1621, rounded-lg, showing "Telegram - Подписчики"). Underneath, a Select Box for Service (h: 56px, bg: #0e1621, rounded-lg) containing service details and a price tag strictly written in per-unit format: "0.08 ₽ / шт". Render an Input Box for "Ссылка на канал" (h: 44px, bg: #0e1621) with a placeholder showing "https://t.me/your_channel". Render an Input Box for Quantity (h: 44px) accompanied by 3 circular pill tags underneath (+100, +500, +1000). At the bottom, render a total cost summary banner showing "₽ 120.00" in blue monospace text and a primary blue CTA button (bg: #2481cc, h: 44px, text: "Подтвердить запуск" in bold white).`

---

### Итерация 3: Вкладка "Мои заказы" (`/dashboard/orders`)
*   **Концепция**: Табличный лог каналов и продвижения без разделительных линий.
*   **Иерархия слоев Figma (Auto-layout Tree)**:
    ```
    [Content Canvas]
     ├── [Status Filter Bar: Horizontal Auto-layout, gap: 8px, w: Fill]
     │    ├── [Active Pill: "Все", bg: #2481cc, text: #ffffff, rounded-full, px: 16, py: 8]
     │    ├── [Pill 2: "В работе", bg: #17212b, text: #7f91a4]
     │    ├── [Pill 3: "Готовы", bg: #17212b, text: #7f91a4]
     │    └── [Pill 4: "Отменены", bg: #17212b, text: #7f91a4]
     └── [Table Card: bg: #17212b, w: Fill, rounded-xl, padding: 16px]
          ├── [Table Header: Horizontal Auto-layout, gap: 12px, padding-bottom: 12px]
          │    └── [Labels: ID (#), Дата, Услуга, Ссылка, Кол-во, Сумма, Статус]
          └── [Table Rows: Vertical Auto-layout, gap: 2px]
               ├── [Row 1: Horizontal Auto-layout, padding: 12px, rounded-lg, hover-bg: #2481cc/10]
               │    ├── [ID: "#12095", mono]
               │    ├── [Date: "25.05.2026 10:12"]
               │    ├── [Service: Icon TG + "Telegram Подписчики"]
               │    ├── [Link: "t.me/channel_name", color: #2481cc]
               │    ├── [Count: "1,500 шт"]
               │    ├── [Cost: "120.00 ₽", mono]
               │    └── [Status: Chip "В работе" (bg: #2481cc/20, text: #2481cc)]
               └── [Row 2: Same structure, Status: Chip "Выполнен" (bg: #4ab976/20, text: #4ab976)]
    ```
*   **Системный промпт для Figma AI (Copy-Paste)**:
    `Generate an elegant table-based view named "/dashboard/orders" inside the content canvas. The layout is vertical auto-layout. At the top, render a horizontal filter bar of status pills. The active pill "Все" is styled with bg: #2481cc and text: #ffffff. The other pills ("В работе", "Готовы", "Отменены") are bg: #17212b and text: #7f91a4. Underneath, build a large card (bg: #17212b, corner radius: 12px, padding: 16px) containing a borderless table (No-Line Architecture). The columns are ID, Date, Service, Link, Count, Price, and Status. Render 3 table rows where each row has a subtle background hover highlight. Status chips should look like flat Telegram badges: blue for "В работе" and green for "Выполнен" (using bg: color/20, text: color).`

---

### Итерация 4: Умный Dripfeed (`/dashboard/smart-drip`)
*   **Концепция**: Расписание запусков постов (Scheduled Tasks).
*   **Иерархия слоев Figma (Auto-layout Tree)**:
    ```
    [Content Canvas]
     └── [Dripfeed Box: Horizontal Auto-layout, gap: 24px, w: Fill]
          ├── [Form Column: bg: #17212b, w: 1/2, padding: 24px, rounded-xl, gap: 16px]
          │    ├── [Title: "Создать кампанию Dripfeed"]
          │    ├── [Input 1: Выбор услуги]
          │    ├── [Input 2: Количество в один запуск (например, 100)]
          │    ├── [Input 3: Количество запусков (например, 10)]
          │    └── [Input 4: Задержка (в минутах)]
          └── [Visual Timeline Column: bg: #17212b, w: 1/2, padding: 24px, rounded-xl]
               ├── [Title: "Расписание выполнения постов"]
               └── [Timeline Frame: Vertical Auto-layout, gap: 12px, padding: 16px]
                    ├── [Item 1: Horizontal Auto-layout]
                    │    ├── [Dot: Circle 12x12px, bg: #4ab976]
                    │    └── [Text: "Запуск 1 — 25.05 10:15 (100 шт)"]
                    ├── [Item 2: Horizontal Auto-layout]
                    │    ├── [Dot: Circle 12x12px, bg: #2481cc]
                    │    └── [Text: "Запуск 2 — 25.05 11:15 (100 шт)"]
                    └── [Item 3: Same structure, dot: bg #7f91a4]
    ```
*   **Системный промпт для Figma AI (Copy-Paste)**:
    `Generate a two-column scheduling screen named "/dashboard/smart-drip". The layout is a horizontal auto-layout with gap 24px. The left column (width: 1/2, bg: #17212b, padding: 24px, rounded-xl) is a form labeled "Создать кампанию Dripfeed" containing service dropdown, count per run, total runs, and interval fields. The right column (width: 1/2, bg: #17212b, padding: 24px, rounded-xl) is titled "Расписание выполнения постов" and features a clean vertical timeline. The timeline consists of a vertical slate-colored line with 3 checkpoint dots (green for current run, blue for next run, gray for future runs) accompanied by text bubbles showing exact dates, times, and quantities.`

---

### Итерация 5: Транзакции (`/dashboard/transactions`)
*   **Концепция**: Telegram Receipts Ledger.
*   **Иерархия слоев Figma (Auto-layout Tree)**:
    ```
    [Content Canvas]
     └── [Ledger Card: bg: #17212b, w: Fill, padding: 24px, rounded-xl]
          ├── [Header: "История операций" (18px, bold)]
          └── [Transactions List: Vertical Auto-layout, gap: 1px]
               ├── [Invoice Row 1: Horizontal Auto-layout, padding: 16px, border-bottom: #101924/50]
               │    ├── [Left (Vertical): Type: "Пополнение баланса" + Date "25.05.2026"]
               │    ├── [Middle: ID "TX-892015", mono]
               │    └── [Right (Horizontal): Sum "+1,500.00 ₽" (green mono #4ab976) + Lucide Download icon]
               ├── [Invoice Row 2: Same structure]
               │    └── [Sum: "-350.00 ₽" (white mono, indicating purchase)]
               └── [Invoice Row 3: Same structure]
    ```
*   **Системный промпт для Figma AI (Copy-Paste)**:
    `Generate a sleek ledger history table screen named "/dashboard/transactions". The core view is a vertical auto-layout card (bg: #17212b, padding: 24px, rounded-xl). The list of transactions is a clean vertical auto-layout. Render 3 invoice rows where each row contains the transaction type and date on the left, transaction ID in the middle in monospace font, and the operation amount on the right accompanied by a download invoice PDF icon button (Lucide Download). Inflows are colored green (+1,500.00 ₽), and outflows are colored white/gray (-350.00 ₽).`

---

### Итерация 6: Пополнить баланс (`/dashboard/add-funds`)
*   **Концепция**: Telegram Star Shop.
*   **Иерархия слоев Figma (Auto-layout Tree)**:
    ```
    [Content Canvas]
     └── [Payment Container: max-w: 600px, Vertical Auto-layout, gap: 24px]
          ├── [Quick Amount Selection: Vertical Auto-layout, gap: 12px]
          │    ├── [Label: "Выберите сумму пополнения"]
          │    └── [Grid 2x2: gap: 12px, Horizontal Auto-layout]
          │         ├── [Option 1: bg: #17212b, active border: #2481cc, padding: 16px]
          │         │    └── [Text: "500 ₽" (18px) + "+5% Бонус" (12px, #4ab976)]
          │         ├── [Option 2: bg: #17212b, border: #101924, padding: 16px]
          │         │    └── [Text: "1,000 ₽" + "+7% Бонус"]
          │         └── [Option 3: bg: #17212b, border: #101924, padding: 16px]
          ├── [Payment Gateways: Vertical Auto-layout, gap: 8px]
          │    ├── [Label: "Способ оплаты"]
          │    └── [Gateway Rows: Vertical Auto-layout, gap: 8px]
          │         ├── [Row 1: h: 48px, bg: #0e1621, Radio Active, Text: "СБП (QR-код)"]
          │         └── [Row 2: h: 48px, bg: #0e1621, Radio Inactive, Text: "Банковские карты"]
          ├── [Checkout CTA: h: 44px, bg: #2481cc, text: "Перейти к оплате", rounded-lg]
          └── [Trust Indicators: Horizontal Auto-layout, gap: 20px, justify: center]
               ├── [Logo "MIR" - grey monochrome shape]
               ├── [Logo "SBP" - grey monochrome shape]
               └── [Logo "YooKassa" - grey monochrome shape]
    ```
*   **Системный промпт для Figma AI (Copy-Paste)**:
    `Generate a payment checkout interface named "/dashboard/add-funds". Max width is 600px. First element is a 2x2 grid of quick-select deposit card buttons (bg: #17212b, rounded-xl). The first card is selected, styled with a glowing blue border (#2481cc) showing "500 ₽" and "+5% Бонус" in green. Below, render a vertical list of payment gateways with radio-button controls (one active for SBP QR and one inactive for Cards). Below the primary action button "Перейти к оплате" (bg: #2481cc, h: 44px), render an aligned monochrome group of official secure badges for "MIR", "SBP", and "YooKassa" directly under the payment form to build trust.`

---

### Итерация 7: Поддержка (`/dashboard/tickets`)
*   **Концепция**: Двухпанельный Telegram Chat.
*   **Иерархия слоев Figma (Auto-layout Tree)**:
    ```
    [Content Canvas: h: 600px, w: Fill]
     └── [Chat Box: Horizontal Auto-layout, bg: #17212b, rounded-xl, w: Fill, h: 100%]
          ├── [Tickets list: w: 300px, border-right: #101924, Vertical Auto-layout]
          │    ├── [Search: Input h: 36px, bg: #0e1621, margin: 8px]
          │    └── [List Items: Vertical Auto-layout]
          │         ├── [Item 1: Active, bg: #2481cc/10]
          │         │    └── [Text: "Не пришел бонус" + "Оператор пишет..." + badge "1"]
          │         └── [Item 2: Closed, bg: transparent]
          │              └── [Text: "Ошибка заказа" + "Решено"]
          └── [Chat Workspace: w: Fill, bg: #0e1621, Vertical Auto-layout]
               ├── [Chat Header: h: 50px, bg: #17212b, padding: 12px]
               │    └── [Text: "Тикет #8915: Не пришел бонус" + status "В работе"]
               ├── [Messages Canvas: w: Fill, h: Fill, padding: 16px, bg-pattern: TG style]
               │    ├── [Left Message Bubble: bg: #17212b, text: "Привет! Пришлите ID платежа.", rounded-xl with tail]
               │    └── [Right Message Bubble: bg: #2481cc, text: "Вот чек: TX-892015", rounded-xl with tail]
               └── [Chat Input Panel: h: 60px, bg: #17212b, Horizontal Auto-layout, gap: 12px]
                    ├── [Lucide Clip icon button]
                    ├── [Input Area: bg: #0e1621, rounded-lg, placeholder: "Написать сообщение..."]
                    └── [Lucide Paperplane icon button: colored #2481cc]
    ```
*   **Системный промпт для Figma AI (Copy-Paste)**:
    `Generate a full-screen Telegram chat interface named "/dashboard/tickets" with height 600px. It has a horizontal auto-layout split. Left panel (w: 300px, bg: #17212b, border-right: #101924) shows a list of support dialogs with user avatar circles, short previews, and circular unread count badges. The right panel (bg: #0e1621, w: Fill) is the active support chat room. The chat body displays structured messages: grey rounded text bubbles on the left (operator) and blue rounded bubbles on the right (client). At the bottom, render a floating chat input panel (h: 60px, bg: #17212b) featuring an attachment icon (paperclip), text area, and a blue Telegram send paperplane button.`

---

### Итерация 8: Рефералы (`/dashboard/referrals`)
*   **Концепция**: Telegram Invite Link Widget.
*   **Иерархия слоев Figma (Auto-layout Tree)**:
    ```
    [Content Canvas]
     ├── [Promo Card: bg: #2481cc/10, border: #2481cc/30, padding: 20px, rounded-xl]
     │    └── [Text: "Приглашайте вебмастеров и получайте 5%!" (semibold, #2481cc)]
     ├── [Link Frame: Horizontal Auto-layout, bg: #17212b, padding: 12px, rounded-xl, gap: 12px]
     │    ├── [Input: "https://smmplan.ru/ref?id=1295", color: #ffffff, disabled]
     │    └── [Copy Button: bg: #2481cc, text: "Copy Link", rounded-lg, h: 36px]
     └── [Stats Grid: Horizontal Auto-layout, gap: 16px]
          ├── [Metric 1: Accounts registered - 45]
          └── [Metric 2: Rewards accrued - 12,000 ₽ in green mono]
    ```
*   **Системный промпт для Figma AI (Copy-Paste)**:
    `Generate a referral/affiliate network tracking interface named "/dashboard/referrals". At the top, place a horizontal auto-layout marketing banner with a soft blue background opacity and rounded borders (#2481cc/10). Below, build a neat frame containing a read-only input box showing the referral link "https://smmplan.ru/ref?id=1295" and a compact "Copy Link" button (bg: #2481cc, text: #ffffff). At the bottom, render a grid of 2 statistic panels showing Accounts registered (45) and Rewards accrued (12,000 ₽ written in green monospace font).`

---

### Итерация 9: Профиль (`/dashboard/settings`)
*   **Концепция**: Личные настройки аккаунта Telegram.
*   **Иерархия слоев Figma (Auto-layout Tree)**:
    ```
    [Content Canvas]
     └── [Settings Panel: bg: #17212b, rounded-xl, padding: 32px, max-w: 500px]
          ├── [Avatar block: Vertical Auto-layout, align: center, gap: 8px]
          │    ├── [Circle Avatar: 80x80px, bg: #2481cc/20, Text "AD" in blue]
          │    └── [Label: "Изменить фото" (12px, #2481cc)]
          ├── [Field: Email (disabled)]
          ├── [Field: Имя]
          ├── [Field: Текущий пароль]
          └── [Field: Новый пароль]
    ```
*   **Системный промпт для Figma AI (Copy-Paste)**:
    `Generate an account profile settings form named "/dashboard/settings" with max width 500px. The main frame is bg: #17212b, corner radius 12px, 32px inner padding. At the top, center a large circular avatar (80x80px) colored soft blue containing initials "AD" in bold sky-blue. Below, render standard form input boxes for Name, Email (disabled), and a secure password modification sub-block with input boxes for Current Password and New Password.`

---

### Итерация 10: API для разработчиков (`/dashboard/settings/api`)
*   **Концепция**: BotFather API Console.
*   **Иерархия слоев Figma (Auto-layout Tree)**:
    ```
    [Content Canvas]
     ├── [Token Card: bg: #17212b, padding: 24px, rounded-xl, Vertical Auto-layout]
     │    ├── [Title: "Ваш API-токен" (14px, bold)]
     │    └── [Token Field: Horizontal Auto-layout, gap: 12px]
     │         ├── [Input: "••••••••••••••••••••••••••••", disabled]
     │         ├── [Show Button: bg: #0e1621]
     │         └── [Regenerate Button: bg: #e53935, text: "Сбросить"]
     └── [Code Playground: bg: #090e14, padding: 20px, rounded-lg]
          └── Monospace JSON request syntax representation
    ```
*   **Системный промпт для Figma AI (Copy-Paste)**:
    `Generate a developer API token management screen named "/dashboard/settings/api". Create a vertical auto-layout card (bg: #17212b, padding: 24px, rounded-xl). The token line has a horizontal layout containing a disabled input filled with dots representing a secret key, accompanied by a small "Show" button and a red "Regenerate" button (bg: #e53935). Below, render a developer documentation JSON block with a very dark background (#090e14) showing monospace formatted JSON code.`

---

## ЧАСТЬ II. API АДМИН-ПАНЕЛЬ (16 Разделов = 16 Итераций)

### Базовая структура основного экрана админа (Admin Frame)
```
[Admin Canvas: 1440x900px, bg: #0e1621]
 ├── [Sidebar Frame: 240px x 100%, bg: #17212b, Auto-layout Vertical]
 └── [Content Canvas: Compact padding: 16px, Auto-layout Vertical]
```

---

### Итерация 11: Панель управления (`/admin/dashboard`)
*   **Концепция**: Финансовый пульт управления (Executive Financial Dashboard).
*   **Иерархия слоев Figma (Auto-layout Tree)**:
    ```
    [Content Canvas]
     ├── [Admin Header: Horizontal Auto-layout]
     │    ├── [Title: "Панель администратора"]
     │    └── [Tax Selector: Pill tuft: УСН "Доходы" 6% | УСН "Расход" 15%]
     ├── [Financial Grid: Horizontal Auto-layout, gap: 12px, w: Fill]
     │    ├── [Metric 1: bg: #17212b, w: Fill, Title "Оборот" + "₽ 950,000"]
     │    ├── [Metric 2: bg: #17212b, w: Fill, Title "Комиссия ЮКасса" + "-₽ 28,500"]
     │    ├── [Metric 3: bg: #17212b, w: Fill, Title "Себестоимость COGS" + "-₽ 450,000"]
     │    └── [Metric 4: bg: #17212b, w: Fill, Title "Прибыль" + "₽ 471,500" in green #4ab976]
     └── [Alerts Block: bg: #17212b, w: Fill, padding: 16px]
          └── List of stuck orders highlighted in red, alongside USD exchange rates
    ```
*   **Системный промпт для Figma AI (Copy-Paste)**:
    `Generate an executive API administrative dashboard named "/admin/dashboard". The design utilizes high data density (compact paddings, small fonts, minimal visual borders). At the top, include a horizontal panel containing the page title and a toggle selector switch labeled "Схема УСН: Доходы (6%) / Доходы-Расходы (15%)". Render a 4-column financial grid of compact cards (bg: #17212b, rounded-xl) displaying: Revenue (₽ 950,000), YooKassa fees (-₽ 28,500), COGS (-₽ 450,000), and Net Profit (styled in emerald green #4ab976 showing ₽ 471,500). Below, add an alert widget listing stuck orders highlighted in transparent red.`

---

### Итерация 12: Панель поддержки (`/admin/tickets`)
*   **Концепция**: Единое рабочее пространство оператора (Unified Workspace).
*   **Иерархия слоев Figma (Auto-layout Tree)**:
    ```
    [Content Canvas: h: 700px, w: Fill]
     └── [Workspace Box: Horizontal Auto-layout, w: Fill, h: 100%]
          ├── [Ticket Queue (1/4): w: 250px, border-right: #101924, Vertical Auto-layout]
          │    └── Ticket rows (oldest first, with amber waiting flags)
          ├── [Chat Area (2/4): bg: #0e1621, w: Fill, Vertical Auto-layout]
          │    └── Message bubbles and input form
          └── [Client Sidebar (1/4): w: 250px, border-left: #101924, ClientProfileSidebar]
               ├── [Avatar and email test@email.com]
               ├── [Balance: ₽ 500.00]
               └── [Last 5 orders list with small buttons: "Restart" and "Refund"]
    ```
*   **Системный промпт для Figma AI (Copy-Paste)**:
    `Generate a API split-screen ticket support desk view named "/admin/tickets" with height 700px. It has a horizontal auto-layout split. Left panel (w: 250px, bg: #17212b, border-right: #101924) shows a queue list of waiting tickets sorted by oldest time, with yellow flags showing wait time. The center area (w: Fill, bg: #0e1621) is the chat message pane. The right panel (w: 250px, bg: #17212b, border-left: #101924) is the ClientProfileSidebar showing client avatar, email, current balance (₽ 500.00), and a table of last 5 client orders with quick button controls "Restart" (blue) and "Refund" (red).`

---

### Итерация 13: Теневой каталог услуг (`/admin/catalog`)
*   **Концепция**: Cherry-Pick Import Buffer.
*   **Иерархия слоев Figma (Auto-layout Tree)**:
    ```
    [Content Canvas]
     ├── [Filter panel: Provider Select dropdown + Refresh button]
     └── [Catalog table: bg: #17212b, w: Fill, rounded-xl]
          ├── Row headers with checkboxes
          └── Dense Rows (bg-hover: #2481cc/10):
               ├── Checkbox (checked) | Service ID | Provider Rate ($0.80) | CB USD/RUB markup | Retail Price (₽ 120.00)
               └── Checkbox (unchecked) | Service ID | Provider Rate ($0.55) | CB USD/RUB markup | Retail Price (₽ 82.50)
    ```
*   **Системный промпт для Figma AI (Copy-Paste)**:
    `Generate a dense provider catalog import view named "/admin/catalog". Build a table where each row has a checkbox column. The columns are: Checkbox, Service ID, Provider Rate (shown in USD, e.g., $0.80), CB Russia rate markup calculations, and calculated retail price (shown in rubles, e.g., ₽ 120.00). The first row checkbox is checked, and the row is highlighted. The second row is unchecked. Add an action button "Cherry-Pick Import" colored green (#4ab976) at the top.`

---

### Итерация 14: Управление клиентами (`/admin/clients`)
*   **Концепция**: Пользователи и Ledger Balance Verification.
*   **Иерархия слоев Figma (Auto-layout Tree)**:
    ```
    [Content Canvas]
     ├── [Clients Table Card: bg: #17212b, w: Fill]
     │    └── User list rows with "+/-" adjustment buttons
     └── [Overlay Modal: bg: #000000/70 (blur), Card: bg: #17212b, max-w: 400px]
          ├── [Title: "Корректировка баланса"]
          ├── [Input: Сумма в рублях]
          ├── [Reason Dropdown: "Компенсация за сбой"]
          └── [Action Buttons: Cancel | Save (disabled until reason is selected)]
    ```
*   **Системный промпт для Figma AI (Copy-Paste)**:
    `Generate a user management screen named "/admin/clients" showcasing a ledger adjustment dialog. Behind is a dense client data table with columns: Email, Registration Date, Balance, and Action buttons (+/-). Render an overlay modal box (max-w: 400px, bg: #17212b) titled "Корректировка баланса" containing an input field for the amount, and a mandatory dropdown selector for "Reason" (Compensation, Mistake, Partner payouts) showing "Компенсация за сбой", with action buttons Cancel and Save. The Save button is disabled (indicated by dark grey outline) until the reason is filled.`

---

### Итерация 15: Маркетинг и UTM-аналитика (`/admin/marketing`)
*   **Концепция**: Аналитика окупаемости UTM-кампаний.
*   **Иерархия слоев Figma (Auto-layout Tree)**:
    ```
    [Content Canvas]
     └── [Campaign Analysis Table: bg: #17212b, w: Fill, padding: 16px]
          ├── [Headers: UTM source, UTM medium, Registrations, CAC, LTV, ROMI]
          └── [Rows]
               ├── [Row 1: "vk_ads", "cpc", "320 regs", "₽ 150 CAC", "₽ 450 LTV", ROMI: "+200%" (green bg #4ab976/20)]
               ├── [Row 2: "tg_ads", "cpm", "110 regs", "₽ 220 CAC", "₽ 230 LTV", ROMI: "+4.5%" (yellow bg #ffb300/20)]
               └── [Row 3: "fb_ads", "cpc", "45 regs", "₽ 350 CAC", "₽ 210 LTV", ROMI: "-40%" (red bg #e53935/20)]
    ```
*   **Системный промпт для Figma AI (Copy-Paste)**:
    `Generate an advertising and promotional analytics dashboard named "/admin/marketing". Build a dense tabular chart with columns: UTM source, UTM medium, Registrations, CAC, LTV, and ROMI. The table contains three rows showcasing the ROMI efficiency cell color ranges: row 1 has a green ROMI cell (+200%, bg: #4ab976/20), row 2 has a yellow ROMI cell (+4.5%, bg: #ffb300/20), and row 3 has a red ROMI cell (-40%, bg: #e53935/20).`

---

### Итерации 16-26: Системные и вспомогательные панели администрирования
Отрисовать компактные специализированные API-интерфейсы:
*   **Итерация 16: Провайдеры API (`/admin/providers`)**: Grid of provider cards showing status "Connected" and USD wallet balances.
*   **Итерация 17: Заказы системы (`/admin/orders`)**: Dense table showing all app orders with bulk checkbox control toolbar.
*   **Итерация 18: Услуги и карантин (`/admin/services`)**: Table of retail services with margins and Quarantine Alerts (orange color #ffb300).
*   **Итерация 19: Логи безопасности (`/admin/system`)**: Dense black table with immutable ledger and admin action log.
*   **Итерация 20: Выплаты рефералов (`/admin/refills`)**: Request list with "Approve" / "Reject" controls.
*   **Итерация 21: CMS Блога (`/admin/cms`)**: Content editor layout.
*   **Итерации 22-26: Настройки системы, статические страницы, аналитика производительности API, настройки воркеров BullMQ и балансовая сверка Ledger (`/admin/pages`, `/admin/analytics`, `/admin/smart`, `/admin/finance`)**.
