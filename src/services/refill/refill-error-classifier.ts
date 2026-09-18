/**
 * Refill Error Classifier (OmniSMM 1.0)
 * 
 * Classifies errors from upstream SMM providers (Vexboost, SocProof, etc.)
 * into deterministic business rejections vs transient system/network failures.
 * 
 * Deterministic business rejections (e.g. `is_not_available`, `guarantee_expired`, `drop_not_detected`)
 * must NOT trigger retries or DLQ emergencies. They represent final business states (REJECTED).
 */

export type RefillErrorCode =
  | 'REFILL_NOT_AVAILABLE'
  | 'GUARANTEE_EXPIRED'
  | 'ORDER_NOT_COMPLETED'
  | 'ALREADY_REFILLED'
  | 'DROP_NOT_DETECTED'
  | 'LIMIT_REACHED'
  | 'TOO_SOON'
  | 'ORDER_CANCELED'
  | 'ORDER_NOT_FOUND'
  | 'TARGET_UNAVAILABLE_OR_PRIVATE'
  | 'UNKNOWN_BUSINESS_REJECTION';

export type RefillErrorClassification =
  | {
      type: 'BUSINESS_REJECTION';
      code: RefillErrorCode;
      userMessage: string;
      reason: string;
    }
  | {
      type: 'TRANSIENT_FAILURE';
      code: 'TRANSIENT_NETWORK_OR_SERVER_ERROR';
      retryable: true;
      reason: string;
    };

interface BusinessPatternDef {
  pattern: RegExp;
  code: RefillErrorCode;
  userMessage: string;
}

const BUSINESS_PATTERNS: BusinessPatternDef[] = [
  {
    // Vexboost / Universal / SMM Panel: "is_not_available", "not_available", "refill is not available"
    pattern: /(is_not_available|not_available|\bnot available\b|refill is not available|refill not available|refill_not_available|service does not support refill|service does not provide refill|\bno refill\b|refill is not supported|refill not supported|refill[_\s]+(?:is[_\s]+)?disabled)/i,
    code: 'REFILL_NOT_AVAILABLE',
    userMessage: 'Гарантийная докрутка недоступна для данной услуги или поставщик отключил refill.',
  },
  {
    pattern: /(guarantee_expired|guarantee expired|warranty_expired|warranty expired|out of guarantee|warranty ended|guarantee ended|refill period has ended|refill period ended|refill ended|guarantee has ended|warranty has ended)/i,
    code: 'GUARANTEE_EXPIRED',
    userMessage: 'Срок действия гарантийного периода на докрутку истёк.',
  },
  {
    pattern: /(order_must_be_completed|order must be completed|order is not completed|not completed|has not yet ended|order still in progress|order is in progress|order in progress)/i,
    code: 'ORDER_NOT_COMPLETED',
    userMessage: 'Заказ ещё выполняется поставщиком. Докрутка возможна только после завершения.',
  },
  {
    pattern: /(already_refilled|already refilled|refill already in progress|refill in progress|refill is already running|refill already submitted|already submitted|refill already queued|refill already requested|refill is processing|already queued)/i,
    code: 'ALREADY_REFILLED',
    userMessage: 'Заявка на докрутку уже принята поставщиком и находится в процессе выполнения.',
  },
  {
    pattern: /(drop_not_detected|drop not detected|no drop|no drop detected|drop is not detected|count not dropped|drop not found|not enough drops|no drops|greater than or equal to start count|higher than start count)/i,
    code: 'DROP_NOT_DETECTED',
    userMessage: 'Поставщик не зафиксировал списания подписчиков или просмотров по целевой ссылке.',
  },
  {
    pattern: /(refill[_\s]+limit[_\s]+reached|max[_\s]+refills?[_\s]+reached|refill[_\s]+limit[_\s]+exceeded|max_refill_reached|refill count exceeded|maximum refill reached)/i,
    code: 'LIMIT_REACHED',
    userMessage: 'Превышен максимальный лимит гарантийных докруток для данного заказа.',
  },
  {
    pattern: /(too soon to refill|\btoo soon\b|wait before refill|please wait \d+|try again in|cooldown active|wait \d+\s*hours|can only request refill after)/i,
    code: 'TOO_SOON',
    userMessage: 'Слишком рано для повторной докрутки, подождите некоторое время.',
  },
  {
    pattern: /(order canceled|order refunded|order is canceled|order was canceled|order_canceled|order_refunded|order has been canceled)/i,
    code: 'ORDER_CANCELED',
    userMessage: 'Заказ был отменён или возвращён у поставщика.',
  },
  {
    pattern: /(incorrect order id|order not found|order does not exist|invalid order id|wrong order id|order_not_found)/i,
    code: 'ORDER_NOT_FOUND',
    userMessage: 'Заказ не найден в базе поставщика услуг.',
  },
  {
    pattern: /(link is private|account is private|profile is private|channel not found|post not found|post deleted|page not found|invalid link|link not accessible|private account|private link)/i,
    code: 'TARGET_UNAVAILABLE_OR_PRIVATE',
    userMessage: 'Профиль или ссылка недоступна (приватный аккаунт или публикация была удалена).',
  },
];

/**
 * Classifies an error message from a provider's refill API response
 */
export function classifyRefillError(rawError: string | null | undefined): RefillErrorClassification {
  const normalized = (rawError || '').trim();

  if (!normalized) {
    return {
      type: 'TRANSIENT_FAILURE',
      code: 'TRANSIENT_NETWORK_OR_SERVER_ERROR',
      retryable: true,
      reason: 'Empty error response from provider',
    };
  }

  // Pre-filter: Infrastructure, proxy, network, and HTTP server failures are strictly transient
  // Must NOT be mistakenly matched as business rejections even if error page contains words like "not available"
  const isHttpOrInfrastructureError =
    /\b(50[0-4]|52[0-9]|408|429)\b/.test(normalized) ||
    /(bad gateway|gateway timeout|service temporarily unavailable|service unavailable|internal server error|web server is down|web server is not available)/i.test(normalized) ||
    /(etimedout|econnreset|econnrefused|enotfound|enetunreach|socket hang up|fetch failed|network error|request timeout|upstream request failed)/i.test(normalized) ||
    /(rate[_\s]*limit|too many requests|cloudflare)/i.test(normalized);

  if (isHttpOrInfrastructureError) {
    return {
      type: 'TRANSIENT_FAILURE',
      code: 'TRANSIENT_NETWORK_OR_SERVER_ERROR',
      retryable: true,
      reason: normalized,
    };
  }

  for (const def of BUSINESS_PATTERNS) {
    if (def.pattern.test(normalized)) {
      return {
        type: 'BUSINESS_REJECTION',
        code: def.code,
        userMessage: def.userMessage,
        reason: normalized,
      };
    }
  }

  return {
    type: 'TRANSIENT_FAILURE',
    code: 'TRANSIENT_NETWORK_OR_SERVER_ERROR',
    retryable: true,
    reason: normalized,
  };
}

/**
 * Helper to determine if an error is a permanent business rejection
 */
export function isRefillBusinessRejection(rawError: string | null | undefined): boolean {
  return classifyRefillError(rawError).type === 'BUSINESS_REJECTION';
}
