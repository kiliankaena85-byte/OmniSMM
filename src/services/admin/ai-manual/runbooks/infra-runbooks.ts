import type { AdminRunbook } from '@/types/admin-ai-manual';

export const INFRA_RUNBOOKS: AdminRunbook[] = [
  {
    id: 'emergency-killswitch',
    chapterNumber: 6,
    chapterTitle: 'Инфраструктура и Инциденты',
    title: 'Активация режима техработ (KillSwitch) и аварийный сброс кэшей',
    targetRoute: '/admin/settings',
    summary: 'Регламент экстренной изоляции платформы, вывешивания сервисного баннера и сброса Redis кэша.',
    estimatedMinutes: 4,
    tags: ['killswitch', 'техработы', 'redis', 'авария', 'безопасность'],
    relatedFiles: [
      'src/app/admin/settings/components/general/GeneralMaintenanceSection.tsx',
      'src/actions/admin/settings/helpers/settings-alerts-dispatcher.ts',
      'scripts/emergency-killswitch.ts',
    ],
    scopeAndObjectives:
      'Описывает процедуру перевода платформы в режим регламентных технических работ (Maintenance Mode), блокировку оформления новых заказов и списаний, оповещение активных пользователей через глобальный баннер и контролируемый сброс кэш-слоев.',
    termsAndDefinitions: [
      {
        term: 'Emergency KillSwitch',
        definition: 'Глобальный системный переключатель, мгновенно переводящий публичные витрины в режим обслуживания с возвратом HTTP 503 Service Unavailable для поисковых ботов (с сохранением доступа операторам).',
      },
      {
        term: 'Redis Cache Invalidation Flush',
        definition: 'Принудительная очистка ключей кэша каталога и цен (pattern: catalog-*) для предотвращения продажи услуг по устаревшим тарифам.',
      },
      {
        term: 'Tailscale Funnel Invariant',
        definition: 'Защищенная точка входа для удаленного администрирования через Tailscale туннель в условиях блокировок Cloudflare на территории РФ.',
      },
    ],
    technicalArchitecture: {
      prismaTables: ['SystemSettings', 'AdminAuditLog'],
      serverActions: ['toggleMaintenanceModeAction', 'flushCacheAction'],
      level1Services: ['settingsSecurityGuard', 'auditAdminAwaitable'],
      description: 'SystemSettings.isMaintenanceActive -> Edge Proxy Middleware -> Блокировка чекаута -> P0 алерт в Telegram -> Очистка Redis.',
    },
    steps: [
      {
        stepNumber: 1,
        title: 'Переход в управление техработами',
        instruction: 'Откройте раздел Общие настройки (/admin/settings) и найдите карточку "Режим технического обслуживания".',
        actionUrl: '/admin/settings',
        actionLabel: 'Настройки платформы',
      },
      {
        stepNumber: 2,
        title: 'Подтверждение активации KillSwitch',
        instruction: 'Нажмите "Включить режим техработ". Во всплывающем модальном окне подтвердите действие. Витрины моментально отобразят баннер.',
      },
      {
        stepNumber: 3,
        title: 'Аварийная очистка кэшей Redis',
        instruction: 'При исправлении каталога или цен поставщиков нажмите "Сбросить кэш каталога". Все клиенты получат свежие данные.',
      },
      {
        stepNumber: 4,
        title: 'Деактивация и снятие баннера',
        instruction: 'После завершения технических процедур деактивируйте тумблер техработ. Проверьте оформление тестового заказа.',
      },
    ],
    protectiveMechanisms: [
      {
        title: 'Защита от случайного включения (Modal Guard)',
        description: 'Тумблер техработ защищен модальным диалогом подтверждения и обязательным требованием роли OWNER или ADMIN.',
        ruleCode: 'INF-MAINTENANCE-MODAL',
      },
      {
        title: 'Сохранение доступа администраторам',
        description: 'Сессии сотрудников с ролью STAFF/ADMIN сохраняют полный доступ к панели управления даже при активном KillSwitch.',
        ruleCode: 'INF-STAFF-BYPASS',
      },
    ],
    troubleshooting: [
      {
        scenario: 'Пользователи видят старые цены после обновления у провайдера',
        symptoms: 'В панели цена изменилась, но на клиентском лендинге отображается прежняя стоимость.',
        remedy: 'Выполните сброс тегов кэша Next.js и Redis через команду `npm run killswitch:status` или кнопку "Сбросить кэш" в панели.',
        files: ['src/lib/cache.ts'],
      },
    ],
  },
  {
    id: 'multitenant-isolation',
    chapterNumber: 7,
    chapterTitle: 'Мульти-тенантность и Бренды',
    title: 'Управление витринами OmniSMM: SMMplan и SMMflux (Изоляция ст. 54.1 НК РФ)',
    targetRoute: '/admin/dashboard',
    summary: 'Регламент переключения контекстов витрин через GlobalSiteSwitcher, изоляции кэшей и доменов.',
    estimatedMinutes: 4,
    tags: ['мульти-тенант', 'smmplan', 'smmflux', 'изоляция', 'бренды', 'налоги'],
    relatedFiles: [
      'src/components/admin/GlobalSiteSwitcher.tsx',
      'src/tenants/config.ts',
      'src/lib/tenant-context.ts',
    ],
    scopeAndObjectives:
      'Регламентирует эксплуатацию мульти-тенантного движка OmniSMM 1.0, обслуживающего независимые бренды SMMplan (smmplan.pro) и SMMflux (smmflux.ru), гарантируя криптографическую и логическую изоляцию клиентских баз, кэшей и налоговых потоков по ст. 54.1 НК РФ.',
    termsAndDefinitions: [
      {
        term: 'OmniSMM 1.0 Engine',
        definition: 'Единая материнская платформа управления мульти-тенантным бэкендом, предоставляющая общий каталог, роутер заказов и финансовый шлюз.',
      },
      {
        term: 'GlobalSiteSwitcher',
        definition: 'Глобальный переключатель активного тенанта в верхней панели админки, сохраняющий контекст в cookie x_admin_tenant и синхронизирующий фильтры реестров.',
      },
      {
        term: 'Tenant-Aware Cache Keys',
        definition: 'Строгое включение tenantId во все составные ключи нестабильного кэша (catalog-smmplan, catalog-flux) для исключения перекрестной утечки данных.',
      },
    ],
    technicalArchitecture: {
      prismaTables: ['User', 'Order', 'Service', 'SystemSettings'],
      serverActions: ['setAdminTenantCookieAction'],
      level1Services: ['tenantResolver', 'multiTenantIsolationService'],
      description: 'Host header -> Edge Middleware -> resolveTenant() -> TenantContext -> Изолированные запросы Prisma с where: { tenantId }.',
    },
    steps: [
      {
        stepNumber: 1,
        title: 'Переключение контекста витрины в шапке',
        instruction: 'Используйте выпадающий список GlobalSiteSwitcher в верхней панели (Header) для выбора SMMplan либо SMMflux.',
        actionUrl: '/admin/dashboard',
        actionLabel: 'Дашборд OmniSMM',
      },
      {
        stepNumber: 2,
        title: 'Проверка изоляции заказов и клиентов',
        instruction: 'Убедитесь, что списки заказов и пользователей отфильтрованы строго по выбранному бренду.',
      },
      {
        stepNumber: 3,
        title: 'Настройка индивидуальной наценки бренда',
        instruction: 'В настройках каталога задайте наценку отдельно для SMMplan и SMMflux с учетом аудитории брендов.',
      },
    ],
    protectiveMechanisms: [
      {
        title: 'Запрет фантомных брендов (Zero False-Branding)',
        description: 'Любые устаревшие наименования (Lovable, SMMboost) жестко запрещены в коде и макетах; алиас normalizer автоматически приводит их к flux.',
        ruleCode: 'TENANT-NO-PHANTOM-BRANDS',
      },
      {
        title: 'Изоляция балансов пользователей',
        description: 'Баланс клиента SMMplan физически не может быть использован для оплаты на домене SMMflux.',
        ruleCode: 'TENANT-BALANCE-BARRIER',
      },
    ],
    troubleshooting: [
      {
        scenario: 'Заказ отображается не в той витрине',
        symptoms: 'Клиент SMMflux видит заказ в профиле SMMplan.',
        remedy: 'Проверьте значение tenantId в записи Order. При необходимости выполните миграцию через служебный экшен с фиксацией в аудит-логе.',
        files: ['src/services/admin/order/order-query.service.ts'],
      },
    ],
  },
];
