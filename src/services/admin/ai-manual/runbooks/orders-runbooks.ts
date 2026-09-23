import type { AdminRunbook } from '@/types/admin-ai-manual';

export const ORDERS_RUNBOOKS: AdminRunbook[] = [
  {
    id: 'orders-failover',
    chapterNumber: 3,
    chapterTitle: 'Заказы и Воркеры',
    title: 'Обработка сбоев, Drip-Feed Floor инвариант и безопасный возврат средств',
    targetRoute: '/admin/orders',
    summary: 'Регламент диспетчеризации очередей BullMQ, контроля Drip-Feed запусков, failover-перемаршрутизации и рефандов.',
    estimatedMinutes: 6,
    tags: ['заказы', 'bullmq', 'drip-feed', 'failover', 'возврат', 'воркеры'],
    relatedFiles: [
      'src/services/orders/checkout-pipeline.service.ts',
      'src/workers/processors/order.processor.ts',
      'src/services/admin/order/order-status-mutator.service.ts',
      'src/lib/wallet/ops.ts',
    ],
    scopeAndObjectives:
      'Определяет порядок управления жизненным циклом заказов в асинхронных очередях Redis/BullMQ, обеспечение целостности расписания Drip-Feed запусков, переключение на резервные маршруты провайдеров и безопасный возврат средств клиенту при неисполнении.',
    termsAndDefinitions: [
      {
        term: 'Drip-Feed Floor Invariant',
        definition: 'Математический инвариант: объем каждого запуска ⌊quantity / runs⌋ обязан быть строго ≥ service.minQty. Суммарный объем заказа в UI и на бэкенде обязан быть ≥ service.minQty * runs.',
      },
      {
        term: 'BullMQ Dead-Letter Queue (DLQ)',
        definition: 'Очередь безнадежно сбойных задач после исчерпания лимита попыток (maxAttempts: 3), требующих ручного вмешательства оператора.',
      },
      {
        term: 'Failover Route (Резервный маршрут)',
        definition: 'Автоматическое или ручное перенаправление заказа резервному провайдеру при падении или таймауте основного шлюза.',
      },
      {
        term: 'Partial Refund (Частичный возврат)',
        definition: 'Возврат средств строго за невыполненную часть заказа при отмене поставщиком (remains > 0) с пересчетом в копейках BigInt.',
      },
    ],
    technicalArchitecture: {
      prismaTables: ['Order', 'OrderItem', 'Provider', 'LedgerEntry', 'User'],
      serverActions: ['retryOrderAction', 'cancelOrderWithRefundAction', 'reassignProviderAction'],
      level1Services: ['checkoutPipelineService', 'orderDispatchExecutor', 'orderRouteEvaluator', 'walletOps'],
      description: 'Конвейер исполнения: API/Checkout -> BullMQ Job -> OrderProcessor -> Внешний провайдер -> Webhook/Poller -> Завершение или Failover/Refund.',
    },
    steps: [
      {
        stepNumber: 1,
        title: 'Фильтрация инцидентных заказов',
        instruction: 'Перейдите в реестр заказов (/admin/orders) и отфильтруйте список по статусу ERROR, CANCELING или STALLED.',
        actionUrl: '/admin/orders',
        actionLabel: 'Реестр заказов',
      },
      {
        stepNumber: 2,
        title: 'Инспекция телеметрии и ошибки внешнего API',
        instruction: 'Кликните на заказ для открытия детализации. Ознакомьтесь с HTTP-кодом ответа провайдера, логом попыток и остатком (remains).',
      },
      {
        stepNumber: 3,
        title: 'Выбор стратегии восстановления (Failover vs Cancel)',
        instruction: 'Если услуга доступна у резервного поставщика, нажмите "Повторить через другой шлюз". При недоступности выберите "Отменить с возвратом".',
      },
      {
        stepNumber: 4,
        title: 'Контроль балансового возврата',
        instruction: 'Убедитесь, что средства возвращены клиенту через WalletOps.refund() с генерацией проводки REFUND в LedgerEntry.',
      },
    ],
    protectiveMechanisms: [
      {
        title: 'Drip-Feed Floor Guard',
        description: 'Валидатор чекаута блокирует создание Drip-Feed расписания, если объем отдельной пачки опускается ниже минимального порога провайдера.',
        ruleCode: 'ORD-DRIP-FLOOR-MIN',
      },
      {
        title: 'Circuit Breaker на уровне провайдера',
        description: 'При получении 5 последовательных сетевых ошибок от провайдера шлюз временно изолируется на 60 секунд, предотвращая каскадные сбои.',
        ruleCode: 'ORD-CIRCUIT-BREAKER',
      },
      {
        title: 'Идемпотентная отмена с блокировкой гонок',
        description: 'Отмена заказа защищена строгой проверкой текущего статуса (Optimistic Lock). Повторный рефанд одной и той же суммы невозможен.',
        ruleCode: 'ORD-IDEMPOTENT-REFUND',
      },
    ],
    troubleshooting: [
      {
        scenario: 'Зависание задачи в очереди BullMQ (Stalled Job)',
        symptoms: 'Заказ находится в статусе PROCESSING более 30 минут без обновления статуса от поставщика.',
        remedy: 'Откройте дашборд воркеров (/admin/system/queues). Выполните команду "Force Sync Provider Status". При отсутствии заказа на стороне провайдера произведите отмену.',
        files: ['src/workers/processors/order.processor.ts', 'src/services/admin/order/order-provider-sync.service.ts'],
      },
      {
        scenario: 'Ошибка "Order volume violates Drip-Feed Floor"',
        symptoms: 'Клиент жалуется на ошибку при оформлении Drip-Feed на 10 запусков.',
        remedy: 'Проверьте параметр minQty выбранной услуги. Убедитесь, что общий объем кратен количеству запусков и каждый запуск удовлетворяет лимиту провайдера.',
        files: ['src/components/orders/sub/summary/order-summary-preflight.ts'],
      },
    ],
  },
];
