# Отчет о юзабилити и логическом аудите панели администратора Smmplan

**Дата проведения аудита**: 24 мая 2026 года  
**Стек технологий проекта**: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4.0, HeroUI v3, Prisma 5 (PostgreSQL), BullMQ, Redis.  
**Целевой файл отчета**: `admin_usability_audit_report.md`  

---

## Введение
Данный отчет представляет собой детальный юзабилити- и логический аудит панели управления администратора платформы Smmplan. Настоящая версия отчета расширена и включает в себя глубокий аудит страницы списка заказов (`/admin/orders`), анализ эргономики интерфейса, исследование логических багов переходов, аудит транзакционной безопасности начислений и детальные программные решения для улучшения операционной эффективности службы поддержки.

---

## 1. Анализ тикет-системы и UX-эффективности поддержки (R1)

### 1.1. Страница списка тикетов (`/admin/tickets`)
Интерфейс списка тикетов (реализованный в `src/app/admin/tickets/page.tsx` с клиентской оберткой `TicketClient` и описанием колонок в `columns.tsx`) спроектирован по канонам API-интерфейсов с высокой плотностью данных (Data Density).

*   **Преимущества реализации**:
    *   Использование клиентской пагинации и быстрых фильтров по статусам тикетов позволяет операторам мгновенно переключаться между категориями «Новые», «В работе» и «Закрытые».
    *   Отсутствие лишнего визуального шума в табличной сетке. Тональный контраст строк заменяет устаревшие границы `1px solid`, что разгружает зрение при длительной работе.
*   **Рекомендации по улучшению UX**:
    *   **KPI-виджеты над таблицей**: Операторам критически не хватает оперативной сводки в реальном времени. Рекомендуется внедрить 3 компактных KPI-карточки над поисковой строкой:
        1.  *«Без ответа»* (кол-во тикетов со статусом `OPEN` и отсутствием ответов от поддержки).
        2.  *«Критическое время ожидания»* (кол-во тикетов, где клиент ждет ответа более 15 минут).
        3.  *«Мои активные диалоги»* (кол-во тикетов, закрепленных за текущим оператором).
    *   **Мишени клика (Touch & Click Targets)**: Строки таблицы должны быть интерактивными. Сейчас переход в чат происходит только по клику на тему тикета или через выпадающее меню действий. Кликабельность всей строки (с деликатным hover-эффектом `transition-all duration-200 bg-muted/40`) сэкономит операторам тысячи лишних движений курсора в день.

### 1.2. Страница чата тикета (`/admin/tickets/[id]`)
Раздел диалога (чат `ChatWindow` и боковая панель `ClientProfileSidebar`) представляет собой классический двухпанельный мессенджер-интерфейс.

*   **Архитектурный анализ UX/UI**:
    *   **Разделение сообщений**: Сообщения клиента позиционируются слева (нейтральный серый/белый фон), сообщения поддержки — справа (фирменный фиолетовый/синий фон). Это обеспечивает мгновенное считывание контекста диалога.
    *   **Скрытые заметки (Internal Notes)**: Опция `🔒 Скрытая заметка` (чекбокс под полем ввода) окрашивает сообщение в предупреждающий янтарный цвет с иконкой замка. Данный тип сообщений сохраняется с флагом `INTERNAL`, полностью скрыт от глаз клиента на фронтенде и служит для внутренней координации (например, обмена деталями с техническими специалистами). Это отличная реализация паттерна Trust Boundary.
    *   **Шаблоны ответов (`TemplateManagerModal`)**: Интеграция быстрых заготовок ответов (`canned replies`) существенно ускоряет работу. Шаблоны хранятся в модели `SupportTemplate` и выводятся над полем ввода чата в виде компактных кнопок-таблеток. Окно управления шаблонами позволяет на лету создавать, редактировать (`upsertTemplate`) и удалять (`deleteTemplate`) шаблоны без перезагрузки страницы благодаря Server Actions и `useTransition`.
    *   **Кнопка AI-ответа (`handleAiReply` с иконкой Sparkles)**: Позволяет генерировать интеллектуальный ответ на основе контекста переписки с помощью встроенной модели `gemini-3.5-flash`. Это передовой UX-паттерн, снижающий умственное утомление оператора.

### 1.3. Логика ручных компенсаций и докруток (`ManualRefillModal` и `logManualCompensation`)
Ручные компенсации — наиболее критическая с точки зрения финансовой безопасности зона админ-панели. Модальное окно `ManualRefillModal` и бэкенд-экшн `logManualCompensation` (`src/actions/support/compensation.ts`) защищены многоуровневой системой безопасности.

#### Детальный разбор бэкенд-логики `logManualCompensation`:
1.  **Проверка прав доступа (RBAC Guard)**:
    Экшн обернут в функцию авторизации:
    ```typescript
    return requireStaffPermission('support', 'edit', async (user) => { ... })
    ```
    Это гарантирует, что компенсацию может выдать только пользователь с ролью `OWNER` или сотрудник поддержки с подтвержденными правами редактирования в модуле `support`.
2.  **Валидация входящих данных**:
    Используется Zod-схема с жестким ограничением максимальной суммы компенсации в 50 000 рублей:
    ```typescript
    const compensationSchema = z.object({
      ticketId: z.string().min(1),
      costRub: z.number().positive().max(50000), // Ограничение лимита одной транзакции
      note: z.string().min(3),
      topUpBalance: z.boolean().default(false)
    });
    ```
3.  **Контроль лимитов доверия (`supportLimitCents`)**:
    Учетные записи сотрудников поддержки (не-`OWNER`) имеют строго лимитированный бюджет доверия в центах на месяц/день.
    Система выполняет жесткую проверку:
    ```typescript
    const isOwner = user.role === 'OWNER';
    if (!isOwner && user.supportLimitCents < costCents) {
      throw new Error('Недостаточно лимита доверия');
    }
    ```
4.  **Атомарность транзакции БД (Prisma Transactions)**:
    Вся цепочка списания лимита и начисления денег клиенту выполняется внутри изолированной транзакции с уровнем изоляции `Serializable`, что защищает систему от конкурентных запросов (Race Conditions):
    ```typescript
    await db.$transaction(async (tx) => {
      // 1. Атомарное уменьшение лимита оператора с проверкой на отрицательный баланс
      if (!isOwner) {
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: { supportLimitCents: { decrement: costCents } }
        });
        if (updatedUser.supportLimitCents < 0) {
          throw new Error('Недостаточно лимита доверия. Обнаружена конкурентная транзакция.');
        }
      }
      
      // 2. Начисление средств клиенту или логирование затрат
      if (topUpBalance) {
        // Начисление реального баланса в кошелек клиента
        await WalletOps.credit(tx, ticket.userId, costCents, `Компенсация (На баланс): ${note}`, { adminId: user.id, idempotencyKey });
      } else {
        // Логирование компенсации «на внешние провайдерские докруты» без изменения баланса
        await tx.ledgerEntry.create({
          data: { userId: ticket.userId, adminId: user.id, amount: -costCents, reason: `Компенсация (Докрут): ${note}`, status: 'APPROVED', idempotencyKey }
        });
      }
      
      // 3. Запись в системный аудит-лог (AdminAuditLog)
      await tx.adminAuditLog.create({ ... });

      // 4. Инъекция сервисного сообщения в чат тикета
      await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          sender: 'INTERNAL',
          text: `[СИСТЕМА] Сотрудник (${user.email}) оформил компенсацию (${topUpBalance ? 'зачислен баланс' : 'ручной докрут'}). Потрачено: ${costRub.toLocaleString('ru-RU')} ₽.\nКомментарий: ${note}`
        }
      });
    }, { isolationLevel: 'Serializable' });
    ```
5.  **Защита от двойного списания (Идемпотентность)**:
    Уникальный ключ идемпотентности генерируется детерминистически на основе параметров запроса (ticketId, сумма, примечание, тип компенсации). Это предотвращает дублирование транзакций при случайном двойном клике оператора по кнопке отправки.
6.  **Инъекция системных сообщений**:
    Создание записи в `ticketMessage` со специальным флагом `sender: 'INTERNAL'` позволяет вывести факт компенсации прямо в ленту переписки. Это дает оператору мгновенное подтверждение успеха, а при аудите истории тикета позволяет четко сопоставить слова клиента с финансовыми действиями поддержки.

---

## 2. Глубокий аудит страницы списка заказов (`/admin/orders`) (R2.1)

Страница списка заказов является основной рабочей областью оператора поддержки при разборе технических инцидентов. Ниже приведен детальный аудит ее юзабилити, логики выполнения действий и архитектурных проблем.

### 2.1. Юзабилити таблицы заказов и плотность данных
*   **Оценка плотности данных (Data Density)**:
    Интерфейс использует высокоплотную сетку, группируя ключевые метрики заказа (Категория, Услуга, Ссылка, Количество) в рамках одной комбинированной ячейки `info` (`columns.tsx` строка 229). Использование нативного тега `<details>` для скрытия технических логов провайдера и Drip-Feed истории — отличное решение, которое минимизирует высоту строк таблицы по умолчанию и позволяет оператору быстро сканировать список глазами.
*   **Иерархия информации и контраст**:
    Иерархия хорошо выдержана: ID заказа выделен жирным, дата форматирована в компактный двухстрочный вид, а статус оформлен в виде яркого контрастного Badge (`STATUS_STYLES` в `columns.tsx`).
