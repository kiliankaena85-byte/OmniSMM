/**
 * Interactive Textbook Chapters: Part 3
 * Domains: FINANCE, RUNBOOKS
 */

import { TextbookChapter } from '../types';

export const CHAPTERS_PART_3: TextbookChapter[] = [
  {
    id: 'finance-ledger-54fz',
    domainId: 'FINANCE',
    volumeNumber: 9,
    chapterNumber: 38,
    title: 'Финансы, Бухгалтерский Леджер и фискализация 54-ФЗ',
    subtitle: 'Журнал двойной записи LedgerEntry, чистый BigInt, казначейство, 54-ФЗ, НДС 22% (425-ФЗ) и 152-ФЗ анонимизация',
    readTimeMinutes: 10,
    iconName: 'Wallet',
    targetRoute: '/admin/transactions',
    section1Scope: 'Настоящая глава регламентирует финансовую целостность платформы OmniSMM 1.0, бухгалтерский учет двойной записи, обработку банковских платежей B2B и фискализацию.',
    section2Terms: [
      { term: 'Ledger-First Principle', definition: 'Проводка tx.ledgerEntry.create() обязана создаваться строго ДО мутации баланса tx.user.update().' },
      { term: 'ExactMath BigInt', definition: 'Все финансовые расчеты ведутся в неделимых копейках (BigInt). Запрещено использовать числа с плавающей точкой.' },
      { term: 'НДС 22% (425-ФЗ)', definition: 'Базовая ставка НДС с 2026 года при превышении порога выручки УСН в 20 млн ₽ (vat_code: 10).' },
    ],
    section3Architecture: {
      description: 'Финансовая подсистема изолирована через уровень WalletOps. Прямые апдейты User.balance заблокированы на уровне БД.',
      diagramType: 'LEDGER_AUDIT',
      coreTables: ['LedgerEntry', 'User', 'Payment', 'BalanceRequest'],
      coreActions: ['auditLedgerIntegrityAction', 'approveBalanceRequestAction', 'reconcileTreasuryAction'],
    },
    section4Walkthrough: {
      steps: [
        { stepNumber: 1, title: 'Аудит реестра транзакций', description: 'Откройте журнал LedgerEntry: сверьте контрольные суммы дебета и кредита за сутки.', actionUrl: '/admin/transactions', actionLabel: 'Журнал проводок' },
        { stepNumber: 2, title: 'Обработка B2B заявок на пополнение', description: 'Проверьте поступление средств на расчетный счет юрлица и подтвердите заявку с указанием номера платежного поручения.', actionUrl: '/admin/finance/balance-requests', actionLabel: 'Заявки на баланс' },
        { stepNumber: 3, title: 'Контроль казначейства и счетов эквайринга', description: 'Проверьте невыведенные остатки на счетах ЮKassa и CryptoBot в панели казначейства.', actionUrl: '/admin/finance/treasury', actionLabel: 'Казначейство' },
      ],
    },
    section5Safeguards: {
      rules: [
        { code: 'RULE-FIN-01', name: 'Transaction Escape Prevention', description: 'Запрещено использовать db.* внутри транзакций WalletOps. Только инстанс tx.*.' },
        { code: 'RULE-FIN-02', name: 'Timing-Safe Webhooks', description: 'Валидация подписей вебхуков платежей строго через timingSafeEqual.' },
      ],
    },
    section6Troubleshooting: [
      { scenario: 'Расхождение баланса и Леджера', symptoms: 'Пользователь заявляет о пропаже средств, баланс не сходится с суммой проводок', solution: 'Запустить сверку сверки леджера: npm run audit:ledger. Система найдет недостающую проводку.', emergencyCommand: 'npm run audit:ledger -- --userId=<ID>' },
    ],
    callouts: [
      { type: 'CRITICAL', title: 'Финансовый инвариант', content: 'Все изменения баланса выполняются строго через методы WalletOps.credit(), debit(), refund(), charge(), adminAdjust().' },
      { type: 'LEGAL', title: 'Комплаенс 152-ФЗ', content: 'При запросе на удаление аккаунта PII-данные пользователя анонимизируются (хэшируются SHA-256), но финансовые проводки сохраняются по 402-ФЗ.' },
    ],
    screenshot: {
      src: '/manual/screenshots/04_stage_admin_finance_reconciliation.png',
      caption: 'Рис. 7.1 — Финансовая сверка: балансы счетов эквайринга, сверка Леджера и статус фискализации 54-ФЗ',
      altText: 'Финансовая сверка OmniSMM',
      hotspots: [
        { badgeNumber: 1, xPercent: 24, yPercent: 25, title: 'Баланс эквайринга ЮKassa', description: 'Сверка реальных поступлений со шлюза с суммой дебетовых записей в Леджере' },
        { badgeNumber: 2, xPercent: 55, yPercent: 25, title: 'Контроль неизменяемого Леджера', description: 'Бухгалтерский журнал двойной записи с копейками BigInt и защитой от перезаписи' },
        { badgeNumber: 3, xPercent: 82, yPercent: 25, title: 'Фискализация 54-ФЗ', description: 'Статус онлайн-чеков с расчётом НДС 22% по закону № 425-ФЗ' },
      ],
    },
    checklist: [
      { id: 'fin-1', title: 'Провести сверку целостности Леджера', detail: 'Убедиться в отсутствии аномалий и нулевом расхождении' },
      { id: 'fin-2', title: 'Проверить статус чеков 54-ФЗ', detail: 'Все чеки должны иметь фискальный признак в ОФД' },
    ],
    tags: ['Finance', 'Ledger', '54-ФЗ', '425-ФЗ', 'WalletOps', 'Treasury'],
  },
  {
    id: 'settings-system-security',
    domainId: 'SETTINGS',
    volumeNumber: 11,
    chapterNumber: 45,
    title: 'Настройки системы, брендинг и безопасность',
    subtitle: 'Конфигурация Vault, рубильник KillSwitch, Telegram Bot P0, курсы валют ЦБ РФ, CMS и флаги',
    readTimeMinutes: 12,
    iconName: 'Settings',
    targetRoute: '/admin/settings',
    section1Scope: 'Настоящая глава регламентирует глобальную конфигурацию платформы OmniSMM 1.0, управление секретами Vault, аварийный рубильник KillSwitch, ролевую матрицу RBAC (16 разделов) и мультитенантный брендинг (SMMplan & SMMflux).',
    section2Terms: [
      { term: 'KillSwitch (Техработы)', definition: 'Глобальный рубильник в SystemSettings, переводящий витрины в HTTP 503 Maintenance Mode с сохранением доступа в панель управления.' },
      { term: 'Vault & Secrets Storage', definition: 'Защищенное хранилище API ключей и токенов провайдеров в PostgreSQL, шифрованное AES-256 с маскированием в интерфейсе.' },
      { term: 'Курсы ЦБ РФ & Мультивалютность', definition: 'Автоматическая ежедневная синхронизация курсов валют (USD, EUR, KZT) через API ЦБ РФ с возможностью ручной фиксации спреда.' },
      { term: 'Матрица RBAC 16 секций', definition: 'Разграничение прав доступа (Full, Read-Only, None) для ролей OWNER, ADMIN, SUPPORT, ACCOUNTANT по 16 разделам платформы.' },
    ],
    section3Architecture: {
      description: 'Системные настройки кэшируются в Redis с тегом tenantId и сбрасываются мгновенно при сохранении через Server Actions.',
      diagramType: 'SYSTEM_SETTINGS',
      coreTables: ['SystemSettings', 'StaffPermission', 'AuditLog', 'CurrencyRate', 'FeatureFlag'],
      coreActions: ['updateSystemSettingsAction', 'syncCbrRatesAction', 'updateStaffPermissionsAction', 'toggleFeatureFlagAction'],
    },
    section4Walkthrough: {
      steps: [
        { stepNumber: 1, title: 'Глобальные параметры и рубильник KillSwitch', description: 'Управление сервисным режимом HTTP 503, системными лимитами и базовой конфигурацией тенантов.', actionUrl: '/admin/settings?tab=general', actionLabel: 'Общие настройки' },
        { stepNumber: 2, title: 'Интеграция Telegram Bot P0 и алерты', description: 'Настройка токена Telegram, ID каналов для P0 алертов и безопасный сброс вебхука при 409 Conflict.', actionUrl: '/admin/settings?tab=telegram', actionLabel: 'Настройки Telegram' },
        { stepNumber: 3, title: 'Управление прокси и таймаутами провайдеров', description: 'Конфигурация HTTP/SOCKS5 прокси-пулов для обхода региональных ограничений провайдеров API.', actionUrl: '/admin/settings?tab=proxies', actionLabel: 'Прокси шлюзов' },
        { stepNumber: 4, title: 'Ролевая матрица сотрудников (RBAC)', description: 'Детальная настройка прав доступа персонала к 16 функциональным блокам OmniSMM 1.0.', actionUrl: '/admin/settings?tab=roles', actionLabel: 'Роли и доступы' },
        { stepNumber: 5, title: 'Мультитенантный брендинг и домены', description: 'Управление доменами smmplan.pro и smmflux.ru, логотипами, фавиконами и цветовыми темами.', actionUrl: '/admin/settings?tab=branding', actionLabel: 'Брендинг и домены' },
        { stepNumber: 6, title: 'CMS страницы, база знаний и Feature Flags', description: 'Управление пользовательскими страницами (Оферта, FAQ) и переключателями фич платформы.', actionUrl: '/admin/pages', actionLabel: 'CMS и флаги' },
      ],
    },
    section5Safeguards: {
      rules: [
        { code: 'RULE-SET-01', name: 'Zero Secrets Leak Guard', description: 'Любое отображение ключей в интерфейсе строго маскируется (••••••••). Аудит безопасности блокирует утечки в бандл.' },
        { code: 'RULE-SET-02', name: 'Fail-Closed KillSwitch Guard', description: 'Включение техработ защищает целостность БД, но не прерывает активные Server Actions авторизованного администратора.' },
        { code: 'RULE-SET-03', name: 'Audit P0 Notification', description: 'Изменение настроек безопасности логируется через await auditAdminAwaitable() и немедленно шлется в Telegram P0.' },
      ],
    },
    section6Troubleshooting: [
      { scenario: 'Рассинхронизация настроек в кластере', symptoms: 'Изменение параметров в админке не отображается на витрине пользователей', solution: 'Сбросить кэш настроек в Redis или вызвать принудительную ревалидацию тэгов в панели Инспектора.', emergencyCommand: 'npx tsx scripts/flush-settings-cache.ts' },
      { scenario: 'Сбой синхронизации курсов валют ЦБ РФ', symptoms: 'В казначействе отображается предупреждение о неактуальном курсе USD', solution: 'Нажать кнопку «Принудительно обновить курсы ЦБ РФ» на вкладке Валюты или проверить доступность cbr.ru.', emergencyCommand: 'npx tsx scripts/sync-cbr-rates.ts' },
    ],
    callouts: [
      { type: 'CRITICAL', title: 'Инвариант безопасности настроек', content: 'Изменение любых системных параметров или прав ролей обязательно фиксируется в AuditLog через await auditAdminAwaitable() и дублируется в Telegram P0.' },
      { type: 'TIP', title: 'Быстрый переход по вкладкам', content: 'Используйте верхнюю панель вкладок системных настроек для прямого перехода между Telegram, Прокси, Ролями, Брендингом и CMS.' },
    ],
    screenshot: {
      src: '/manual/screenshots/08_stage_manual_inspector_status.png',
      caption: 'Рис. 11.1 — Панель системного статуса, диагностика инспектора и конфигурационные параметры OmniSMM',
      altText: 'Системные настройки OmniSMM',
      hotspots: [
        { badgeNumber: 1, xPercent: 25, yPercent: 20, title: 'Статус системных служб', description: 'Мониторинг доступности PostgreSQL, Redis, Worker очередей BullMQ и внешних шлюзов' },
        { badgeNumber: 2, xPercent: 65, yPercent: 20, title: 'Конфигурация окружения', description: 'Проверка загрузки переменных окружения, режимов отладки и состояния Vault' },
        { badgeNumber: 3, xPercent: 50, yPercent: 70, title: 'Диагностика и кэш', description: 'Инструменты сброса кэша настроек и тестирования сетевых подключений' },
      ],
    },
    checklist: [
      { id: 'set-1', title: 'Проверить актуальность курсов валют ЦБ РФ', detail: 'Убедиться, что курсы обновлены сегодня и спред не превышает допустимый лимит' },
      { id: 'set-2', title: 'Провести аудит токенов Telegram P0 бота', detail: 'Проверить доставку тестового сообщения в канал алертов без ошибок 409 Conflict' },
      { id: 'set-3', title: 'Проверить состояние рубильника KillSwitch', detail: 'Режим техработ должен быть отключен в штатном режиме' },
    ],
    tags: ['Settings', 'Security', 'Vault', 'Telegram', 'RBAC', 'KillSwitch', 'CBR', 'CMS'],
  },
  {
    id: 'runbooks-emergency',
    domainId: 'RUNBOOKS',
    volumeNumber: 12,
    chapterNumber: 46,
    title: 'Регламенты аварийных ситуаций (Runbooks DR-01...DR-06)',
    subtitle: 'Стандарт ГОСТ ЕСПД 19.505-79: KillSwitch, сбой валидатора, обнуление провайдера, 409 Conflict и изоляция сотрудника',
    readTimeMinutes: 10,
    iconName: 'AlertOctagon',
    targetRoute: '/admin/settings?tab=general',
    section1Scope: 'Регламентирует действия дежурной смены при возникновении критических аварий (Severity P0/P1), порядок включения защитных барьеров и план восстановления.',
    section2Terms: [
      { term: 'KillSwitch (Техработы)', definition: 'Глобальный тумблер, блокирующий прием новых заказов и переводящий витрины в режим сервисного обслуживания.' },
      { term: 'P0 Incident', definition: 'Критический сбой, влекущий прямые финансовые потери, недоступность авторизации или сбой платежных шлюзов.' },
      { term: 'Cold Rollback', definition: 'Мгновенный откат боевого контейнера на предыдущий стабильный образ smmplan_backup (до 5 секунд).' },
    ],
    section3Architecture: {
      description: 'Аварийные механизмы встроены на уровнях Next.js middleware, Redis fail-safe кэшей и PostgreSQL Row-Level Lock.',
      diagramType: 'CIRCUIT_BREAKER',
      coreTables: ['SystemSettings', 'AuditLog', 'User', 'Order'],
      coreActions: ['toggleMaintenanceModeAction', 'isolateCompromisedStaffAction', 'purgeRedisCacheAction'],
    },
    section4Walkthrough: {
      steps: [
        { stepNumber: 1, title: 'Активация режима аварийных техработ', description: 'При масштабном сбое перейдите в Настройки и включите «Режим техработ», уведомив руководство в Telegram P0.', actionUrl: '/admin/settings', actionLabel: 'Включить KillSwitch' },
        { stepNumber: 2, title: 'Диагностика сбоя через инспектор', description: 'Откройте Инспектор архитектуры и проверьте доступность БД, Redis и внешних шлюзов.', actionUrl: '/admin/settings?tab=diagnostics', actionLabel: 'Инспектор' },
        { stepNumber: 3, title: 'Выполнение шагов регламента DR', description: 'Следуйте шагам регламента (DR-01...DR-06), отмечая прогресс в интерактивном чек-листе.', actionUrl: '/admin/manual', actionLabel: 'Открыть регламенты' },
      ],
    },
    section5Safeguards: {
      rules: [
        { code: 'RULE-DR-01', name: 'Fail-Closed Guard', description: 'При отказе кэша или шлюза система обязана блокировать сомнительную операцию, а не пропускать ее.' },
        { code: 'RULE-DR-02', name: 'Немедленный аудит P0', description: 'Любая аварийная операция логируется через await auditAdminAwaitable() с Telegram-оповещением.' },
      ],
    },
    section6Troubleshooting: [
      { scenario: 'Telegram Polling Error 409 Conflict', symptoms: 'Бот не отвечает, в логах ошибка 409 Conflict: terminated by other getUpdates', solution: 'Удалить повисший вебхук через deleteWebhook({ drop_pending_updates: true }) и перезапустить.', emergencyCommand: 'npm run telegram:reset-webhook' },
    ],
    callouts: [
      { type: 'CRITICAL', title: 'Регламент компрометации сотрудника', content: 'При утечке ключей сотрудника: 1. Разжаловать до USER, 2. Сбросить пароль, 3. Инвалидировать все сессии в Redis.' },
      { type: 'TIP', title: 'Экспорт в Markdown', content: 'Любой регламент можно скачать в 1 клик в формате .md с кодировкой UTF-8 BOM для печати на смену.' },
    ],
    screenshot: {
      src: '/manual/screenshots/03_stage_manual_runbook_detail_6_sections.png',
      caption: 'Рис. 8.1 — Экран регламента по стандарту ГОСТ ЕСПД 19.505-79 с 6 обязательными главами',
      altText: 'Регламент ГОСТ ЕСПД',
      hotspots: [
        { badgeNumber: 1, xPercent: 20, yPercent: 15, title: 'ГОСТ ЕСПД 19.505-79', description: 'Обязательные 6 разделов государственного стандарта для всех технических инструкций' },
        { badgeNumber: 2, xPercent: 85, yPercent: 15, title: 'Экспорт .md (BOM)', description: 'Мгновенное скачивание регламента в UTF-8 BOM для дежурной папки и печати' },
        { badgeNumber: 3, xPercent: 50, yPercent: 65, title: 'Интерактивный чек-лист', description: 'Пошаговый контроль действий дежурного инженера с сохранением прогресса в localStorage' },
      ],
    },
    checklist: [
      { id: 'dr-1', title: 'Оповестить руководство в P0-канале', detail: 'Зафиксировать время начала инцидента и пострадавший контур' },
      { id: 'dr-2', title: 'Выполнить локализацию сбоя', detail: 'Отсечь поврежденный шлюз или активировать KillSwitch' },
    ],
    tags: ['Runbooks', 'Disaster Recovery', 'KillSwitch', 'P0', 'Safety'],
  },
];
