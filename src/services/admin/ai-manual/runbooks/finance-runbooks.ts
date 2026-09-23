import type { AdminRunbook } from '@/types/admin-ai-manual';

export const FINANCE_RUNBOOKS: AdminRunbook[] = [
  {
    id: 'finance-54fz',
    chapterNumber: 2,
    chapterTitle: 'Финансы и 54-ФЗ',
    title: 'Настройка эквайринга ЮKassa, кассы 54-ФЗ с НДС 22% и балансового Леджера',
    targetRoute: '/admin/finance',
    summary: 'Регламент подключения шлюзов, фискализации чеков, ставки НДС 22% и аудита балансов через BigInt Леджер.',
    estimatedMinutes: 7,
    tags: ['финансы', 'юкасса', '54-фз', 'ндс22', 'леджер', 'биллинг'],
    relatedFiles: [
      'src/services/financial/payment-gateway.service.ts',
      'src/services/financial/exact-math.ts',
      'src/lib/fiscal/receipt-service.ts',
      'src/lib/wallet/ops.ts',
    ],
    scopeAndObjectives:
      'Регламентирует порядок взаимодействия финансового шлюза ЮKassa с учетным модулем OmniSMM 1.0, процесс формирования фискальных чеков по требованиям 54-ФЗ и ФЗ № 425-ФЗ (НДС 22%), а также строгий учет денежных средств по принципу двойной записи (Ledger-First).',
    termsAndDefinitions: [
      {
        term: 'Ledger-First Principle',
        definition: 'Архитектурный инвариант: любая денежная мутация ОБЯЗАНА сначала фиксировать неизменяемую запись в таблице LedgerEntry ДО обновления баланса пользователя в User.balance.',
      },
      {
        term: 'BigInt Копейки (ExactMath)',
        definition: 'Полный отказ от чисел с плавающей запятой (float/double) в денежных операциях. Все суммы рассчитываются в целочисленных копейках с банковским округлением Half-Even.',
      },
      {
        term: 'Фискальный признак (vat_code)',
        definition: 'Код ставки НДС для чеков онлайн-кассы: vat_code: 10 (НДС 22% согласно 425-ФЗ) при обороте >20 млн ₽, либо vat_code: 1 (Без НДС по ст. 145 НК РФ) при льготном УСН.',
      },
      {
        term: 'Timing-Safe Webhook Verification',
        definition: 'Криптографическая проверка HMAC SHA-256 подписи платежных вебхуков через crypto.timingSafeEqual для предотвращения атак по времени (Side-Channel Attacks).',
      },
    ],
    technicalArchitecture: {
      prismaTables: ['User', 'LedgerEntry', 'PaymentTransaction', 'ReceiptLog', 'SystemSettings'],
      serverActions: ['settingsUpdateAction', 'processManualPaymentAction', 'handlePaymentWebhook'],
      level1Services: ['walletOps', 'exactMath', 'paymentGatewayService', 'receiptService'],
      description: 'Финансовое ядро платформы: шлюз ЮKassa -> timing-safe вебхук -> ACID-транзакция (LedgerEntry -> User.balance) -> асинхронная фискализация в ОФД.',
    },
    steps: [
      {
        stepNumber: 1,
        title: 'Указание учетных данных ЮKassa',
        instruction: 'Перейдите в настройки системы (/admin/settings) и укажите Shop ID и Секретный ключ (AES-256 Vault).',
        actionUrl: '/admin/settings',
        actionLabel: 'Настройки эквайринга',
      },
      {
        stepNumber: 2,
        title: 'Конфигурация ставки НДС по 425-ФЗ',
        instruction: 'Выберите режим налогообложения: УСН без НДС (vat_code: 1) при лимите до 20 млн ₽, либо ставку НДС 22% (vat_code: 10).',
      },
      {
        stepNumber: 3,
        title: 'Установка вебхука и генерация Inbound-секрета',
        instruction: 'Скопируйте URL вебхука (/api/webhooks/yookassa) в личный кабинет ЮKassa и введите Inbound Secret для верификации HMAC.',
      },
      {
        stepNumber: 4,
        title: 'Настройка валют и синхронизация курсов ЦБ РФ (USD, EUR, USDT)',
        instruction: 'В настройках валют укажите базовые курсы и наценку, либо активируйте авто-синхронизацию с ЦБ РФ. Убедитесь, что курсы провайдеров конвертируются в копейки RUB.',
        actionUrl: '/admin/settings',
        actionLabel: 'Настройки валют и курсов',
      },
      {
        stepNumber: 5,
        title: 'Тестовая транзакция в режиме ACQUIRING_TEST',
        instruction: 'Проведите контрольное пополнение на 10.00 ₽. Убедитесь в создании записи в LedgerEntry и статусе чека SUCCESS.',
      },
    ],
    protectiveMechanisms: [
      {
        title: 'Защита от Transaction Escape',
        description: 'Строгий запрет на использование глобального db.* внутри транзакций Prisma (tx.*). Нарушение блокируется автоматическим AST-линтером.',
        ruleCode: 'FIN-NO-TX-ESCAPE',
      },
      {
        title: 'Идемпотентность финансовых вызовов',
        description: 'Каждая входящая транзакция пополнения или списания снабжается уникальным idempotencyKey, исключающим задвоение средств при сетевых таймаутах.',
        ruleCode: 'FIN-IDEMPOTENCY-KEY',
      },
      {
        title: 'Fail-Closed Guard вебхуков',
        description: 'При отсутствии или повреждении сигнатуры HMAC вебхук немедленно отклоняется с кодом 401 без обработки тела платежа.',
        ruleCode: 'FIN-WEBHOOK-FAIL-CLOSED',
      },
    ],
    troubleshooting: [
      {
        scenario: 'Расхождение баланса с суммой проводок Леджера',
        symptoms: 'Сумма проводок LedgerEntry не сходится с текущим значением User.balance.',
        remedy: 'Запустите скрипт аудита `npm run test -- test/ledger-audit.test.ts`. При обнаружении ручных правок выполните корректировку строго через WalletOps.adminAdjust() с обязательным auditAdminAwaitable.',
        files: ['src/lib/wallet/ops.ts', 'src/services/financial/ledger-reconciler.service.ts'],
      },
      {
        scenario: 'Ошибка отправки чека в онлайн-кассу (54-ФЗ)',
        symptoms: 'В журнале чеков (/admin/finance/receipts) отображается статус FAILED с кодом неверной ставки НДС.',
        remedy: 'Проверьте значение vat_code в настройках фискализации. Убедитесь, что ИНН и наименование позиции соответствуют требованиям ФФД 1.2.',
        files: ['src/lib/fiscal/receipt-service.ts'],
      },
    ],
  },
];