*   **Математическое выравнивание чисел и цен (Критический UX-фактор)**:
    *   **Правое выравнивание**: Столбец `charge` (Итоговая цена) выровнен по правому краю (`header: () => <div className="text-right">Цена</div>` и класс `text-right tabular-nums`), что является абсолютным эталоном для финансовых таблиц, облегчая мгновенное сравнение сумм по вертикали.
    *   **Проблема выравнивания количественных данных**: Метрика объема заказа (`quantity`) и остаток (`remains`) находятся внутри комбинированной ячейки `info` и выровнены по левому краю. Из-за этого оператор не может сравнить объемы разных заказов «в один взгляд», ему приходится вчитываться в каждую строчку индивидуально.
    *   **Проблема цены за единицу (Price per Unit)**: В таблице выводится только итоговая стоимость заказа (`charge`). Оператор поддержки не видит розничную цену за 1 штуку (`pricePerUnitRub`) или цену за 1000 штук (`pricePer1kRub`). При разборе жалоб клиентов («Почему с меня списали X за Y единиц?») оператор вынужден вручную делить стоимость на количество или переходить в каталог услуг, что увеличивает когнитивную нагрузку и время ответа.

### 2.2. Удобство выполнения действий над заказами
Действия над заказами выполняются через боковую панель `OrderDrawer` (`order-client.tsx` строка 46).

*   **Анализ действий**:
    *   **Cancel (Отмена заказа)**: Вызывает `cancelOrderAction`, автоматически рассчитывает остаток и оформляет частичный возврат средств клиенту.
    *   **Restart (Перезапуск заказа)**: Позволяет повторно отправить зависший или отмененный заказ провайдеру с повторным резервированием средств.
    *   **Failover / Provider Change (Резервное перенаправление)**: Модальное окно резервного копирования загружает альтернативные маршруты провайдеров (`getFailoverPreview`) и позволяет оператору на лету переключить зависший заказ на другого поставщика услуг (`manualRerouteOrder`). Это высокоэффективный инструмент для обеспечения стабильности платформы.
*   **Проблемы юзабилити действий**:
    *   **Использование браузерных `confirm`**: Действия «Отмена» и «Перезапуск» используют стандартный браузерный диалог `confirm(...)` (строки 104 и 121 в `order-client.tsx`). Это нарушает целостность премиального интерфейса (Vercel/HeroUI стиль), блокирует поток выполнения JavaScript и может быть заблокировано настройками безопасности браузера оператора.
    *   **Отображение сырых API ошибок**: При сбое заказа бэкенд выводит сырой ответ от API провайдера в неизмененном виде (например, `{"status":"fail","error":"Invalid link"}` или `Rate limit exceeded`). С одной стороны, это дает техническую точность. С другой стороны, оператор тратит лишнее время на расшифровку JSON-строк от внешних зарубежных панелей. Отсутствует механизм локализации типичных ошибок («Невалидная ссылка», «Профиль закрыт», «Провайдер перегружен»).

---

## 3. Карта путей оператора (Userflows) и аудит логики переходов (R3)

Ниже приведена карта путей оператора по методологии **Chain-of-Feeling** (Действие $\rightarrow$ Эмоциональный триггер/контекст $\rightarrow$ Точка трения/баг).

### 3.1. Flow A: Обращение по конкретному заказу (Inquiry & Resolution)
*   **Шаг 1 (Действие)**: Оператор открывает тикет, где клиент жалуется на зависший заказ подписчиков Telegram.
*   **Шаг 2 (Эмоция/Контекст)**: *Раздражение клиента* передается оператору. Оператор находится в состоянии когнитивной перегрузки, ведя 5 диалогов параллельно. Он хочет решить проблему в 2 клика.
*   **Шаг 3 (Точка трения)**: В чате выведена карточка привязанного заказа. Оператор нажимает на кнопку «Перейти к заказу ➔».
*   **Шаг 4 (Критический баг B)**: Ссылка ведет на `/admin/orders?edit_order_id=ORDER_ID`. Если этот заказ был сделан несколько дней назад и не попадает на первую страницу списка (первые 50 заказов), оператор видит пустую таблицу заказов, а боковая панель управления заказом (`OrderDrawer`) **не открывается**.
*   **Шаг 5 (Эмоция оператора)**: *Фрустрация и усталость*. Оператору приходится вручную копировать ID заказа из тикета, вставлять его в поисковую строку на странице заказов, нажимать «Найти» и ждать перезагрузки страницы. Время обработки тикета увеличивается на 45–60 секунд.

### 3.2. Flow B: Ручная привязка Telegram-аккаунта (Smart Account Binding)
*   **Шаг 1 (Действие)**: Клиент пишет из Telegram-бота. Поскольку его профиль временный (`tg_123456789`), оператор видит предупреждающую плашку о необходимости слияния аккаунтов.
*   **Шаг 2 (Эмоция/Контекст)**: *Беспокойство*. Оператор переживает, что если клиент закроет бот, его история и баланс потеряются. Нужно бесшовно перепривязать профиль к основному Email аккаунту клиента.
*   **Шаг 3 (Действие оператора)**: Оператор просит у клиента Email, вводит его в боковом меню `ClientProfileSidebar` в поле ручной привязки и нажимает «ОК».
*   **Шаг 4 (Интерактивное слияние)**: Компонент показывает детальное превью: сколько заказов будет перенесено, какой баланс на целевом аккаунте.
*   **Шаг 5 (Завершение)**: Оператор нажимает «Слить». Система выполняет Server Action `adminManualTelegramBind(confirm: 'true')`. Аккаунты объединяются, временный профиль удаляется, балансы суммируются.
*   **Шаг 6 (Эмоция оператора)**: *Облегчение и удовлетворение*. Задача решена безопасно, клиент не потеряет свои средства и заказы.

### 3.3. Flow C: Просмотр финансовой ценности клиента (LTV & Finance Audit)
*   **Шаг 1 (Действие)**: Оператор ведет диалог о скидках или возврате крупной суммы.
*   **Шаг 2 (Эмоция/Контекст)**: *Осторожность*. Оператор должен оценить ценность клиента (LTV — Lifetime Value), чтобы принять решение о лояльности или выдаче компенсации за счет компании.
*   **Шаг 3 (Действие оператора)**: Оператор смотрит в `ClientProfileSidebar` на карточки «Баланс» и «LTV», изучает последние 3 заказа и последние транзакции пополнения через ЮKassa/CryptoBot.
*   **Шаг 4 (Действие оператора)**: Чтобы получить полную картину, оператор нажимает на ссылку «Смотреть все заказы →» под списком последних заказов.
*   **Шаг 5 (Критический баг A)**: Ссылка ведет на `/admin/orders?userId=USER_ID`. Однако страница заказов **полностью игнорирует** параметр `userId` и выводит глобальный список заказов всех пользователей платформы.
*   **Шаг 6 (Эмоция оператора)**: *Раздражение*. Оператор снова вынужден копировать email клиента, переходить на страницу заказов, вставлять email в фильтр и нажимать поиск.

---

### 3.4. Детальный аудит логических ошибок и готовые программные исправления (Bug Fixes) (R2.2)

#### Баг A: Игнорирование фильтра `userId` на странице заказов
*   **Файлы**:
    *   Триггер: `src/components/support/ClientProfileSidebar.tsx` (строка 250) — формирует ссылку с `?userId=${user.id}`.
    *   Парсинг: `src/app/admin/orders/page.tsx` (строки 24-29 и 42-45) — не считывает параметр `userId` в `searchParams`.
    *   Запрос: `src/services/admin/order.service.ts` (метод `searchOrders`) — не принимает и не применяет фильтрацию по `userId` к Prisma-запросу.
*   **Причина ошибки**: Полное отсутствие поддержки параметра `userId` в цепочке от парсинга параметров страницы до формирования SQL-запроса `where` в Prisma.

##### Готовое решение для внедрения:

1.  **Исправление в `src/services/admin/order.service.ts`**:
    Необходимо добавить параметр `userId` в тип `OrderSearchParams` и внедрить его в условие `where`.

    ```typescript
    // Найти блок типов OrderSearchParams (строка 19) и заменить на:
    type OrderSearchParams = {
      query?: string;
      status?: string;
      userId?: string; // <-- ДОБАВЛЕНО
      cursor?: string;
      pageSize?: number;
    };

    // Найти метод searchOrders (строка 34) и применить замену:
    async searchOrders(params: OrderSearchParams): Promise<PaginatedResult<AdminOrderRow>> {
      const { query, status, userId, cursor, pageSize = 50 } = params; // <-- РАЗОБРАТЬ userId

      // Build dynamic WHERE clause
      const where: Record<string, unknown> = {};

      if (status && status !== 'ALL') {
        where.status = status;
      }

      if (userId) {
        where.userId = userId; // <-- ДОБАВЛЕНО: Фильтрация по конкретному клиенту
      }

      if (query && query.trim()) {
        const q = query.trim();
        const numericId = parseInt(q, 10);

        if (!isNaN(numericId) && q === String(numericId)) {
          where.numericId = numericId;
        } else {
          const cleanSubstring = q.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
          
          where.OR = [
            { externalId: { contains: q, mode: 'insensitive' } },
            { link: { contains: cleanSubstring, mode: 'insensitive' } },
            { user: { email: { contains: q, mode: 'insensitive' } } },
          ];
        }
      }
      
      // ... дальше без изменений paginatedQuery ...
    }
    ```

2.  **Исправление в `src/app/admin/orders/page.tsx`**:
    Считать параметр `userId` из `searchParams` и передать его в вызов сервиса.

    ```typescript
    // Найти определение типа Props (строка 24) и заменить на:
    type Props = {
      searchParams: Promise<{
        q?: string;
        status?: string;
        userId?: string; // <-- ДОБАВЛЕНО
        cursor?: string;
      }>;
    };

    // Внутри компонента AdminOrdersPage (строка 42) обновить парсинг:
    const params = await searchParams;
    const query = params.q || '';
    const statusFilter = params.status || 'ALL';
    const userIdFilter = params.userId || undefined; // <-- ДОБАВЛЕНО
    const cursor = params.cursor || undefined;

    // Обновить вызов сервиса (строка 47):
    const { items: orders, nextCursor, hasMore } = await adminOrderService.searchOrders({
      query: query || undefined,
      status: statusFilter,
      userId: userIdFilter, // <-- ДОБАВЛЕНО
      cursor,
      pageSize: 50,
    });
    ```

