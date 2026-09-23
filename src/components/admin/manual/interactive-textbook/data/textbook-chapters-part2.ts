/**
 * Interactive Textbook Chapters: Part 2
 * Domains: TICKETS, CATALOG, PROVIDERS
 */

import { TextbookChapter } from '../types';

export const CHAPTERS_PART_2: TextbookChapter[] = [
  {
    id: 'tickets-support',
    domainId: 'TICKETS',
    volumeNumber: 4,
    chapterNumber: 17,
    title: 'Омниканальный тикет-центр и регламенты саппорта',
    subtitle: 'SLA реагирования 15 минут, скрытые заметки 🔒, быстрые макросы / и суточный лимит компенсаций',
    readTimeMinutes: 8,
    iconName: 'MessageSquareText',
    targetRoute: '/admin/tickets',
    section1Scope: 'Регламентирует работу первой и второй линий клиентской поддержки, применение Dual-Core скриптов, правила начисления бонусов лояльности и предотвращение эскалаций.',
    section2Terms: [
      { term: 'SLA 15 минут', definition: 'Нормативное время первого ответа оператора клиенту в рабочее время смены (08:00–23:00 МСК).' },
      { term: 'Служебная заметка (🔒)', definition: 'Внутренний комментарий оператора в тикете, невидимый клиенту, для фиксации технических деталей.' },
      { term: 'Лимит компенсаций (supportLimitCents)', definition: 'Персональный суточный бюджет оператора на начисление бонусов без согласования с владельцем.' },
    ],
    section3Architecture: {
      description: 'Чат поддержки построен на SSE (Server-Sent Events) и Telegram Bot API с автоматическим сбросом вебхуков и защитой от конфликтов 409.',
      diagramType: 'SUPPORT_ESCALATION',
      coreTables: ['Ticket', 'TicketMessage', 'User', 'StaffRole'],
      coreActions: ['replyTicketAction', 'addInternalNoteAction', 'grantGoodwillCompensationAction'],
    },
    section4Walkthrough: {
      steps: [
        { stepNumber: 1, title: 'Прием тикета в работу', description: 'Откройте рабочий стол саппорта: оцените LTV клиента, статус последнего заказа и прикрепленные вложения.', actionUrl: '/admin/tickets', actionLabel: 'Открыть тикеты' },
        { stepNumber: 2, title: 'Использование шорткатов быстрых ответов', description: 'Нажмите слэш (/) в поле ввода сообщения для вызова меню эталонных скриптов.', actionUrl: '/admin/tickets', actionLabel: 'Проверить шаблоны' },
        { stepNumber: 3, title: 'Начисление Goodwill компенсации', description: 'При необходимости удержите клиента начислением до 100–150 ₽ в пределах вашего лимита.', actionUrl: '/admin/clients', actionLabel: 'База клиентов' },
      ],
    },
    section5Safeguards: {
      rules: [
        { code: 'RULE-TICKETS-01', name: 'Запрет паролей в открытом виде', description: 'Категорически запрещено передавать временные пароли в чат. Только Magic Link.' },
        { code: 'RULE-TICKETS-02', name: 'Запрет возврата на карты', description: 'Возврат средств осуществляется строго на баланс в ЛК согласно оферте.' },
      ],
    },
    section6Troubleshooting: [
      { scenario: 'Клиент угрожает чарджбэком или судом', symptoms: 'Требование возврата на карту, ссылки на Роспотребнадзор', solution: 'Применить скрипт №18 «Претензионный порядок», выдать оферту и эскалировать в P0.', emergencyCommand: 'npx tsx scripts/notify-p0.ts --ticketId=<ID>' },
    ],
    callouts: [
      { type: 'TIP', title: 'Магическая фраза-таймаут', content: 'Если ситуация требует проверки логов: «Здравствуйте! Взял вопрос в работу, поднимаю логи серверов. Вернусь в течение 10–15 минут!»' },
      { type: 'WARNING', title: 'Запрещенные термины', content: 'Не используйте слова «боты», «накрутка», «сервера сдохли». Пишите: «маршрутизация трафика», «поставщик обновляет алгоритмы».' },
    ],
    screenshot: {
      src: '/manual/screenshots/03_stage_admin_support.png',
      caption: 'Рис. 4.1 — Рабочее место оператора: тикет-лист, карточка заказа клиента и панель служебных заметок',
      altText: 'Рабочее место поддержки OmniSMM',
      hotspots: [
        { badgeNumber: 1, xPercent: 25, yPercent: 20, title: 'Таймер SLA 15 минут', description: 'Индикатор времени ответа на тикет. При превышении 15 мин уходит P0 алерт в Telegram' },
        { badgeNumber: 2, xPercent: 65, yPercent: 45, title: 'Селектор ответов Dual-Core', description: '1-клик вставка стандартизированных вежливых скриптов ответов клиентам' },
        { badgeNumber: 3, xPercent: 85, yPercent: 65, title: 'Служебные заметки 🔒', description: 'Внутренняя переписка между оператором и старшим смены, невидимая для клиента' },
      ],
    },
    checklist: [
      { id: 'tick-1', title: 'Проверить очередь ожидающих тикетов', detail: 'Убедиться в отсутствии просрочек SLA > 15 минут' },
      { id: 'tick-2', title: 'Проверить служебные заметки 🔒', detail: 'Убедиться, что технические данные скрыты от клиента' },
    ],
    tags: ['Tickets', 'Support', 'SLA', 'Goodwill', 'CRM'],
  },
  {
    id: 'catalog-pricing',
    domainId: 'CATALOG',
    volumeNumber: 6,
    chapterNumber: 24,
    title: 'Каталог услуг, семантика TargetType и цены',
    subtitle: 'Стандарт строго ₽/шт (pricePerUnitRub), семантика TargetType (POST vs CHANNEL), слияние категорий и карантин >30%',
    readTimeMinutes: 9,
    iconName: 'Layers',
    targetRoute: '/admin/catalog',
    section1Scope: 'Регламент описывает управление каталогом, пакетную наценку, автоматическое сопоставление целевых ссылок и работу карантина цен.',
    section2Terms: [
      { term: 'Strictly ₽/шт', definition: 'Инвариант UI: пользователь всегда видит цену за 1 штуку. Запрещено писать /1000 шт в интерфейсе.' },
      { term: 'resolveServiceTargetType', definition: 'Семантическое определение целевого типа ссылки (POST / CHANNEL / USER) без ложных блокировок.' },
      { term: 'Карантин цен (>30%)', definition: 'Автоматическая блокировка изменения цен при резком скачке себестоимости у поставщика более чем на 30%.' },
    ],
    section3Architecture: {
      description: 'Каталог услуг синхронизируется с Shadow Catalog в Redis. Таксономия: Network (1:N) -> Category (1:N) -> Service.',
      diagramType: 'TOPOLOGY',
      coreTables: ['Service', 'Category', 'Network', 'ProviderService'],
      coreActions: ['updateServiceAction', 'mergeCategoriesAction', 'releasePriceQuarantineAction'],
    },
    section4Walkthrough: {
      steps: [
        { stepNumber: 1, title: 'Установка наценки категории', description: 'Задайте процент маржи (например, 45%) и минимальную фиксированную надбавку в форме категории.', actionUrl: '/admin/catalog/categories', actionLabel: 'Категории услуг' },
        { stepNumber: 2, title: 'Проверка совместимости TargetType', description: 'Убедитесь, что для услуг каналов Telegram проставлен CHANNEL, а для постов — POST.', actionUrl: '/admin/catalog', actionLabel: 'Проверить услуги' },
        { stepNumber: 3, title: 'Разбор карантина цен', description: 'При скачке курса или цен поставщика проверьте журнал карантина и утвердите новые цены.', actionUrl: '/admin/catalog/drift', actionLabel: 'Карантин цен' },
      ],
    },
    section5Safeguards: {
      rules: [
        { code: 'RULE-CAT-01', name: 'Zero False-Incompatibility', description: 'Запрещено использовать s.targetType || inferTargetTypeFromName. Обязателен resolveServiceTargetType.' },
        { code: 'RULE-CAT-02', name: 'Safe Archive', description: 'Удаление услуг не удаляет строку из БД, а выставляет isActive: false для сохранения финансовых связей.' },
      ],
    },
    section6Troubleshooting: [
      { scenario: 'Услуга заблокирована на витрине', symptoms: 'Клиент видит плашку «Ссылка несовместима с услугой»', solution: 'Проверить targetType услуги через resolveServiceTargetType и исправить в карточке.', emergencyCommand: 'npm run catalog:audit-target-types' },
    ],
    callouts: [
      { type: 'CRITICAL', title: 'Инвариант цены за 1 шт', content: 'Любое умножение цены на 1000 в интерфейсе витрины карается отклонением PR.' },
      { type: 'TIP', title: 'Канонические префиксы', content: 'Префикс соцсети (Telegram, VK) добавляется автоматически для устранения двусмысленности эмодзи флагов.' },
    ],
    screenshot: {
      src: '/manual/screenshots/58_stage_admin_service_access_groups.png',
      caption: 'Рис. 5.1 — Редактирование услуги: семантический targetType, группы доступа и наценка ₽/шт',
      altText: 'Каталог услуг OmniSMM',
      hotspots: [
        { badgeNumber: 1, xPercent: 25, yPercent: 30, title: 'Семантический targetType', description: 'Точный тип ресурса (POST vs CHANNEL), исключающий ложную несовместимость' },
        { badgeNumber: 2, xPercent: 55, yPercent: 30, title: 'Цена за 1 шт (₽ / шт)', description: 'Единый стандарт отображения розничной цены без умножений на 1000' },
        { badgeNumber: 3, xPercent: 80, yPercent: 50, title: 'Переключатель активности', description: 'Safe Archive: при выключении услуга переводится в isActive: false' },
      ],
    },
    checklist: [
      { id: 'cat-1', title: 'Проверить отображение ₽/шт', detail: 'Убедиться в отсутствии надписей /1000 шт' },
      { id: 'cat-2', title: 'Проверить статус карантина цен', detail: 'Убедиться, что нет зависших услуг в карантине >30%' },
    ],
    tags: ['Catalog', 'TargetType', 'Quarantine', 'Pricing', 'Taxonomy'],
  },
  {
    id: 'providers-import',
    domainId: 'PROVIDERS',
    volumeNumber: 8,
    chapterNumber: 33,
    title: 'Провайдеры API, Cherry-Pick импорт и Circuit Breaker',
    subtitle: 'Приоритет №1 ручного выбора админа, барьер Zero-Unknown-Platform, Shadow Catalog и 50+ кодов ошибок API',
    readTimeMinutes: 9,
    iconName: 'PlugZap',
    targetRoute: '/admin/providers',
    section1Scope: 'Глава определяет регламент подключения оптовых провайдеров, правила работы мастера импорта, кэширование каталогов и защиту от каскадных сбоев.',
    section2Terms: [
      { term: 'Приоритет №1 выбора администратора', definition: 'Если админ лично назначил категорию при импорте, алгоритмический анализатор отключается.' },
      { term: 'Zero-Unknown-Platform Guard', definition: 'Если соцсеть поставщика невозможно однозначно определить, импорт услуги безусловно блокируется.' },
      { term: 'Circuit Breaker', definition: 'Предохранитель, временно отключающий отправку заказов на упавший шлюз при превышении 5 ошибок подряд.' },
    ],
    section3Architecture: {
      description: 'Взаимодействие с внешними API проходит через Bulkhead-пулы и Circuit Breaker в Redis с жесткими таймаутами AbortSignal.timeout(10000).',
      diagramType: 'CIRCUIT_BREAKER',
      coreTables: ['Provider', 'ProviderService', 'Service', 'SystemSettings'],
      coreActions: ['testProviderConnectionAction', 'importServicesAction', 'syncProviderBalancesAction'],
    },
    section4Walkthrough: {
      steps: [
        { stepNumber: 1, title: 'Тестирование связи с провайдером', description: 'Нажмите «Проверить связь» в карточке провайдера: система запросит баланс и версию API.', actionUrl: '/admin/providers', actionLabel: 'Открыть провайдеров' },
        { stepNumber: 2, title: 'Запуск мастера импорта Cherry-Pick', description: 'Выберите поставщика, отметьте нужные услуги чекбоксами и привяжите к категориям OmniSMM.', actionUrl: '/admin/providers/import', actionLabel: 'Мастер импорта' },
        { stepNumber: 3, title: 'Мониторинг здоровья шлюзов', description: 'Отслеживайте задержки (Latency P95) и процент отказов на экране мониторинга провайдеров.', actionUrl: '/admin/providers/health', actionLabel: 'Здоровье шлюзов' },
      ],
    },
    section5Safeguards: {
      rules: [
        { code: 'RULE-PROV-01', name: 'Zero-Unknown-Platform', description: 'Запрещено импортировать услуги с неизвестной соцсетью или привязывать их к Telegram по умолчанию.' },
        { code: 'RULE-PROV-02', name: 'Обязательные таймауты', description: 'Каждый исходящий fetch обязан иметь AbortSignal.timeout(10000).' },
      ],
    },
    section6Troubleshooting: [
      { scenario: 'Шлюз поставщика перешел в статус TRIPPED', symptoms: 'Заказы автоматически не отправляются, Circuit Breaker сработал', solution: 'Проверить баланс у поставщика. После пополнения нажать «Сбросить Circuit Breaker».', emergencyCommand: 'npm run providers:reset-circuit -- --providerId=<ID>' },
    ],
    callouts: [
      { type: 'WARNING', title: 'Шифрование ключей Vault', content: 'API-ключи провайдеров хранятся в базе в зашифрованном виде (AES-256-GCM). В открытом виде отображаются только последние 4 символа.' },
      { type: 'TIP', title: 'Shadow Catalog в Redis', content: 'Каталоги поставщиков кэшируются в Redis на 1 час, снижая нагрузку на внешние API.' },
    ],
    screenshot: {
      src: '/manual/screenshots/import-wizard-decomposed-preview.png',
      caption: 'Рис. 6.1 — Мастер импорта Cherry-Pick с предпросмотром услуг, валидатором цен и селектором категорий',
      altText: 'Мастер импорта услуг',
      hotspots: [
        { badgeNumber: 1, xPercent: 20, yPercent: 25, title: 'Выбор поставщика & баланс', description: 'Отображение валюты, баланса шлюза и времени задержки Latency P95' },
        { badgeNumber: 2, xPercent: 55, yPercent: 40, title: 'Таблица Cherry-Pick выбора', description: 'Чекбоксы услуг для точечного импорта с предпросмотром расчётной наценки' },
        { badgeNumber: 3, xPercent: 82, yPercent: 25, title: 'Приоритет №1 админа', description: 'Ручное сопоставление категории оператором полностью отключает авто-сплит' },
      ],
    },
    checklist: [
      { id: 'prov-1', title: 'Проверить балансы всех активных провайдеров', detail: 'Убедиться в наличии достаточных средств на счетах' },
      { id: 'prov-2', title: 'Проверить отсутствие триггеров Circuit Breaker', detail: 'Все шлюзы должны быть в статусе CLOSED (Healthy)' },
    ],
    tags: ['Providers', 'Import', 'Circuit Breaker', 'Shadow Catalog', 'API'],
  },
];
