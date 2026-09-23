/**
 * Interactive Textbook Chapters: Part 1
 * Domains: ARCH, DASHBOARD, ORDERS
 */

import { TextbookChapter } from '../types';

export const CHAPTERS_PART_1: TextbookChapter[] = [
  {
    id: 'arch-topology',
    domainId: 'ARCH',
    volumeNumber: 1,
    chapterNumber: 1,
    title: 'Архитектурный базис и мульти-тенантность',
    subtitle: 'Топология Next.js 16, Next/App Router, Prisma 5, Redis и изоляция брендов SMMplan & SMMflux',
    readTimeMinutes: 8,
    iconName: 'Cpu',
    targetRoute: '/admin/settings',
    section1Scope: 'Настоящая глава определяет инженерную топологию платформы OmniSMM 1.0, правила разделения слоев Clean Architecture, мульти-тенантную изоляцию и криптографическую защиту секретов.',
    section2Terms: [
      { term: 'OmniSMM 1.0', definition: 'Единый движок управления, обслуживающий витрины SMMplan (smmplan.pro) и SMMflux (smmflux.ru).' },
      { term: 'Tailscale Funnel', definition: 'Официальный сетевой туннель платформы, стабильно проксирующий трафик на порт 3000.' },
      { term: 'AES-256-GCM Vault', definition: 'Аппаратное криптографическое хранилище ключей провайдеров и платежных шлюзов в SystemSettings.' },
    ],
    section3Architecture: {
      description: 'Чистая архитектура с изоляцией слоев: Presentation (Next.js 16 App Router) -> Application (Server Actions) -> Domain (Pure Level 1 Services) -> Infrastructure (Prisma 5 / Redis).',
      diagramType: 'TOPOLOGY',
      coreTables: ['SystemSettings', 'User', 'Tenant', 'StaffRole'],
      coreActions: ['settings-update.action.ts', 'settings-diagnostics.action.ts'],
    },
    section4Walkthrough: {
      steps: [
        { stepNumber: 1, title: 'Проверка сетевого биндинга', description: 'Убедитесь, что сервер запущен с HOSTNAME="0.0.0.0" и портом 3000.', actionUrl: '/admin/settings?tab=system', actionLabel: 'Проверить системный статус' },
        { stepNumber: 2, title: 'Проверка глобального переключателя сайтов', description: 'Используйте GlobalSiteSwitcher в хедере админки для переключения между smmplan и flux.', actionUrl: '/admin/dashboard', actionLabel: 'Открыть дашборд' },
        { stepNumber: 3, title: 'Аудит ролей RBAC', description: 'Проверьте права операторов через матрицу из 16 гранулярных разрешений в настройках команды.', actionUrl: '/admin/settings/team', actionLabel: 'Команда и доступы' },
      ],
    },
    section5Safeguards: {
      rules: [
        { code: 'RULE-ARCH-01', name: 'Запрет use server в page.tsx', description: 'Директива use server в файлах страниц вызывает краш Turbopack.' },
        { code: 'RULE-ARCH-02', name: 'Изоляция ст. 54.1 НК РФ', description: 'Запрещено смешивать балансы и заказы между брендами SMMplan и SMMflux.' },
      ],
    },
    section6Troubleshooting: [
      { scenario: 'Сбой туннеля Tailscale', symptoms: 'Внешние вебхуки не доходят, статус 502/504', solution: 'Выполнить перезапуск funnels: tailscale funnel status и проверить порт 3000.', emergencyCommand: 'tailscale funnel --bg 3000' },
    ],
    callouts: [
      { type: 'CRITICAL', title: 'Запрет In-Place Production Rebuild', content: 'Пересборка контейнеров на бою запрещена. Используйте Blue-Green пайплайн со стейджем на порту 3005.' },
      { type: 'TIP', title: 'Zero-Wait кэширование', content: 'unstable_cache обязан содержать префикс tenantId (например: catalog-smmplan).' },
    ],
    screenshot: {
      src: '/manual/screenshots/08_stage_manual_inspector_status.png',
      caption: 'Рис. 1.1 — Инспектор архитектуры, статус моделей Prisma и проверка целостности ADR-2026-20',
      altText: 'Инспектор архитектуры OmniSMM 1.0',
      hotspots: [
        { badgeNumber: 1, xPercent: 20, yPercent: 28, title: 'Модели Prisma & Реплики', description: 'Инспектор целостности схемы PostgreSQL, пула подключений и транзакций ACID' },
        { badgeNumber: 2, xPercent: 55, yPercent: 28, title: 'Контроль ADR-2026-20', description: 'Автоматический аудит архитектурных решений, слоев и чистоты зависимостей' },
        { badgeNumber: 3, xPercent: 82, yPercent: 18, title: 'Статус Tailscale Funnel', description: 'Официальный сетевой туннель платформы: порт 3000, 200 OK' },
      ],
    },
    checklist: [
      { id: 'arch-1', title: 'Проверить доступность Tailscale Funnel', detail: 'Проверить статус узла в консоли' },
      { id: 'arch-2', title: 'Проверить изоляцию куки x_admin_tenant', detail: 'Убедиться в переключении витрин без сброса сессии' },
    ],
    tags: ['Next.js 16', 'Clean Architecture', 'Tailscale', 'Multi-Tenant', 'Vault'],
  },
  {
    id: 'dashboard-kpi',
    domainId: 'DASHBOARD',
    volumeNumber: 2,
    chapterNumber: 6,
    title: 'Главный пульт аналитики и юнит-экономика',
    subtitle: 'Сквозная финансовая математика: Gross, COGS, Net Profit, обязательства (Liabilities) и очереди BullMQ',
    readTimeMinutes: 7,
    iconName: 'BarChart3',
    targetRoute: '/admin/dashboard',
    section1Scope: 'Глава регламентирует правила интерпретации ключевых показателей эффективности (KPI), мониторинга казначейского покрытия и очередей исполнения заказов.',
    section2Terms: [
      { term: 'Gross Revenue', definition: 'Суммарный объем входящих платежей от клиентов до вычета эквайринга.' },
      { term: 'COGS', definition: 'Cost of Goods Sold — прямая себестоимость, списанная оптовыми провайдерами API.' },
      { term: 'Liabilities', definition: 'Суммарные обязательства платформы: совокупный баланс всех пользователей в копейках BigInt.' },
    ],
    section3Architecture: {
      description: 'Агрегатор дашборда собирает телеметрию в реальном времени из PostgreSQL через оптимизированные индексы, а также метрики очередей BullMQ из Redis.',
      diagramType: 'TOPOLOGY',
      coreTables: ['Order', 'LedgerEntry', 'User', 'Payment'],
      coreActions: ['getExecutiveDashboardAction'],
    },
    section4Walkthrough: {
      steps: [
        { stepNumber: 1, title: 'Анализ P&L за смену', description: 'Оцените маржинальность смены (Gross минус COGS минус эквайринг минус налог УСН).', actionUrl: '/admin/dashboard', actionLabel: 'Открыть метрики P&L' },
        { stepNumber: 2, title: 'Контроль коэффициента покрытия', description: 'Сравните остатки на счетах провайдеров с суммой клиентских обязательств (Liabilities).', actionUrl: '/admin/finance/treasury', actionLabel: 'Казначейство' },
        { stepNumber: 3, title: 'Проверка очередей BullMQ', description: 'Убедитесь, что очереди order-dispatch и status-sync не имеют зависших задач в статусе failed.', actionUrl: '/admin/settings?tab=queues', actionLabel: 'Монитор очередей' },
      ],
    },
    section5Safeguards: {
      rules: [
        { code: 'RULE-DASH-01', name: 'Казначейский инвариант 1.2x', description: 'Совокупный баланс на шлюзах провайдеров обязан превышать 120% от невыполненных заказов.' },
      ],
    },
    section6Troubleshooting: [
      { scenario: 'Рост очереди failed в BullMQ', symptoms: 'Счетчик ошибок >50, заказы не уходят провайдеру', solution: 'Проверить баланс провайдера и перезапустить зависшие воркеры.', emergencyCommand: 'npm run queues:retry-failed' },
    ],
    callouts: [
      { type: 'LEGAL', title: 'Налоговая ставка 2026', content: 'При расчете Net Profit налог УСН учитывается автоматически с учетом изменений 425-ФЗ (НДС 22% при превышении 20 млн ₽).' },
      { type: 'TIP', title: 'Быстрая фильтрация', content: 'Переключайте диапазоны (Сегодня, 7 дней, 30 дней) для мгновенного поиска трендов конверсии.' },
    ],
    screenshot: {
      src: '/manual/screenshots/57_stage_admin_owner_executive_full.png',
      caption: 'Рис. 2.1 — Сводная панель владельца с графиками выручки, маржи и здоровья инфраструктуры',
      altText: 'Executive Dashboard OmniSMM 1.0',
      hotspots: [
        { badgeNumber: 1, xPercent: 24, yPercent: 25, title: 'P&L Маржинальность смены', description: 'Чистая операционная прибыль за вычетом оптовой себестоимости провайдеров и налогов' },
        { badgeNumber: 2, xPercent: 50, yPercent: 25, title: 'Обязательства (Liabilities)', description: 'Суммарный неиспользованный баланс всех зарегистрированных пользователей в копейках' },
        { badgeNumber: 3, xPercent: 76, yPercent: 25, title: 'Активные заказы & BullMQ', description: 'Текущий объем заказов в конвейере исполнения и распределение по шлюзам' },
      ],
    },
    checklist: [
      { id: 'dash-1', title: 'Сверить дневной оборот Gross', detail: 'Проверить корректность транзакций эквайринга' },
      { id: 'dash-2', title: 'Убедиться в отсутствии аномалий COGS', detail: 'Проверить всплески себестоимости провайдеров' },
    ],
    tags: ['Dashboard', 'Unit Economics', 'COGS', 'Liabilities', 'BullMQ'],
  },
  {
    id: 'orders-engine',
    domainId: 'ORDERS',
    volumeNumber: 3,
    chapterNumber: 10,
    title: 'Реестр заказов, жизненный цикл и Drip-Feed',
    subtitle: 'Поиск #ID, диспетчеризация, аварийный Failover, расчет Partial и инвариант Drip-Feed Floor',
    readTimeMinutes: 9,
    iconName: 'Package',
    targetRoute: '/admin/orders',
    section1Scope: 'Глава определяет правила управления заказами, разбор аварийных статусов поставщиков, механизм частичного возврата (Partial) и эксплуатацию Drip-Feed.',
    section2Terms: [
      { term: 'Drip-Feed Floor Invariant', definition: 'Объем на один запуск floor(Q / N) строго не может быть меньше service.minQty.' },
      { term: 'Failover провайдера', definition: 'Бесшовная перемаршрутизация заказа на резервного поставщика без повторного списания с клиента.' },
      { term: 'Partial Return', definition: 'Автоматический возврат средств за недопоставленный остаток (Remainder) на баланс пользователя.' },
    ],
    section3Architecture: {
      description: 'Обработка заказов построена на ACID-транзакциях с блокировкой баланса через WalletOps и Transactional Outbox очередями BullMQ.',
      diagramType: 'ORDER_FLOW',
      coreTables: ['Order', 'Refill', 'Service', 'Provider'],
      coreActions: ['syncOrderStatusAction', 'failoverOrderAction', 'cancelOrderWithRefundAction'],
    },
    section4Walkthrough: {
      steps: [
        { stepNumber: 1, title: 'Поиск заказа в реестре', description: 'Введите номер #ID, email или ссылку на объект в строке поиска с авто-очисткой префиксов.', actionUrl: '/admin/orders', actionLabel: 'Открыть реестр заказов' },
        { stepNumber: 2, title: 'Анализ карточки и логов провайдера', description: 'Откройте OrderDetailsModal: проверьте startCount, remoteOrderId и сырой ответ API поставщика.', actionUrl: '/admin/orders', actionLabel: 'Просмотр карточки' },
        { stepNumber: 3, title: 'Аварийный перезапуск (Failover)', description: 'При ошибке поставщика выберите резервный шлюз в блоке «Failover» и отправьте заказ повторно.', actionUrl: '/admin/orders', actionLabel: 'Failover селектор' },
      ],
    },
    section5Safeguards: {
      rules: [
        { code: 'RULE-ORDER-01', name: 'Инвариант Drip-Feed Floor', description: 'Минимальный общий объем заказа при N запусках обязан быть >= service.minQty * N.' },
        { code: 'RULE-ORDER-02', name: 'Запрет списания с карты', description: 'Все компенсации и возвраты оформляются исключительно на баланс в личном кабинете.' },
      ],
    },
    section6Troubleshooting: [
      { scenario: 'Заказ застрял в PROCESSING', symptoms: 'Провайдер не прислал remoteOrderId более 15 минут', solution: 'Нажать «Синхронизировать статус». Если провайдер вернул ошибку — выполнить Failover.', emergencyCommand: 'npm run orders:sync -- --orderId=<ID>' },
    ],
    callouts: [
      { type: 'CRITICAL', title: 'Соблюдение Trust Boundary', content: 'Цены и объемы валидируются строго на сервере. Клиентскому UI доверять запрещено.' },
      { type: 'NOTE', title: 'Кликабельный бейдж #ID', content: 'Клик по бейджу #ID копирует номер заказа в буфер обмена для быстрой вставки в тикет.' },
    ],
    screenshot: {
      src: '/manual/screenshots/order_placed_success.png',
      caption: 'Рис. 3.1 — Успешное оформление заказа с присвоением канонического #ID и регистрацией в Леджере',
      altText: 'Успешный заказ OmniSMM',
      hotspots: [
        { badgeNumber: 1, xPercent: 50, yPercent: 28, title: 'Номер заказа #ID', description: 'Кликабельный канонический бейдж ID с 1-клик копированием и тостом' },
        { badgeNumber: 2, xPercent: 50, yPercent: 48, title: 'Проводка WalletOps', description: 'Списание средств с баланса зарегистрировано в неизменяемом Леджере двойной записи' },
        { badgeNumber: 3, xPercent: 50, yPercent: 78, title: 'Переход в реестр', description: 'Прямая ссылка для диспетчеризации и проверки очередей исполнения' },
      ],
    },
    checklist: [
      { id: 'order-1', title: 'Проверить статус синхронизации поставщика', detail: 'Убедиться в наличии remoteOrderId' },
      { id: 'order-2', title: 'Проверить корректность начисления сдачи при Partial', detail: 'Сверить сумму в LedgerEntry' },
    ],
    tags: ['Orders', 'Failover', 'Drip-Feed', 'Partial', 'ACID'],
  },
];
