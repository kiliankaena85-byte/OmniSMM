import type { AdminRunbook } from '@/types/admin-ai-manual';

export const SECURITY_RUNBOOKS: AdminRunbook[] = [
  {
    id: 'team-rbac',
    chapterNumber: 4,
    chapterTitle: 'Команда и Безопасность',
    title: 'Управление ролями RBAC, персональными ключами Gemini и аудит-логом',
    targetRoute: '/admin/settings/team',
    summary: 'Регламент гранулярного разграничения доступа персонала, шифрования личных API-ключей и аудита.',
    estimatedMinutes: 5,
    tags: ['rbac', 'роли', 'персонал', 'безопасность', 'gemini', 'аудит'],
    relatedFiles: [
      'src/app/admin/settings/team/team-management.tsx',
      'src/services/ai/gemini-client.ts',
      'src/lib/audit.ts',
      'src/lib/vault.ts',
    ],
    scopeAndObjectives:
      'Устанавливает правила авторизации сотрудников OmniSMM 1.0 на основе матричной ролевой модели (RBAC), изоляцию административных полномочий от финансовых настроек (OWNER guard), шифрование конфиденциальных секретов в AES-256 Vault и обязательное протоколирование действий.',
    termsAndDefinitions: [
      {
        term: 'Матрица прав RBAC (16 секций)',
        definition: 'Гранулярная система разграничения прав доступа к 16 независимым разделам платформы с раздельной настройкой прав на чтение (VIEW) и запись (EDIT).',
      },
      {
        term: 'OWNER Guard Boundary',
        definition: 'Критический инвариант безопасности: изменение платежных шлюзов, налоговых ставок 54-ФЗ и добавление новых администраторов разрешено строго роли OWNER.',
      },
      {
        term: 'AES-256-GCM Vault',
        definition: 'Криптографическое хранилище конфиденциальных секретов (API-токенов, паролей, персональных ключей Gemini) в базе данных с солью и вектором инициализации (IV).',
      },
      {
        term: 'auditAdminAwaitable()',
        definition: 'Обязательный блокирующий вызов записи аудита для всех критических операций с балансами, правами персонала и экстренными рубильниками.',
      },
    ],
    technicalArchitecture: {
      prismaTables: ['User', 'RolePermission', 'AdminAuditLog', 'SystemSettings'],
      serverActions: ['settingsRoleAction', 'updateStaffPermissionsAction', 'demoteStaffAction'],
      level1Services: ['vaultService', 'auditAdminAwaitable', 'sessionService'],
      description: 'Сессионный токен -> JWT/Redis сессия -> RolePermission матрица -> OWNER/STAFF guard -> криптографический аудит-лог.',
    },
    steps: [
      {
        stepNumber: 1,
        title: 'Инспекция списка сотрудников',
        instruction: 'Перейдите в раздел Команда (/admin/settings/team). Ознакомьтесь с активными ролями (OWNER, ADMIN, MANAGER, SUPPORT).',
        actionUrl: '/admin/settings/team',
        actionLabel: 'Управление командой',
      },
      {
        stepNumber: 2,
        title: 'Настройка 16-секционной матрицы прав',
        instruction: 'Откройте модальное окно сотрудника. Сконфигурируйте флаги чтения и изменения для требуемых функциональных блоков (Каталог, Заказы, Тикеты).',
      },
      {
        stepNumber: 3,
        title: 'Привязка личного Gemini API-ключа',
        instruction: 'Для сотрудников техподдержки и аналитиков введите индивидуальный API-ключ Gemini. Он будет зашифрован в Vault и приоритетно использован виджетом.',
      },
      {
        stepNumber: 4,
        title: 'Верификация записи в журнале аудита',
        instruction: 'Проверьте раздел /admin/audit. Убедитесь в наличии события STAFF_ROLE_UPDATE с фиксацией IP-адреса и инициатора изменения.',
      },
    ],
    protectiveMechanisms: [
      {
        title: 'Запрет саморазжалования владельца',
        description: 'Система блокирует попытку понизить роль или удалить последнего пользователя с рангом OWNER платформы.',
        ruleCode: 'SEC-OWNER-IMMUNITY',
      },
      {
        title: 'Маскирование PII и секретов в интерфейсе',
        description: 'Все ключи API и токены отображаются в формате abcd...wxyz. Полный ключ доступен только при вводе нового значения.',
        ruleCode: 'SEC-SECRET-MASKING',
      },
      {
        title: 'Блокировка сессии при смене роли',
        description: 'При понижении прав сотрудника все его активные сессии в Redis мгновенно аннулируются.',
        ruleCode: 'SEC-SESSION-REVOCATION',
      },
    ],
    troubleshooting: [
      {
        scenario: 'Сотрудник получает 403 Forbidden в разделе админки',
        symptoms: 'После входа в панель пользователь видит сообщение об отсутствии прав на просмотр заказов или каталога.',
        remedy: 'Проверьте матрицу прав сотрудника в /admin/settings/team. Убедитесь, что для соответствующей секции активен чекбокс "Просмотр".',
        files: ['src/app/admin/settings/team/modals/RolePermissionsModal.tsx'],
      },
      {
        scenario: 'Исчерпание квоты Gemini API (HTTP 429)',
        symptoms: 'Виджет OmniManual сообщает о недоступности ИИ-консультанта.',
        remedy: 'Внесите новый резервный ключ в настройках сотрудника или глобальном пуле SystemSettings.geminiApiKeys. Сбойный ключ автоматически вернется через 5 минут кулдауна.',
        files: ['src/services/ai/gemini-client.ts'],
      },
    ],
  },
  {
    id: 'telegram-enterprise',
    chapterNumber: 5,
    chapterTitle: 'Телекоммуникация и Боты',
    title: 'Подключение Telegram Enterprise бота, алертов P0 и ротации прокси',
    targetRoute: '/admin/settings',
    summary: 'Регламент привязки бота в AES-256 Vault, предотвращения конфликтов 409 и настройки оперативных алертов.',
    estimatedMinutes: 5,
    tags: ['telegram', 'бот', 'уведомления', 'алерты', 'vault', 'прокси'],
    relatedFiles: [
      'src/actions/admin/settings/helpers/settings-alerts-dispatcher.ts',
      'src/actions/admin/telegram/bot-enterprise-config-actions.ts',
      'src/bot/index.ts',
    ],
    scopeAndObjectives:
      'Регламентирует безопасную интеграцию корпоративного Telegram-бота платформы OmniSMM 1.0, шифрование токена в Vault, предотвращение конфликтов вебхуков и поллинга (HTTP 409 Conflict) и рассылку критических оповещений администраторам.',
    termsAndDefinitions: [
      {
        term: 'Idempotent Telegram Polling',
        definition: 'Обязательный сброс висящих вебхуков через deleteWebhook({ drop_pending_updates: true }) перед запуском long-polling для исключения ошибки 409 Conflict.',
      },
      {
        term: 'P0 Operational Alert',
        definition: 'Высокоприоритетное системное уведомление в рабочий канал администраторов при падении провайдера, смене платежных настроек или активации техработ.',
      },
      {
        term: 'Egress Telegram Proxy',
        definition: 'Защищенный HTTPS/SOCKS5 прокси-агент для обхода блокировок и сетевой изоляции при взаимодействии с api.telegram.org.',
      },
    ],
    technicalArchitecture: {
      prismaTables: ['SystemSettings', 'AdminAuditLog'],
      serverActions: ['saveBotTokenAction', 'testBotConnectionAction', 'dispatchTelegramAlertAction'],
      level1Services: ['settingsAlertsDispatcher', 'vaultService'],
      description: 'Событие безопасности -> SettingsAlertsDispatcher -> AES-256 расшифровка токена -> Egress Proxy -> Telegram Bot API.',
    },
    steps: [
      {
        stepNumber: 1,
        title: 'Ввод токена бота в защищенный Vault',
        instruction: 'Перейдите в раздел Общие настройки (/admin/settings) и укажите токен Telegram-бота, полученный от @BotFather.',
        actionUrl: '/admin/settings',
        actionLabel: 'Настройки Telegram бота',
      },
      {
        stepNumber: 2,
        title: 'Назначение канала критических алертов',
        instruction: 'Укажите ID служебного Telegram-чата или канала (-100...) для получения оперативных алертов P0.',
      },
      {
        stepNumber: 3,
        title: 'Тест соединения и пинга',
        instruction: 'Нажмите кнопку "Проверить соединение". Сервер выполнит тестовый вызов getMe() и отобразит время сетевого отклика.',
      },
      {
        stepNumber: 4,
        title: 'Верификация тестового алерта',
        instruction: 'Убедитесь, что в указанный канал поступило тестовое оповещение с цифровой подписью OmniSMM 1.0.',
      },
    ],
    protectiveMechanisms: [
      {
        title: 'Drop Pending Updates Guard',
        description: 'При любом перезапуске бота очередь накопившихся сообщений безопасно очищается, предотвращая флуд-атаку и переполнение памяти.',
        ruleCode: 'TG-DROP-PENDING',
      },
      {
        title: 'Скрытие токена в отчетах об ошибках',
        description: 'Регулярные выражения в логгере автоматически маскируют токены Telegram вида 123456:ABC-DEF.',
        ruleCode: 'TG-TOKEN-REDACT',
      },
    ],
    troubleshooting: [
      {
        scenario: 'Ошибка "409 Conflict: terminated by other getUpdates request"',
        symptoms: 'Telegram бот циклически перезапускается в Docker с ошибкой 409.',
        remedy: 'Убедитесь, что не запущен второй экземпляр бота на хосте. Запустите скрипт `dotenv -e .env -- tsx -e "import { Telegraf } from \'telegraf\'; new Telegraf(process.env.TELEGRAM_BOT_TOKEN!).telegram.deleteWebhook({ drop_pending_updates: true })"`.',
        files: ['src/bot/index.ts'],
      },
    ],
  },
];