---

#### Баг B: Невозможность открыть `OrderDrawer` для заказов вне первой страницы списка
*   **Файлы**:
    *   Ссылка перехода: `src/components/support/ChatWindow.tsx` (строка 585) — перенаправляет на `/admin/orders?edit_order_id=${orderId}`.
    *   Инициализация в клиенте: `src/app/admin/orders/components/order-client.tsx` (строки 448-452) — ищет заказ только в локальном массиве `data` текущей страницы.
*   **Причина ошибки**: Массив `data` в `OrderClient` содержит только те 50 записей, которые были возвращены сервером для текущей страницы пагинации. Если нужный `edit_order_id` находится на 2-й странице и далее, метод `data.find()` возвращает `undefined`, из-за чего состояние `selectedOrder` сбрасывается в `null`, и Drawer не открывается.

##### Готовое решение для внедрения:

1.  **Добавление метода выборки одиночного заказа в `src/services/admin/order.service.ts`**:
    Для отрисовки панели заказа бэкенду необходимо предоставить полную структуру данных по конкретному заказу, включая связи с пользователем, провайдером и услугой.

    ```typescript
    // Добавить этот метод в класс AdminOrderService:
    async getOrderByIdForDrawer(orderId: string): Promise<AdminOrderRow | null> {
      return db.order.findUnique({
        where: { id: orderId },
        include: {
          user: { select: { id: true, email: true } },
          provider: { select: { name: true } },
          service: { 
            select: { 
              id: true, 
              name: true, 
              numericId: true,
              etaP50Seconds: true,
              etaP90Seconds: true,
              etaSampleCount: true,
              etaSpeedClass: true,
              etaUpdatedAt: true,
              category: { select: { name: true, network: { select: { name: true } } } }
            } 
          },
        },
      }) as unknown as Promise<AdminOrderRow | null>;
    }
    ```

2.  **Получение заказа на сервере в `/admin/orders/page.tsx`**:
    Если в URL передан параметр `edit_order_id`, мы напрямую запрашиваем этот заказ из БД и передаем его в `OrderClient` отдельным пропом `initialSelectedOrder`.

    ```typescript
    // Обновить Props страницы для поддержки edit_order_id:
    type Props = {
      searchParams: Promise<{
        q?: string;
        status?: string;
        userId?: string;
        edit_order_id?: string; // <-- ДОБАВЛЕНО
        cursor?: string;
      }>;
    };

    // Внутри AdminOrdersPage (строка 42) считать параметр:
    const params = await searchParams;
    const query = params.q || '';
    const statusFilter = params.status || 'ALL';
    const userIdFilter = params.userId || undefined;
    const editOrderId = params.edit_order_id || undefined; // <-- ДОБАВЛЕНО
    const cursor = params.cursor || undefined;

    // Загрузить заказ напрямую, если передан параметр:
    let initialSelectedOrder: any = null;
    if (editOrderId) {
      initialSelectedOrder = await adminOrderService.getOrderByIdForDrawer(editOrderId);
    }

    // Передать полученный заказ в OrderClient (строка 129):
    <OrderClient 
      canSeeRates={canSeeRates}
      initialSelectedOrder={initialSelectedOrder ? {
        id: initialSelectedOrder.id,
        numericId: initialSelectedOrder.numericId,
        externalId: initialSelectedOrder.externalId ?? null,
        link: initialSelectedOrder.link,
        quantity: initialSelectedOrder.quantity,
        remains: initialSelectedOrder.remains,
        status: initialSelectedOrder.status,
        charge: Number(initialSelectedOrder.charge),
        providerCost: Number(initialSelectedOrder.providerCost ?? 0),
        createdAt: initialSelectedOrder.createdAt,
        isDripFeed: initialSelectedOrder.isDripFeed,
        dripExternalIds: initialSelectedOrder.dripExternalIds,
        runs: initialSelectedOrder.runs ?? null,
        interval: initialSelectedOrder.interval ?? null,
        currentRun: initialSelectedOrder.currentRun,
        error: initialSelectedOrder.error ?? null,
        user: { email: initialSelectedOrder.user.email },
        providerName: initialSelectedOrder.provider?.name ?? null,
        service: {
          name: initialSelectedOrder.service.name,
          etaP50Seconds: initialSelectedOrder.service.etaP50Seconds,
          etaP90Seconds: initialSelectedOrder.service.etaP90Seconds,
          etaSampleCount: initialSelectedOrder.service.etaSampleCount,
          etaSpeedClass: initialSelectedOrder.service.etaSpeedClass,
          etaUpdatedAt: initialSelectedOrder.service.etaUpdatedAt?.toISOString() ?? null,
          category: {
            name: initialSelectedOrder.service.category.name,
            network: initialSelectedOrder.service.category.network ?? null,
          },
        },
      } : null}
      data={orders.map(o => ({ ... }))} // Основной массив данных страницы остается прежним
    />
    ```

3.  **Инициализация Drawer в `src/app/admin/orders/components/order-client.tsx`**:
    Сконфигурировать клиентский компонент для работы с `initialSelectedOrder` через состояние.

    ```typescript
    // Обновить интерфейс пропсов OrderClientProps (строка 40):
    interface OrderClientProps {
      data: OrderColumn[];
      canSeeRates?: boolean;
      initialSelectedOrder?: OrderColumn | null; // <-- ДОБАВЛЕНО
    }

    // Внутри компонента OrderClient (строка 443) заменить логику выбора заказа:
    export function OrderClient({ data, canSeeRates = true, initialSelectedOrder = null }: OrderClientProps) {
      const searchParams = useSearchParams();
      const router = useRouter();
      const pathname = usePathname();

      const editOrderId = searchParams.get('edit_order_id');
      
      // Внедряем локальный стейт вместо статического useMemo
      const [selectedOrder, setSelectedOrder] = useState<OrderColumn | null>(null);

      React.useEffect(() => {
        if (initialSelectedOrder && initialSelectedOrder.id === editOrderId) {
          // Если заказ передан сервером напрямую — используем его
          setSelectedOrder(initialSelectedOrder);
        } else if (editOrderId) {
          // Иначе ищем в текущей локальной пачке данных страницы
          const found = data.find(o => o.id === editOrderId);
          setSelectedOrder(found ?? null);
        } else {
          setSelectedOrder(null);
        }
      }, [data, editOrderId, initialSelectedOrder]);

      // Метод закрытия Drawer (строка 459) остается прежним:
      function closeDrawer() {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('edit_order_id');
        router.replace(`${pathname}?${params.toString()}`);
      }
      
      // ... рендер таблицы и Drawer ...
    }
    ```

---

## 4. Предложенные UI/UX улучшения по стандартам Enterprise UX (R2.3)

Для повышения премиальности интерфейса Smmplan (Vercel-Style / Stripe-Style эстетика) и сокращения времени обработки заказов операторами, предлагаются следующие точечные улучшения:

### 4.1. Улучшение выравнивания количественных данных и цен за единицу
*   **Изолированные колонки объема**: Вынести «Количество» и «Остаток» из комбинированной ячейки `info` в отдельные выделенные колонки таблицы.
*   **Правое выравнивание для объемов**: Столбцы «Кол-во» и «Остаток» выравнивать по правому краю с использованием моноширинных шрифтов (`font-mono text-right tabular-nums`), что позволит операторам мгновенно сопоставлять масштаб заказов визуально.
*   **Внедрение Price per Unit**: В карточку деталей заказа в `OrderDrawer` и в раскрывающиеся логи `<details>` добавить явный вывод цены за 1 штуку в рублях (`pricePerUnitRub`) и цены за 1000 единиц (`pricePer1kRub`). Это исключит необходимость ручных математических расчетов оператором во время диалога с разгневанным клиентом.

### 4.2. Переход от браузерных `confirm` к кастомным Radix/HeroUI диалогам
*   Все критические деструктивные действия (Отмена заказа с возвратом средств, Повторный перезапуск с повторным списанием баланса) должны быть переведены на кастомный интерактивный оверлей `AlertDialog` (например, на базе Radix UI или встроенных компонентов HeroUI v3).
*   Это решит три проблемы:
    1.  Исключит зависание JS-потока в браузере.
    2.  Предотвратит блокировку всплывающих окон браузером.
    3.  Позволит добавить подробное превью возвращаемой суммы на экране подтверждения, повышая прозрачность действий оператора.

### 4.3. Интеллектуальный парсинг и человекочитаемый вывод ошибок API
*   Внедрить на уровне хелперов клиентской части парсер ошибок провайдеров. Вместо вывода сырого JSON-текста `{"status":"fail","error":"Invalid link"}` или raw строки бэкенда, выводить структурированную плашку с русской локализацией:
    *   `Invalid link` $\rightarrow$ **«Ошибка ссылки: Введен некорректный формат или профиль скрыт настройками приватности»**.
    *   `Rate limit` $\rightarrow$ **«Ограничение лимита: Превышена частота отправки запросов к провайдеру»**.
*   Рядом с текстом ошибки выводить кнопку быстрого действия (например, «Проверить доступность ссылки в новой вкладке» или «Переотправить через альтернативного провайдера»).

---

## 5. Проектирование бесшовного Drawer управления заказом в чате тикета (R3)

Чтобы полностью исключить контекстный переход оператора из чата на отдельную страницу заказов, необходимо спроектировать бесшовный механизм управления заказом прямо внутри `/admin/tickets/[id]`.

### 5.1. Техническая спецификация интеграции (UI-SPEC / API-SPEC)

#### Клиентское состояние (UI State):
Внутри чата (`ChatWindow.tsx` или родительского `AdminTicketChatPage`) создается выделенный стейт для отслеживания выбранного заказа:
```typescript
const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
const [activeOrderData, setActiveOrderData] = useState<OrderColumn | null>(null);
const [isLoadingOrder, setIsLoadingOrder] = useState(false);
```

