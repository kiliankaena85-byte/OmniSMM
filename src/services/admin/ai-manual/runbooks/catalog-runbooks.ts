import type { AdminRunbook } from '@/types/admin-ai-manual';

export const CATALOG_RUNBOOKS: AdminRunbook[] = [
  {
    id: 'catalog-import',
    chapterNumber: 1,
    chapterTitle: 'Каталог и Провайдеры',
    title: 'Импорт каталога услуг через мастер Cherry-Pick и защита от зомби-услуг',
    targetRoute: '/admin/providers/import',
    summary: 'Регламент сопоставления категорий, детекции платформ, пакетных наценок и изоляции зомби-услуг.',
    estimatedMinutes: 5,
    tags: ['каталог', 'провайдеры', 'импорт', 'зомби-услуги', 'карантин'],
    relatedFiles: [
      'src/app/admin/providers/import/components/wizard/import-wizard.tsx',
      'src/services/providers/analyzer/smart-analyzer.logic.ts',
      'src/services/admin/catalog/catalog-sync.service.ts',
    ],
    scopeAndObjectives:
      'Настоящий регламент определяет порядок автоматизированного и выборочного (Cherry-Pick) импорта услуг из API внешних SMM-провайдеров, их нормализацию в таксономии OmniSMM 1.0, расчет ценовых маржинальностей и предотвращение проникновения в витрины некорректных или снятых с продажи услуг.',
    termsAndDefinitions: [
      {
        term: 'Зомби-услуги (Zombie Services)',
        definition: 'Услуги, удаленные или отключенные на стороне внешнего провайдера, но продолжающие числиться активными в локальной базе данных платформы.',
      },
      {
        term: 'Карантин цен (Price Quarantine)',
        definition: 'Защитная блокировка автоматического обновления цены услуги при ее резком изменении провайдером более чем на 30% до ручного подтверждения администратором.',
      },
      {
        term: 'Shadow Catalog (Теневой кэш)',
        definition: 'Изолированный кэш исходных данных провайдера в Redis/DB, позволяющий фильтровать и сопоставлять услуги без их преждевременной публикации на витрине.',
      },
      {
        term: 'Zero-Unknown-Platform Guard',
        definition: 'Инвариант безопасности, безусловно отбраковывающий услуги с неопределенной социальной сетью (platform: unknown/other) при автоматическом импорте.',
      },
    ],
    technicalArchitecture: {
      prismaTables: ['Service', 'Provider', 'Category', 'ProviderServiceCache', 'AdminAuditLog'],
      serverActions: ['syncProviderServicesAction', 'importServicesAction', 'toggleServiceStatusAction'],
      level1Services: ['smartAnalyzerLogic', 'catalogTaxonomyService', 'catalogManagementService', 'catalogSyncService'],
      description: 'Многослойная архитектура: теневой кэш провайдера -> конвейер чистых анализаторов -> семантический резолвер категорий -> ACID транзакция публикации в каталог.',
    },
    steps: [
      {
        stepNumber: 1,
        title: 'Выбор целевого провайдера',
        instruction: 'Перейдите в мастер импорта и выберите настроенного провайдера из выпадающего списка. Убедитесь в наличии активного API-ключа.',
        actionUrl: '/admin/providers/import',
        actionLabel: 'Открыть мастер импорта',
      },
      {
        stepNumber: 2,
        title: 'Синхронизация теневого кэша (Shadow Catalog)',
        instruction: 'Нажмите кнопку "Синхронизировать каталог". Услуги загрузятся в теневой буфер без внесения изменений в публичную витрину.',
      },
      {
        stepNumber: 3,
        title: 'Выбор и сопоставление категорий (Cherry-Pick)',
        instruction: 'Используйте горизонтальные табы соцсетей. При ручном сопоставлении администратором (Приоритет №1) алгоритмический сплит автоматически отключается.',
        warningNote: 'Если платформа услуги не распознана со 100% точностью, услуга блокируется правилом Zero-Unknown-Platform Guard.',
      },
      {
        stepNumber: 4,
        title: 'Установка наценки и публикация',
        instruction: 'Задайте процент наценки (например, +50%) или фиксированный коэффициент и нажмите "Импортировать выбранные".',
      },
    ],
    protectiveMechanisms: [
      {
        title: 'Приоритет №1 выбора администратора',
        description: 'При ручном указании категории администратором автоматический семантический анализатор принудительно отключается, гарантируя сохранение воли оператора.',
        ruleCode: 'CAT-INGEST-PRIORITY-1',
      },
      {
        title: 'Карантин ценовых аномалий',
        description: 'При изменении стоимости закупки у провайдера более чем на 30% услуга переводится в статус QUARANTINE с мгновенным Telegram-алертом P0 администраторам.',
        ruleCode: 'CAT-PRICE-QUARANTINE-30',
      },
      {
        title: 'Автоматическая деактивация зомби-услуг',
        description: 'Фоновый синк помечает отсутствующие в каталоге провайдера услуги как ARCHIVED, защищая клиентов от списания средств за невыполнимые заказы.',
        ruleCode: 'CAT-ZOMBIE-PURGE',
      },
    ],
    troubleshooting: [
      {
        scenario: 'Поломка валидатора ссылок (Link Engine & Regex Malfunction)',
        symptoms: 'Пользователь вводит корректную ссылку на канал/пост, но валидатор отвергает ее с ошибкой INVALID_LINK_FORMAT.',
        remedy: 'Проверьте регулярные выражения в UnifiedLinkEngine и таблице LinkRulesRegistry. Сбросьте кэш шаблонов ссылок и сверьте каноникализацию URL.',
        files: ['src/services/link-engine/unified-link-engine.ts', 'src/services/link-engine/link-rules-registry.ts', 'src/utils/link-normalizer.ts'],
      },
      {
        scenario: 'Конфликт целевого типа ссылки (TargetType Conflict)',
        symptoms: 'Пользователь не может заказать услугу для Telegram-канала, отображается ошибка несовместимости типа ссылки.',
        remedy: 'Убедитесь, что для услуги вызван resolveServiceTargetType(service). Проверьте соответствие targetType в карточке услуги (/admin/catalog) значению CHANNEL или POST.',
        files: ['src/utils/target-type-mapper.ts', 'src/services/providers/analyzer/target-type-detector.pure.ts'],
      },
      {
        scenario: 'Сбой парсинга каталога поставщика',
        symptoms: 'При синхронизации возвращается ошибка INVALID_RESPONSE или пустой список услуг.',
        remedy: 'Проверьте доступность API провайдера в разделе /admin/providers. Убедитесь, что прокси-сервер не заблокирован и API-токен не просрочен.',
        files: ['src/services/providers/provider-proxy-manager.service.ts'],
      },
    ],
  },
];
