export const SUPPORT_CREDIT_REASONS = [
  'Компенсация за задержку заказа',
  'Ошибка провайдера (сбой поставщика)',
  'Жест доброй воли (Goodwill)',
  'Бонус лояльности / Промокод',
  'Ручное пополнение / Корректировка',
  'Иное начисление (см. комментарий)',
] as const;

export const SUPPORT_DEBIT_REASONS = [
  'Корректировка ошибочного начисления',
  'Штраф / Чарджбэк платежа',
  'Списание по запросу клиента (вывод)',
  'Техническая корректировка баланса',
  'Иное списание (см. комментарий)',
] as const;

export type SupportCreditReason = (typeof SUPPORT_CREDIT_REASONS)[number];
export type SupportDebitReason = (typeof SUPPORT_DEBIT_REASONS)[number];