#### Точки триггера в интерфейсе (Visual Trigger Points):
1.  **Привязанный заказ в шапке чата**:
    Заменяем статический `<Link href="/admin/orders?...">` на интерактивную кнопку:
    ```tsx
    <button 
      onClick={() => handleOpenOrderDrawer(activeTicket.order.id)}
      className="text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg transition-all"
    >
      Управление заказом ➔
    </button>
    ```
2.  **Интерактивные карточки заказов в ленте чата**:
    Если клиент или система прикрепили заказ к сообщению, кнопка в чате также перестраивается на открытие Drawer:
    ```tsx
    <button 
      onClick={() => handleOpenOrderDrawer(msg.order.id)}
      className="text-[9px] font-black px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded border border-indigo-700 shadow-sm"
    >
      Детали заказа ➔
    </button>
    ```
3.  **Боковая панель `ClientProfileSidebar`**:
    Последние 3 заказа клиента в сайдбаре получают hover-эффект (`hover:scale-[1.02] hover:border-indigo-300 cursor-pointer transition-all`) и кликабельность:
    ```tsx
    <div 
      key={order.id} 
      onClick={() => onOpenOrderDrawer(order.id)}
      className="bg-card border border-slate-100 hover:border-indigo-300 rounded-xl p-3 shadow-sm flex flex-col gap-2 cursor-pointer transition-all"
    >
      ...
    </div>
    ```

#### API Spec (Server Action `fetchOrderDetailsAction`):
Для наполнения Drawer данными создается новый безопасный Server Action в `src/actions/admin/orders.ts`:
```typescript
'use server';

import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';

export async function fetchOrderDetailsAction(orderId: string) {
  return requireStaffPermission('support', 'view', async () => {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, email: true } },
        provider: { select: { name: true } },
        service: {
          select: {
            id: true,
            name: true,
            numericId: true,
            category: { select: { name: true, network: { select: { name: true } } } }
          }
        }
      }
    });

    if (!order) return { success: false, error: 'Заказ не найден' };

    return {
      success: true,
      data: {
        id: order.id,
        numericId: order.numericId,
        externalId: order.externalId ?? null,
        link: order.link,
        quantity: order.quantity,
        remains: order.remains,
        status: order.status,
        charge: Number(order.charge),
        providerCost: Number(order.providerCost ?? 0),
        createdAt: order.createdAt,
        isDripFeed: order.isDripFeed,
        dripExternalIds: order.dripExternalIds,
        runs: order.runs ?? null,
        interval: order.interval ?? null,
        currentRun: order.currentRun,
        error: order.error ?? null,
        user: { email: order.user.email },
        providerName: order.provider?.name ?? null,
        service: {
          name: order.service.name,
          category: {
            name: order.service.category.name,
            network: order.service.category.network ?? null,
          }
        }
      }
    };
  });
}
```

### 5.2. Пошаговый план рефакторинга
1.  **Создание общего компонента Drawer**:
    Вынести компонент `OrderDrawer` из `src/app/admin/orders/components/order-client.tsx` в общий файл `src/components/admin/OrderDrawer.tsx` для переиспользования на обеих страницах.
2.  **Интеграция состояния**:
    Внедрить `activeOrderId` и функцию `handleOpenOrderDrawer` в родительский компонент страницы тикета `AdminTicketChatPage` или напрямую в клиентский `ChatWindow.tsx`.
3.  **Обработка кликов**:
    Связать клики по карточкам заказов в сообщениях чата и клики по списку заказов в сайдбаре с вызовом `handleOpenOrderDrawer`.
4.  **Асинхронная загрузка**:
    При вызове `handleOpenOrderDrawer` запускать индикатор загрузки, вызывать Server Action `fetchOrderDetailsAction(orderId)` и при успешном получении данных открывать `OrderDrawer`.
5.  **Тестирование мутаций**:
    Поскольку `OrderDrawer` использует стандартные Server Actions панели управления (`cancelOrderAction`, `restartOrderAction`, `setOrderStatusAction`), любые изменения статуса заказа внутри Drawer будут автоматически вызывать инвалидацию путей через `revalidatePath` на бэкенде. Это мгновенно обновит состояние карточки заказа в чате тикета без перезагрузки всей страницы!

---

## 6. Анализ каталога услуг и интеграции с провайдерами (R4)

Каталог услуг панели администратора (`/admin/catalog`, управляемый бэкенд-сервисом `AdminCatalogService.listServices` в `src/services/admin/catalog.service.ts` и визуализируемый в `catalog-table-v2.tsx`) имеет ряд серьезных ограничений, препятствующих масштабированию платформы.

### 6.1. Аудит текущих ограничений каталога

1.  **Отсутствие фильтра по SMM-провайдеру**:
    В методе `listServices` полностью отсутствует условие `where.providerId`. Администратор не может отфильтровать каталог, чтобы увидеть услуги, поставляемые конкретным вендором (например, посмотреть только услуги от провайдера «JAP» для массовой корректировки наценок).
2.  **Отсутствие фильтра по соцсети/платформе (Network)**:
    Модель категорий имеет прямую связь с соцсетью (Network), однако в каталоге нельзя отфильтровать список услуг по конкретной платформе (например, вывести все категории и услуги для Telegram).
3.  **Отсутствие поиска по внешнему ID провайдера (`externalId`)**:
    Метод `listServices` осуществляет поиск только по внутреннему названию или внутреннему последовательному ID (`numericId`):
    ```typescript
    if (params.search?.trim()) {
      const q = params.search.trim();
      const numId = parseInt(q, 10);
      if (!isNaN(numId) && q === String(numId)) {
        where.numericId = numId; // Поиск только по внутреннему numericId
      } else {
        where.name = { contains: q, mode: 'insensitive' };
      }
    }
    ```
    Если провайдер присылает уведомление об изменении цены на услугу `#1402`, администратор пытается вбить `1402` в поиск каталога. Поиск выдает внутреннюю услугу платформы Smmplan с `numericId = 1402`, которая может быть абсолютно другой услугой, в то время как нужная услуга с `externalId = '1402'` игнорируется.
4.  **UX-проблемы каталога категорий (`/admin/catalog/categories`)**:
    На странице категорий выводится гигантский линейный список без поисковой строки или фильтрации по соцсети. Когда количество категорий превышает 50–70, ручной скроллинг превращается в операционный кошмар.

---

### 6.2. Технические планы по улучшению каталога

#### Шаг 1: Расширение сервисного слоя в `src/services/admin/catalog.service.ts`
Необходимо обновить сигнатуру и логику метода `listServices`, добавив фильтры по `providerId`, `networkSlug` и поддержку поиска по `externalId`.

```typescript
// Обновить сигнатуру listServices:
async listServices(params: {
  cursor?: string;
  search?: string;
  categoryId?: string;
  providerId?: string;   // <-- ДОБАВЛЕНО
  networkSlug?: string;  // <-- ДОБАВЛЕНО
  pageSize?: number;
}): Promise<PaginatedResult<CatalogRow>> {
  const where: Record<string, any> = {};

  // Фильтр по категории
  if (params.categoryId) {
    where.categoryId = params.categoryId;
  }

  // Фильтр по провайдеру
  if (params.providerId) {
    where.providerId = params.providerId; // <-- ДОБАВЛЕНО
  }

  // Фильтр по соцсети (связь через категорию)
  if (params.networkSlug) {
    where.category = {
      network: { slug: params.networkSlug } // <-- ДОБАВЛЕНО
    };
  }

  // Умный поиск с поддержкой externalId
  if (params.search?.trim()) {
    const q = params.search.trim();
    const numId = parseInt(q, 10);

    if (!isNaN(numId) && q === String(numId)) {
      // Если введено число — ищем совпадение либо по нашему внутреннему numericId,
      // либо по внешнему ID услуги на стороне провайдера (externalId)
      where.OR = [
        { numericId: numId },
        { externalId: q } // <-- ДОБАВЛЕНО: поддержка externalId
      ];
    } else {
      where.name = { contains: q, mode: 'insensitive' };
    }
  }

  return paginatedQuery<CatalogRow>(db.service, {
    cursor: params.cursor,
    pageSize: params.pageSize || 50,
    where,
    orderBy: { numericId: 'asc' },
    include: {
      category: { select: { id: true, name: true, network: { select: { name: true, slug: true } } } },
      _count: { select: { orders: true } },
    },
  });
}
```

#### Шаг 2: Проектирование UI-фильтров в панели каталога (`/admin/catalog`)
Интерфейс верхней панели каталога расширяется до трех селекторов, расположенных в один ряд с поисковой строкой:

1.  **Селектор провайдера (Provider Select)**:
    *   Загружает список активных провайдеров через `adminProviderService.listProviders()`.
    *   Позволяет быстро вывести услуги только от конкретного поставщика API.
2.  **Селектор платформ (Network Select)**:
    *   Позволяет выбрать Telegram, VK, YouTube, Instagram.
    *   При выборе платформы список доступных категорий в левом сайдбаре автоматически сужается, убирая визуальный мусор.
3.  **Обновленная поисковая строка**:
    *   Placeholder меняется на: `🔍 Название услуги, внутренний ID или ID провайдера...`.

#### Шаг 3: Исправление UX страницы категорий (`/admin/catalog/categories`)
Для решения проблемы бесконечного скроллинга категорий внедряется ультра-легкий и мгновенный клиентский фильтр в компонент `CategoryManager`:
*   В верхней части панели категорий добавляется текстовое поле ввода: `<input type="text" placeholder="Быстрый поиск категории..." />`.
*   Фильтрация строк таблицы выполняется моментально на стороне клиента без запросов к серверу:
    ```typescript
    const filteredCategories = categories.filter(category => 
      category.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    ```
    Это полностью решает проблему когнитивной перегрузки администратора при работе со сложным многоуровневым деревом услуг.

---

