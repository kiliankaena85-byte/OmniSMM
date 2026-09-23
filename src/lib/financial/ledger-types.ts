/**
 * @file ledger-types.ts
 * @module lib/financial/ledger-types
 *
 * Единый источник правды для всех типов транзакций LedgerEntry.
 * Используется в: WalletOps, Server Actions (фильтры), таблицах UI, бейджах.
 *
 * Схема Prisma сохраняет transactionType как String — никакой миграции enum не нужно.
 * Расширение типов — zero-downtime изменение.
 */

/** Все допустимые значения transactionType в LedgerEntry */
export const LEDGER_TRANSACTION_TYPES = [
  'TOPUP',        // 💳 Пополнение баланса (ЮKassa, СБП, CryptoBot, API)
  'ORDER_CHARGE', // 🛒 Оплата/списание при создании заказа
  'ORDER_CANCEL', // 🚫 Возврат при отмене заказа администратором
  'REFUND',       // ↩️ Авто-возврат (ошибка провайдера, TTL, DLQ)
  'ADJUSTMENT',   // ⚙️ Ручная корректировка баланса администратором
  'COMPENSATION', // 🎁 Бонус / компенсация клиенту
  'REROUTE',      // 🔄 Перезапуск/перемаршрутизация заказа (повторное списание)
  // legacy — остаётся для обратной совместимости со старыми записями в БД
  'PAYMENT',      // (устаревший) — был общим типом до v2.0
] as const;

export type LedgerTransactionType = typeof LEDGER_TRANSACTION_TYPES[number];

/** Конфиг для UI: метка, эмодзи, CSS-классы бейджа */
export interface LedgerTypeConfig {
  label: string;
  emoji: string;
  badgeClass: string;
}

export const LEDGER_TYPE_CONFIG: Record<LedgerTransactionType, LedgerTypeConfig> = {
  TOPUP: {
    label: 'Пополнение баланса',
    emoji: '💳',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  },
  ORDER_CHARGE: {
    label: 'Оплата заказа',
    emoji: '🛒',
    badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
  },
  ORDER_CANCEL: {
    label: 'Отмена заказа',
    emoji: '🚫',
    badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  },
  REFUND: {
    label: 'Авто-возврат',
    emoji: '↩️',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  ADJUSTMENT: {
    label: 'Корректировка',
    emoji: '⚙️',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  },
  COMPENSATION: {
    label: 'Бонус / компенсация',
    emoji: '🎁',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
  REROUTE: {
    label: 'Перезапуск заказа',
    emoji: '🔄',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  // legacy — маппинг на display по знаку amount
  PAYMENT: {
    label: 'Платёж (legacy)',
    emoji: '💰',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
};

/**
 * Резолвит тип транзакции для отображения.
 * Для legacy-записей PAYMENT определяет направление по знаку amount.
 */
export function resolveLedgerTypeForDisplay(
  transactionType: string,
  amount: number,
  adminId: string | null
): LedgerTransactionType {
  // Явный ADJUSTMENT по adminId (ручная корректировка)
  if (adminId && transactionType === 'PAYMENT') {
    return 'ADJUSTMENT';
  }
  // Legacy PAYMENT → определяем по знаку
  if (transactionType === 'PAYMENT') {
    return amount >= 0 ? 'TOPUP' : 'ORDER_CHARGE';
  }
  // Если тип известный — возвращаем как есть
  if (LEDGER_TRANSACTION_TYPES.includes(transactionType as LedgerTransactionType)) {
    return transactionType as LedgerTransactionType;
  }
  // Fallback
  return amount >= 0 ? 'TOPUP' : 'ORDER_CHARGE';
}

/** Опции для select/фильтра в UI (все 7 + ALL) */
export const LEDGER_TYPE_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ALL',          label: '📋 Все операции' },
  { value: 'TOPUP',        label: '💳 Пополнение баланса' },
  { value: 'ORDER_CHARGE', label: '🛒 Оплата заказа' },
  { value: 'ORDER_CANCEL', label: '🚫 Отмена заказа' },
  { value: 'REFUND',       label: '↩️ Авто-возврат' },
  { value: 'COMPENSATION', label: '🎁 Бонус / компенсация' },
  { value: 'ADJUSTMENT',   label: '⚙️ Ручная корректировка' },
  { value: 'REROUTE',      label: '🔄 Перезапуск заказа' },
];

/** Zod-энум для валидации параметров фильтра в Server Actions */
export const LEDGER_TYPE_ZOD_VALUES = [
  'ALL', 'TOPUP', 'ORDER_CHARGE', 'ORDER_CANCEL',
  'REFUND', 'COMPENSATION', 'ADJUSTMENT', 'REROUTE', 'PAYMENT',
] as const;
export type LedgerTypeFilterValue = typeof LEDGER_TYPE_ZOD_VALUES[number];