## 7. Глубокий аудит каталога услуг, ценообразования и провайдерской интеграции (R6)

Управление каталогом услуг и ценообразованием в Smmplan — это ядро бизнес-логики платформы. Ошибки в расчётах, плохая эргономика отображения цен и отсутствие оперативного контроля за маржинальностью напрямую влияют на финансовые показатели компании (просадка маржи, торговля в убыток при колебаниях курсов валют) и приводят к выгоранию контент-менеджеров.

---

### 7.1. Юзабилити отображения цен и мультивалютные переключатели

#### 7.1.1. Анализ когнитивного трения операторов
Существующая модель интеграции с SMM-провайдерами (Perfect Panel, JustAnotherPanel и др.) создаёт постоянную умственную нагрузку на персонал из-за несовпадения базисов учета:
1. **Базис провайдера**: Тарифные сетки API провайдеров хранятся в **USD за 1000 единиц (USD / 1k)** (например, `$0.85 / 1000 шт.`).
2. **Базис Smmplan**: Внутренний учёт ведётся в **RUB**, а в клиентской части розничные цены отображаются **за 1 единицу (₽ / шт.)** (согласно жесткому требованию `AGENTS.md` о запрете вывода цен за 1000 шт. клиентам).

Когда администратор или оператор поддержки вручную настраивает каталог, сверяет цены с первоисточником или обрабатывает претензии клиентов, ему приходится в уме или на калькуляторе сопоставлять эти две шкалы:
$$\text{Розничная цена (копейки за 1 шт.)} = \frac{\text{Тариф провайдера (центы за 1к)} \times \text{Наценка (markup)} \times \text{Курс USD/RUB}}{1000}$$

Любое неверное округление или опечатка при делении на 1000 приводит к тому, что услуга продаётся дешевле себестоимости закупки.

#### 7.1.2. Проектирование мультивалютных и объемных переключателей
Для решения этой проблемы предлагается внедрить в верхнюю часть интерфейса каталога (`/admin/catalog`) и списка услуг (`/admin/services`) два компактных независимых переключателя (Toggles):

```
Валюта:      [ RUB ]  [ USD ]
Объем:       [ за 1 шт. ]  [ за 1000 шт. ]
```

Эти переключатели работают реактивно на клиенте, мгновенно пересчитывая все колонки цен в таблицах каталога и услуг на основе данных СУБД (курс доллара `usdToRub` и наценка `markup` услуги).

#### 7.1.3. Математические формулы пересчета
Пусть:
*   $R_{\text{usd\_1k}}$ — исходный тариф провайдера в USD за 1000 шт. (дробное число, например `0.85`).
*   $M$ — наценка услуги (markup, коэффициент, например `1.50`).
*   $E_{\text{usd\_to\_rub}}$ — текущий системный курс доллара к рублю (параметр `usdToRub`, например `92.50`).

Система рассчитывает 4 комбинации цен по следующим формулам с гарантированным отсутствием накопления погрешностей округления чисел с плавающей точкой в JS:

| Режим валюты | Режим объема | Формула расчета розничной цены ($P$) | Пример расчета для $R=0.85$, $M=1.5$, $E=92.5$ |
| :--- | :--- | :--- | :--- |
| **RUB** | **за 1 шт.** | $P = \frac{R_{\text{usd\_1k}} \times M \times E_{\text{usd\_to\_rub}}}{1000}$ | $P = \frac{0.85 \times 1.5 \times 92.5}{1000} = 0.1179$ ₽ / шт. |
| **RUB** | **за 1000 шт.**| $P = R_{\text{usd\_1k}} \times M \times E_{\text{usd\_to\_rub}}$ | $P = 0.85 \times 1.5 \times 92.5 = 117.94$ ₽ / 1к |
| **USD** | **за 1 шт.** | $P = \frac{R_{\text{usd\_1k}} \times M}{1000}$ | $P = \frac{0.85 \times 1.5}{1000} = 0.0013$ $ / шт. |
| **USD** | **за 1000 шт.**| $P = R_{\text{usd\_1k}} \times M$ | $P = 0.85 \times 1.5 = 1.28$ $ / 1к |

#### 7.1.4. Программная реализация форматирования цен с защитой точности
Для предотвращения багов арифметики с плавающей точкой на стороне клиента применяется специализированная функция форматирования:

```typescript
export function formatPriceWithZeroRounding({
  rateUsd1k,
  markup,
  usdToRub,
  currency,
  volume,
}: {
  rateUsd1k: number;
  markup: number;
  usdToRub: number;
  currency: 'RUB' | 'USD';
  volume: 'UNIT' | '1K';
}): string {
  // Вычисляем базовую стоимость за 1000 шт. в центах (копейках) выбранной валюты
  const multiplier = currency === 'RUB' ? usdToRub : 1.0;
  
  // Масштабируем до центов/копеек, округляем до целых для исключения float-погрешностей
  const basePriceCents1k = Math.round(rateUsd1k * markup * multiplier * 100);

  let finalValue: number;
  let fractionDigits: number;

  if (volume === 'UNIT') {
    // Для 1 штуки делим центы на 100000, получая дробь до 4 знаков после запятой в валютной единице
    finalValue = basePriceCents1k / 100000;
    fractionDigits = 4;
  } else {
    // Для 1000 штук делим центы на 100, получая стандартный двухзначный вывод
    finalValue = basePriceCents1k / 100;
    fractionDigits = 2;
  }

  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(finalValue) + (currency === 'RUB' ? ' ₽' : ' $');
}
```

---

### 7.2. Административный виджет-калькулятор цен (Staff Pricing Widget)

Для исключения ручных расчетов при создании и редактировании услуг (`ServiceEditModal`) в интерфейс админ-панели внедряется интерактивный виджет-калькулятор.

#### 7.2.1. UI-SPEC & API-SPEC Контракт
Виджет представляет собой форму с реактивными связями между полями ввода и блоком итоговых аналитических показателей:

```
[ Поля ввода ] ----------------------------------------------------
1. Ставка провайдера (USD/1k):   [ 0.85     ] $
2. Системный курс USD/RUB:       [ 92.50    ] ₽
3. Множитель наценки (markup):   [ 1.50     ] x
4. Маржинальность (margin %):    [ 33.33    ] %
5. Розничная цена (RUB/1k):      [ 117.94   ] ₽
6. Розничная цена (RUB/шт.):     [ 0.1179   ] ₽

[ Метрики эффективности ] -----------------------------------------
• Себестоимость закупки:   78.63 ₽ / 1000 шт.
• Чистая прибыль:          39.31 ₽ / 1000 шт.
• Коэффициент ROI:         50.00 %
• Чистая маржа (Net Margin): 33.33 %
```

#### 7.2.2. Двунаправленная реактивная синхронизация (Bidirectional Bindings)
Связи между элементами формы отслеживаются в реальном времени с помощью стейт-менеджера:

1. **Прямой расчет (Редактирование ставки, курса или наценки)**:
   При вводе пользователем в поля 1, 2, 3 или 4:
   *   `marginPercent` рассчитывается через `markup`:
       $$\text{marginPercent} = \left(1 - \frac{1}{\text{markup}}\right) \times 100$$
   *   `markup` рассчитывается через `marginPercent` (если редактировался процент маржи):
       $$\text{markup} = \frac{1}{1 - (\text{marginPercent} / 100)}$$
   *   `retailPrice1kRub` пересчитывается:
       $$\text{retailPrice1kRub} = \text{rateUsd1k} \times \text{markup} \times \text{usdToRub}$$
   *   `retailPriceUnitRub` обновляется:
       $$\text{retailPriceUnitRub} = \frac{\text{retailPrice1kRub}}{1000}$$

2. **Обратный расчет (Ручной ввод розничной цены)**:
   При вводе оператором желаемой цены продажи в поле 5 (`retailPrice1kRub`) или 6 (`retailPriceUnitRub`):
   *   Если изменено поле 6, значение поля 5 вычисляется как: `retailPrice1kRub = retailPriceUnitRub * 1000`.
   *   Коэффициент наценки (`markup`) автоматически пересчитывается в обратную сторону:
       $$\text{markup} = \frac{\text{retailPrice1kRub}}{\text{rateUsd1k} \times \text{usdToRub}}$$
   *   Процент маржинальности пересчитывается:
       $$\text{marginPercent} = \left(1 - \frac{\text{rateUsd1k} \times \text{usdToRub}}{\text{retailPrice1kRub}}\right) \times 100$$

#### 7.2.3. Защитные барьеры безопасности (Safety Guardrails)
Для защиты от случайного запуска убыточных услуг калькулятор реализует систему принудительной валидации:

1. **Блокировка отрицательной прибыли (Negative Margin Block)**:
   If чистая прибыль становится $\le 0$ (например, из-за опечатки в наценке или резкого подорожания тарифа закупки у провайдера):
   *   Контур полей цен и метрик окрашивается в пульсирующий ярко-красный цвет (`animate-pulse border-danger`).
   *   Выводится критическое предупреждение: **`❌ Ошибка! Цена продажи ниже себестоимости закупки. Убыток: X.XX ₽ / 1000 шт.`**
   *   Кнопка отправки формы «Сохранить изменения» переводится в режим `disabled`. Сохранение физически заблокировано.

2. **Предупреждение о нерентабельности эквайринга (Low Margin Warning)**:
   Если чистая маржа положительна, но составляет менее **5%** (эквайринговые комиссии платежных агрегаторов обычно составляют 3-5%, что делает такую услугу убыточной для компании после учета комиссий):
   *   Контур полей окрашивается в предупреждающий оранжевый цвет (`border-warning bg-warning/10`).
   *   Выводится предупреждение: **`⚠️ Внимание! Маржа ниже 5% (X.XX%). Доход от услуги может не покрыть комиссию платежной системы.`**
   *   Кнопка сохранения остается активной, но требует обязательного ручного подтверждения — установки чекбокса: `[x] Я подтверждаю запуск услуги с пониженной маржинальностью на свой страх и риск`.

---

### 7.3. Сортировка по маржинальности, динамические соцсети и оптимизация скролла

При масштабировании каталога услуг до 1000+ позиций критически падает скорость поиска нерентабельных или наиболее прибыльных услуг.

#### 7.3.1. Оптимизация Prisma-запросов для финансовой сортировки
В бэкенд-сервис `AdminCatalogService.listServices` (`src/services/admin/catalog.service.ts`) необходимо внедрить возможность упорядочивания данных по маржинальной прибыли и себестоимости.

Так как маржинальность является расчетным полем на базе динамического курса доллара, прямая сортировка методами ORM Prisma невозможна без денормализации данных. Предлагается два пути решения:

**Вариант А: Денормализация схемы БД (Рекомендуемый)**
Добавить в модель `Service` в файле `schema.prisma` два поля, автоматически обновляемых при любых изменениях цен и курсов:
```prisma
model Service {
  id            String   @id @default(cuid())
  // ... другие поля ...
  rate          Decimal  @db.Decimal(10, 4) // В USD
  markup        Decimal  @db.Decimal(10, 2) @default(1.50)
  
  // Денормализованные вычисляемые поля для быстрой индексированной сортировки
  costRub1k     Decimal  @db.Decimal(10, 2) @default(0.00) // rate * usdToRub
  priceRub1k    Decimal  @db.Decimal(10, 2) @default(0.00) // rate * markup * usdToRub
  netMarginRub  Decimal  @db.Decimal(10, 2) @default(0.00) // priceRub1k - costRub1k
  
  @@index([netMarginRub])
  @@index([costRub1k])
}
```
При изменении глобального курса `usdToRub` запускается фоновая задача (через `BullMQ`), пересчитывающая денормализованные поля для всего каталога. Это позволяет бэкенд-методу использовать сверхбыструю нативную пагинацию с сортировкой Prisma:

```typescript
// src/services/admin/catalog.service.ts
async listServices(params: ServiceListParams) {
  const orderBy: Record<string, 'asc' | 'desc'> = {};
  
  if (params.sortBy === 'netMargin') {
    orderBy.netMarginRub = params.sortOrder || 'desc';
  } else if (params.sortBy === 'providerCost') {
    orderBy.costRub1k = params.sortOrder || 'asc';
  } else {
    orderBy.numericId = 'asc';
  }

  return db.service.findMany({
    where: buildWhereClause(params),
    orderBy,
    take: params.pageSize || 50,
    skip: params.skip || 0,
    include: {
      category: true,
      provider: true
    }
  });
}
```

**Вариант Б: Прямой SQL-запрос (Raw Query) без изменения схемы**
Если изменение схемы нежелательно, вычисление и сортировка производятся «на лету» средствами СУБД PostgreSQL:
```typescript
const usdToRubSetting = await db.setting.findUnique({ where: { key: 'usdToRub' } });
const rate = parseFloat(usdToRubSetting?.value || '92.50');

const services = await db.$queryRaw`
  SELECT s.*, 
         (s.rate * s.markup * ${rate}) as "priceRub1k",
         (s.rate * ${rate}) as "costRub1k",
         ((s.rate * s.markup * ${rate}) - (s.rate * ${rate})) as "netMarginRub"
  FROM "Service" s
  ORDER BY 
    CASE WHEN ${params.sortBy} = 'netMargin' THEN ((s.rate * s.markup * ${rate}) - (s.rate * ${rate})) END DESC,
    CASE WHEN ${params.sortBy} = 'providerCost' THEN (s.rate * ${rate}) END ASC
  LIMIT ${params.pageSize} OFFSET ${params.offset};
`;
```

#### 7.3.2. Оптимизация интерфейса категорий и борьба со "стеной прокрутки"
Страница управления категориями (`/admin/catalog/categories`) при большом объёме услуг превращается в бесконечную ленту. Для борьбы с когнитивной перегрузкой оператора внедряются три UX-паттерна:

1. **Динамическая панель соцсетей (Platform Tabs & Filters)**:
   В верхнюю часть интерфейса добавляются интерактивные кнопки фильтрации по социальным сетям:
   ```
   [ Все ]  [ Telegram ]  [ VK ]  [ YouTube ]  [ Instagram ]
   ```
   Клиентская часть рендерит категории только выбранной платформы, моментально сокращая список на 80%.

2. **Клиентская виртуализация скролла (Scroll Virtualization)**:
   При рендеринге плотных списков категорий используется виртуализация на базе встроенных механизмов HeroUI v3 или библиотеки `@tanstack/react-virtual`. Браузер рендерит в DOM только те $\sim 10-15$ строк, которые попадают в зону видимости экрана оператора (Viewport). Это снижает количество DOM-нод с 3000 до 150, гарантируя плавный скроллинг без фризов со скоростью 60 FPS на любых устройствах.

3. **Сортировка категорий по плотности услуг**:
   Добавление быстрого переключателя сортировки категорий по количеству привязанных активных услуг. Это позволяет оператору в один клик увидеть "пустые" или перегруженные категории для оптимизации структуры каталога.

---

## 8. Архитектура докруток (Refills)

В процессе предоставления услуг накрутки в социальных сетях неизбежно возникают естественные списания (drop rate), вызванные чистками ботов и обновлением алгоритмов защитных систем платформ (таких как Telegram, VK, YouTube). Для обеспечения высокого удержания (retention) пользователей и минимизации операционной нагрузки на службу поддержки, Smmplan проектирует комплексную архитектуру **докруток (Refills)**. Архитектура включает два независимых сценария: автоматические докрутки по гарантии внешних провайдеров и внутренние компенсационные докрутки за счет прибыли платформы.

### 8.1. Сценарий A: Индустриальный Refill API (Гарантия Провайдера)

Индустриальным стандартом для SMM-панелей (Perfect Panel, JustAnotherPanel) является предоставление гарантийного периода (обычно 30 дней), в течение которого провайдер обязуется восстановить объем списаний бесплатно.

#### 8.1.1. Технический механизм и API-взаимодействие
Если для услуги активна гарантия (`hasRefill: true`), бэкенд Smmplan может отправить автоматический запрос докрутки к API провайдера, используя оригинальный идентификатор заказа (`externalId`). В рамках этого сценария себестоимость закупки (procurement cost) для Smmplan составляет **$0** (мы ничего не платим провайдеру).

**Схема полезной нагрузки (Request Payload) к API провайдера:**
```json
POST https://provider-api-url.com/api/v2
Content-Type: application/json

{
  "action": "refill",
  "key": "PROVIDER_API_KEY",
  "order": "externalId_12345"
}
```

При успешной отправке провайдер возвращает идентификатор транзакции докрутки (`refillId`):
```json
{
  "refill": "987654"
}
```

#### 8.1.2. Асинхронный опрос статуса докрутки (Polling) через BullMQ
Бэкенд сохраняет `refillId` в таблице `OrderRefill` со статусом `PENDING`. Для отслеживания прогресса используется фоновая очередь задач BullMQ (`refill-status-queue`):
1. **BullMQ Worker** периодически запускает задачу опроса статуса докрутки.
2. Отправляет запрос к API провайдера для получения статуса докрутки по идентификаторам:
   ```json
   POST https://provider-api-url.com/api/v2
   {
     "action": "refill_status",
     "key": "PROVIDER_API_KEY",
     "refill": "987654"
   }
   ```
3. Провайдер возвращает состояние, например:
   * `"status": "pending"` / `"processing"` $\rightarrow$ задача планируется в BullMQ повторно через 10 минут.
   * `"status": "completed"` $\rightarrow$ статус докрутки обновляется на `COMPLETED`, фиксируется дата завершения.
   * `"status": "rejected"` $\rightarrow$ статус меняется на `REJECTED`, оператору выводится лог ошибки провайдера.

---

### 8.2. Сценарий B: Ручная компенсационная докрутка от поддержки (Free Compensatory Order)

Если гарантийный период провайдера истек, или если провайдер отклонил автоматическую докрутку по Сценарию A, но лояльность клиента критически важна, оператор поддержки может инициировать ручную компенсационную докрутку.

#### 8.2.1. Техническая реализация и древовидная структура в СУБД
Для клиента компенсация выглядит как бесплатная докрутка, однако бэкенд Smmplan оплачивает её из собственного кармана (маржинальной прибыли компании), отправляя провайдеру новый стандартный заказ по оптовому тарифу закупки (Wholesale Rate в USD).

В базе данных PostgreSQL это реализуется с помощью рекурсивного отношения «родитель-потомок» в таблице `Order`:
* Розничная цена для клиента (`charge`) устанавливается в **0.00 RUB**.
* Поля `providerCost` и `rate` фиксируются по стандартной оптовой ставке закупки провайдера в USD.
* Поле `parentOrderId` ссылается на оригинальный заказ, создавая четкую иерархическую структуру дерева заказов.

**Prisma Schema Relation:**
```prisma
model Order {
  id              String   @id @default(cuid())
  numericId       Int      @unique @default(autoincrement())
  userId          String
  serviceId       String
  quantity        Int
  charge          Decimal  @db.Decimal(10, 2) @default(0.00) // 0 RUB для компенсации
  providerCost    Decimal? @db.Decimal(10, 4) // Себестоимость закупки из прибыли Smmplan
  status          OrderStatus @default(PENDING)
  
  // Иерархия для компенсаций и докруток
  parentOrderId   String?
  parentOrder     Order?   @relation("OrderHierarchy", fields: [parentOrderId], references: [id], onDelete: Cascade)
  childOrders     Order[]  @relation("OrderHierarchy")

  @@index([parentOrderId])
}
```

Эта схема позволяет легко строить цепочку докруток в интерфейсе и вести точный учет финансовых потерь компании на рекламации.

---

### 8.3. Защита от фрода операторов (Security & Audit)

Предоставление операторам поддержки инструментов запуска бесплатных заказов (даже с розничной ценой 0 RUB) создает высокий риск злоупотреблений и сговора. Для предотвращения внутреннего фрода внедряется четыре эшелона защиты:

#### 8.3.1. Персональные лимиты бюджетов (Staff Budget Limits)
Каждому оператору техподдержки (`User` с ролью `SUPPORT`) в базе данных выделяются суточный (`dailyLimitCents`) и месячный (`monthlyLimitCents`) балансы компенсаций.
* При создании компенсационной докрутки (Сценарий B) бэкенд рассчитывает себестоимость закупки:
  $$\text{Затраты оператора} = \text{wholesaleRate} \times \frac{\text{quantity}}{1000}$$
* Данная сумма в центах списывается с личного лимита оператора `supportLimitCents`.
* Если лимит исчерпан, Server Action мгновенно отклоняет операцию и требует аппрува от главного администратора (`ADMIN`).

#### 8.3.2. Жесткие лимиты на объемы (Quantity Overrun Checks)
Суммарное количество всех докрученных единиц по Сценариям A и B для конкретного заказа **никогда** не может превышать исходное заказанное количество с учетом уже выполненного объема:
$$\sum \text{refillQuantity} \le \text{originalQuantity} - \text{remains}$$
* *Пример*: Если клиент заказал 1000 подписчиков, статус заказа `Completed`, но осталось `remains = 200` (доставлено 800), то лимит разовой докрутки составляет строго 200 единиц.
* Попытка заказать докрутку объемом более 200 единиц будет заблокирована на уровне серверной валидации.

#### 8.3.3. Разграничение прав доступа (Role-Based Access Control)
Запуск процедур докруток требует проверки привилегий:
* Для Сценария А (бесплатного): Вызов `requireStaffPermission('support', 'edit')` или наличие права `ORDER_REFILL`.
* Для Сценария B (платного для компании): Вызов `requireStaffPermission('support', 'compensate')` or a custom `ORDER_COMPENSATE` privilege.

#### 8.3.4. Сквозное логирование (Audit Trail Ledger)
Каждое действие по докрутке фиксируется в системном реестре аудита `AdminAuditLog` с привязкой к ID оператора:
* **Типы событий**: `REFILL_PROVIDER_REQUEST` (для сценария А) или `REFILL_COMPENSATORY_CREATE` (для сценария B).
* **Сведения**: Логируется ID оператора, ID исходного и дочернего заказов, объем, себестоимость списания из лимита и текстовое обоснование (из тикета поддержки).

---

### 8.4. Визуализация в UI панели управления

Интеграция докруток в интерфейс панели администратора и поддержки должна минимизировать число переходов и давать полную контекстную картину.

#### 8.4.1. Единый реестр в табе «Докрутки»
Внутри карточки просмотра заказа (`OrderDrawer`) и на странице тикета клиента (`/admin/tickets/[id]`) рендерится вкладка **«Докрутки / Компенсации»**. Вся история докруток выводится в виде единой структурированной таблицы с использованием компонентов HeroUI v3:

* **Индикаторы типов (Badges)**:
  * `[Гарантия API (Сценарий А)]` — `variant="flat" color="primary"` (синий бейдж).
  * `[Компенсация (Сценарий B)]` — `variant="flat" color="secondary"` (пурпурный бейдж).
* **Колонки таблицы**:
  1. **Тип и Дата**: Бейдж сценария + дата создания докрутки.
  2. **Инициатор**: Ссылка на профиль оператора, запустившего процесс.
  3. **Объем**: Указание докручиваемого объема (например, `200 / 1 000 шт.`).
  4. **Финансовый списание**: Себестоимость для Smmplan (например, `$0.00` или `$0.17` списано из лимита оператора).
  5. **Текущий статус**: Динамический статус выполнения с анимацией загрузки (`spinners` для `PENDING` статусов).

#### 8.4.2. Бесшовная кросс-навигация
Для ускорения работы оператора в каждую строку таблицы докруток интегрированы сквозные ссылки быстрого перехода:
* **Переход к оригиналу**: При клике на ID родительского заказа в боковой панели выдвигается Drawer оригинального заказа без смены вкладки.
* **Переход к тикету**: Интерактивная иконка чата `ChatIcon` ведет на `/admin/tickets/[id]` — в чат, из которого была инициирована компенсация.
* **Переход к профилю клиента**: Быстрая ссылка на карточку пользователя для просмотра его LTV и общей истории пополнений.
* **Переход к транзакции**: Если это компенсация B, показывается ссылка на системную транзакцию списания баланса провайдера.

---

## 9. Дополнительный инженерный анализ рисков и архитектурные решения (Adversarial Engineering Risks & Mitigations)

В процессе проектирования и ревью архитектуры административной панели Smmplan были выявлены критические инженерные риски, способные привести к деградации производительности СУБД, рассинхронизации клиентского состояния при высокой интенсивности работы операторов и финансовым потерям компании при некорректном выполнении докруток и компенсаций. Ниже приведен детальный анализ данных рисков и предложены оптимальные архитектурные решения для их нейтрализации.

### 9.1. Конкурентные ошибки Serializable-транзакций (SQLState 40001 / 40P01)

#### 9.1.1. Анализ риска
Применение максимального уровня изоляции транзакций `Serializable` в СУБД PostgreSQL является золотым стандартом для предотвращения аномалий «фантомного чтения» (phantom read) и «несогласованной записи» (write skew) при проведении финансовых мутаций (например, списания баланса пользователя и начисления компенсаций). Однако при высокой параллельной активности операторов технической поддержки транзакции компенсации могут пересекаться по диапазонам считываемых или изменяемых строк. В таких случаях PostgreSQL принудительно прерывает одну из транзакций, возвращая ошибку сериализации с кодом ошибки `SQLState 40001` (Serialization Failure) или `40P01` (Deadlock Detected). Без системного механизма автоматического восстановления это приведет к падению Server Actions и выводу ошибок в интерфейс оператора, вызывая повторные клики и дублирование операций.

#### 9.1.2. Архитектурное решение: Декоратор `transactionalRetry`
Для решения этой проблемы все Server Actions, выполняющие финансовые мутации и изменяющие балансы, оборачиваются в отказоустойчивый хелпер автоматического повтора транзакций с механизмом экспоненциальной задержки (exponential backoff) и случайного отклонения (jitter) для предотвращения эффекта «грохочущего стада» (thundering herd):

```typescript
// src/utils/transaction-retry.ts
import { Prisma } from '@prisma/client';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 50;

export async function transactionalRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // Проверяем коды ошибок PostgreSQL: 40001 (serialization failure), 40P01 (deadlock)
    const isSerializationError =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2034' || // Transaction failed due to write conflict
       error.message?.includes('40001') ||
       error.message?.includes('40P01'));

    if (isSerializationError && retries > 0) {
      // Вычисляем экспоненциальную задержку с джиттером: delay = base * 2^attempt + random_jitter
      const attempt = MAX_RETRIES - retries;
      const delay = Math.round(
        BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * BASE_DELAY_MS
      );
      
      console.warn(
        `[Serializable Conflict] Retrying transaction... Attempts left: ${retries}. Delay: ${delay}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return transactionalRetry(fn, retries - 1);
    }
    throw error;
  }
}
```

Все вызовы Prisma в Server Actions списания/начисления балансов оборачиваются следующим образом:
```typescript
const result = await transactionalRetry(async () => {
  return await db.$transaction(async (tx) => {
    // Финансовые операции с изоляцией Serializable
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
});
```

---

### 9.2. Рассинхронизация Drawer при динамической смене URL

#### 9.2.1. Анализ риска
При использовании Next.js shallow routing в ленте тикетов оператор может переключаться между различными тикетами и привязанными к ним заказами в Drawer без полной перезагрузки страницы. При этом URL динамически обновляется (например, добавляется `?edit_order_id=CUID`), но локальный проп `initialSelectedOrder`, переданный сервером при первой загрузке, остается неизменным или рассинхронизируется с текущим URL из-за особенностей кеширования клиентского роутера Next.js App Router. Если выбранного заказа нет в текущем порционном срезе данных страницы (`data` массив в `OrderClient`), то в стейт запишется `null`, и Drawer либо откроется пустым, либо покажет некорректные данные предыдущего заказа.

#### 9.2.2. Архитектурное решение: Ленивый фоллбек (Lazy-Fetch Fallback)
Для гарантированного устранения рассинхронизации в клиентском компоненте `OrderClient` перестраивается логика инициализации заказа. При отсутствии требуемого `edit_order_id` в массиве локальных данных запускается ленивый асинхронный фоллбек-запрос к бэкенду через Server Action `fetchOrderDetailsAction`:

```typescript
// Внутри src/app/admin/orders/components/order-client.tsx
const [selectedOrder, setSelectedOrder] = useState<OrderColumn | null>(null);
const [isLazyLoading, setIsLazyLoading] = useState(false);

React.useEffect(() => {
  let isMounted = true;

  async function resolveOrder() {
    if (!editOrderId) {
      setSelectedOrder(null);
      return;
    }

    // Сценарий 1: Заказ передан сервером и совпадает с URL
    if (initialSelectedOrder && initialSelectedOrder.id === editOrderId) {
      setSelectedOrder(initialSelectedOrder);
      return;
    }

    // Сценарий 2: Ищем в локальном массиве данных текущей страницы
    const localFound = data.find((o) => o.id === editOrderId);
    if (localFound) {
      setSelectedOrder(localFound);
      return;
    }

    // Сценарий 3: Асинхронный ленивый запрос (Lazy-Fetch) при рассинхронизации
    setIsLazyLoading(true);
    try {
      const response = await fetchOrderDetailsAction(editOrderId);
      if (isMounted && response.success && response.data) {
        setSelectedOrder(response.data as unknown as OrderColumn);
      } else if (isMounted) {
        setSelectedOrder(null);
      }
    } catch (err) {
      console.error('Failed to lazy-fetch order details:', err);
      if (isMounted) setSelectedOrder(null);
    } finally {
      if (isMounted) setIsLazyLoading(false);
    }
  }

  resolveOrder();

  return () => {
    isMounted = false;
  };
}, [data, editOrderId, initialSelectedOrder]);
```

---

### 9.3. Блокировки таблицы `Service` при массовом пересчете наценки

#### 9.3.1. Анализ риска
При резких колебаниях курса валют (USD/RUB) система обязана произвести пересчет розничных цен каталога для сохранения маржинальности платформы. В денормализованной архитектуре (Вариант А из п. 7.3.1) это требует массового обновления полей `costRub1k`, `priceRub1k` и `netMarginRub` для всех активных услуг в таблице `Service`. Выполнение единой массивной транзакции для тысяч записей приводит к длительным блокировкам строк (Row-Level Locking) и страниц таблицы, что парализует работу пользователей: клиенты не могут создавать новые заказы (блокировка внешнего ключа `serviceId`), а фоновые воркеры BullMQ «зависают» при попытке прочитать параметры услуг.

#### 9.3.2. Архитектурное решение: Батчевые обновления и PostgreSQL Views
Для нейтрализации риска блокировок применяются две альтернативные стратегии в зависимости от требований к производительности чтения:

1. **Пакетные обновления (Baton/Batching)**:
   Фоновый воркер пересчета разбивает весь объем услуг на неблокирующие пакеты по 50 записей. Каждая порция выполняется в отдельной независимой транзакции с короткими паузами между батчами (`sleep(20)`), освобождая ресурсы СУБД для пользовательских запросов:

   ```typescript
   // src/workers/pricing-sync.ts
   export async function updateCatalogPricesInBatches(usdToRub: number) {
     const services = await db.service.findMany({ select: { id: true, rate: true, markup: true } });
     
     for (let i = 0; i < services.length; i += 50) {
       const batch = services.slice(i, i + 50);
       
       await db.$transaction(
         batch.map((service) => {
           const costRub1k = Number(service.rate) * usdToRub;
           const priceRub1k = Number(service.rate) * Number(service.markup) * usdToRub;
           const netMarginRub = priceRub1k - costRub1k;
           
           return db.service.update({
             where: { id: service.id },
             data: { costRub1k, priceRub1k, netMarginRub },
           });
         })
       );
       
       // Микро-пауза для высвобождения пула соединений PostgreSQL
       await new Promise((resolve) => setTimeout(resolve, 20));
     }
   }
   ```

2. **Динамические представления СУБД (PostgreSQL Database Views)**:
   Для исключения необходимости денормализации полей и фонового пересчета создается оптимизированное динамическое представление (View) с поддержкой индексов для мгновенного расчетного вывода без блокировок таблицы:
   
   ```sql
   CREATE VIEW "ServiceFinancials" AS
   SELECT 
     s.id as "serviceId",
     s.rate * (SELECT CAST(value AS DECIMAL(10,4)) FROM "Setting" WHERE key = 'usdToRub') as "costRub1k",
     s.rate * s.markup * (SELECT CAST(value AS DECIMAL(10,4)) FROM "Setting" WHERE key = 'usdToRub') as "priceRub1k",
     (s.rate * s.markup * (SELECT CAST(value AS DECIMAL(10,4)) FROM "Setting" WHERE key = 'usdToRub')) - 
     (s.rate * (SELECT CAST(value AS DECIMAL(10,4)) FROM "Setting" WHERE key = 'usdToRub')) as "netMarginRub"
   FROM "Service" s;
   ```
   Сортировка в каталоге в этом случае осуществляется через простой `LEFT JOIN` с данным представлением по ключу `id`.

---

### 9.4. Ограничения состояний для запуска докруток (State Guards)

#### 9.4.1. Анализ риска
Запуск гарантийных докруток (API Refill - Сценарий А) или ручных компенсаций (Сценарий В) на заказах, находящихся в промежуточных статусах (`PENDING`, `IN_PROGRESS`, `PROCESSING`) или отмененных пользователем (`CANCELLED`, `REFUNDED`), ведет к множественным багам:
* Утечка бюджетов платформы (повторные закупки услуг у провайдеров, которые не могут быть выполнены).
* Блокировки и баны аккаунтов со стороны провайдеров за отправку некорректных Refill-запросов к API.
* Внутренний рассинхрон состояния в базе данных (одновременное выполнение исходного заказа и докрутки).

#### 9.4.2. Архитектурное решение: Серверные State Guards
На уровне валидации бэкенда при вызове Server Actions создания докруток (`createRefillAction` и `createCompensatoryAction`) внедряется жесткий барьер контроля состояний (State Guard), запрещающий инициализацию процессов, если статус оригинального заказа не находится в финальных разрешенных состояниях (`COMPLETED` или `PARTIAL`):

```typescript
// src/validators/state-guards.ts
import { OrderStatus } from '@prisma/client';

const ALLOWED_REFILL_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.PARTIAL
];

export function validateOrderStateForRefill(originalOrder: {
  status: OrderStatus;
  remains: number;
  quantity: number;
}) {
  // Guard 1: Проверка статуса оригинального заказа
  if (!ALLOWED_REFILL_STATUSES.includes(originalOrder.status)) {
    return {
      isValid: false,
      error: `Невозможно запустить докрутку. Текущий статус заказа (${originalOrder.status}) не завершен. Разрешенные статусы: COMPLETED, PARTIAL.`
    };
  }

  // Guard 2: Проверка наличия списаний (remains)
  if (originalOrder.remains >= originalOrder.quantity) {
    return {
      isValid: false,
      error: 'Невозможно запустить докрутку. Доставка по оригинальному заказу не была начата (остаток равен объему заказа).'
    };
  }

  return { isValid: true };
}
```

Все серверные операции докруток в обязательном порядке выполняют данную проверку на первом шаге транзакции.

---

### 9.5. Оповещения о балансе оптовых аккаунтов провайдеров

#### 9.5.1. Анализ риска
Ручные компенсационные докрутки (Сценарий B) выполняются за счет средств Smmplan путем закупки нового оптового заказа у поставщика по API. Если на балансе оптового аккаунта платформы на стороне провайдера (например, в кабинете JustAnotherPanel) недостаточно средств, API провайдера вернет ошибку `Not enough funds` или `Low balance`. В этом случае заказ зависнет в системе со статусом `Error`, клиент не получит компенсацию вовремя, поддержка потеряет время на повторный ручной разбор тикета, а лояльность пользователя резко снизится.

#### 9.5.2. Архитектурное решение: Фоновый мониторинг баланса и Alert-система
Для предотвращения таких инцидентов в систему интегрируется служба фонового периодического аудита балансов провайдеров с отправкой мгновенных оповещений (Alerts) в Slack/Telegram-каналы технической поддержки при преодолении критических пороговых значений:

```typescript
// src/services/provider-monitor.service.ts
import { db } from '@/lib/db';
import { sendTelegramAlert, sendSlackAlert } from '@/lib/alerts';

const CRITICAL_BALANCE_LIMIT_USD = 50.00;

export async function checkProviderBalancesAndAlert() {
  const activeProviders = await db.provider.findMany({
    where: { isActive: true }
  });

  for (const provider of activeProviders) {
    try {
      const balanceUsd = await fetchProviderBalanceFromApi(provider);
      
      await db.provider.update({
        where: { id: provider.id },
        data: { lastKnownBalance: balanceUsd, balanceUpdatedAt: new Date() }
      });

      if (balanceUsd < CRITICAL_BALANCE_LIMIT_USD) {
        const alertMessage = 
          `🚨 [КРИТИЧЕСКИЙ БАЛАНС] У провайдера "${provider.name}" (ID: ${provider.id}) ` +
          `заканчиваются средства! Текущий баланс: $${balanceUsd.toFixed(2)}. ` +
          `Порог оповещения: $${CRITICAL_BALANCE_LIMIT_USD.toFixed(2)}. ` +
          `Немедленно пополните оптовый счет для предотвращения отказов авто-докруток и компенсаций!`;
        
        await Promise.all([
          sendTelegramAlert(alertMessage),
          sendSlackAlert(alertMessage)
        ]);
      }
    } catch (error) {
      console.error(`Failed to audit balance for provider ${provider.name}:`, error);
    }
  }
}
```

Эта задача регистрируется в планировщике фонового демона (`Cron` / `BullMQ`) с частотой запуска раз в 1 час, гарантируя постоянную информированность руководства и админов о состоянии счетов.

---

## Заключение

Внедрение рекомендаций данного аудита позволит:
1.  **Устранить критические баги переходов (Bug A и Bug B)**, из-за которых операторы ежедневно теряли время на ручной поиск заказов и клиентов.
2.  **Повысить конверсию работы поддержки**, обеспечив бесшовное управление заказами прямо в чате тикета через вызов переиспользуемого `OrderDrawer`.
3.  **Оптимизировать управление закупками услуг**, предоставив администратору мощный инструментарий сквозной фильтрации каталога по соцсетям, провайдерам и оригинальным провайдерским ID услуг (`externalId`).
4.  **Улучшить математическую читаемость финансовых таблиц**, выровняв денежные и численные колонки по правому краю, а также внедрив явную розничную цену за единицу товара.
5.  **Обеспечить абсолютную безопасность** ручных корректировок баланса благодаря транзакционной модели бэкенда с использованием изоляции `Serializable` и уникальных ключей идемпотентности.
6.  **Минимизировать риски просадки маржинальности (R6)** при резких колебаниях курсов валют за счет мультивалютных фильтров, динамического калькулятора цен в модальном окне услуги с системой автоматической блокировки отрицательной/низкой маржи, а также сортировки каталога по чистой прибыли.
7.  **Повысить производительность работы оператора**, избавив интерфейс категорий от бесконечного скроллинга с помощью фильтров платформ и виртуализации рендеринга.
