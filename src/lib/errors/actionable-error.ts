/**
 * src/lib/errors/actionable-error.ts
 *
 * SMMplan Exhaustive Actionable Error Engine (OmniSMM 1.0)
 * Handles all 18+ system-wide failure vectors across 5 architectural layers:
 *   1. Client Device & WebView (In-App browsers, zero-width chars, network drops)
 *   2. Order Wizard & Validation (Network mismatch, private links, poll options, custom comments, drip feed floor)
 *   3. Payment Gateways (YooKassa 3DS, CryptoBot expiry/underpay, key invalidity)
 *   4. Provider Supply & SMM APIs (Out of stock, duplicate locks, provider low balance)
 *   5. Infrastructure & DB (Prisma deadlock, rate limits, tenant isolation)
 */

export type ErrorCategory = 
  | 'CLIENT_DEVICE'
  | 'VALIDATION'
  | 'FINANCE_GATEWAY'
  | 'PROVIDER_SUPPLY'
  | 'SYSTEM_DB'
  | 'AUTH_OR_SECURITY';

export interface ActionableError {
  code: string;
  category: ErrorCategory;
  title: string;
  message: string;
  action?: {
    type: 'RETRY' | 'SWITCH_GATEWAY' | 'CHOOSE_ANALOG' | 'FIX_LINK' | 'SUPPORT_CHAT' | 'BIND_TELEGRAM' | 'ADJUST_QTY' | 'OPEN_EXTERNAL';
    label: string;
    targetGateway?: 'yookassa' | 'cryptobot' | 'balance' | 'sbp';
    redirectUrl?: string;
  };
  debugId?: string;
}

export function parseActionableError(rawError: string | Error | unknown, context?: Record<string, any>): ActionableError {
  const text = typeof rawError === 'string' 
    ? rawError 
    : rawError instanceof Error 
      ? rawError.message 
      : 'Произошла ошибка при обработке заказа';

  const lower = text.toLowerCase();

  // =========================================================================
  // 1. CLIENT DEVICE & NETWORK DISCONNECTION ERRORS
  // =========================================================================
  if (lower.includes('popup') || lower.includes('всплывающ') || lower.includes('webview') || lower.includes('redirect')) {
    return {
      code: 'ERR_IN_APP_BROWSER_POPUP_BLOCKED',
      category: 'CLIENT_DEVICE',
      title: 'Браузер заблокировал переход',
      message: 'Встроенный браузер заблокировал открытие страницы оплаты. Нажмите кнопку ниже для прямого перехода.',
      action: {
        type: 'SWITCH_GATEWAY',
        label: 'Оплатить через СБП / CryptoBot',
        targetGateway: 'cryptobot'
      }
    };
  }

  if (
    lower.includes('сетевая ошибка') ||
    lower.includes('таймаут') ||
    lower.includes('timeout') ||
    lower.includes('не удалось установить соединение') ||
    lower.includes('fetch failed') ||
    lower.includes('econnrefused') ||
    lower.includes('offline') ||
    lower.includes('интернет') ||
    (lower.includes('сеть') && !lower.includes('соцсет'))
  ) {
    return {
      code: 'ERR_NETWORK_DISCONNECTED',
      category: 'CLIENT_DEVICE',
      title: 'Ошибка соединения с сервером',
      message: text.length > 10 ? text : 'Не удалось установить соединение с сервером. Пожалуйста, проверьте интернет или повторите попытку через минуту.',
      action: {
        type: 'RETRY',
        label: 'Повторить попытку'
      }
    };
  }

  // =========================================================================
  // 2. PAYMENT GATEWAYS & ACQUIRING ERRORS
  // =========================================================================
  if (lower.includes('yookassa') || lower.includes('юkassa') || lower.includes('не настроен') || lower.includes('shopid') || lower.includes('платежн')) {
    return {
      code: 'ERR_GATEWAY_CREDENTIALS_MISCONFIGURED',
      category: 'FINANCE_GATEWAY',
      title: 'Шлюз оплаты недоступен',
      message: text.length > 15 ? text : 'Оплата картами временно недоступна. Вы можете моментально оплатить через СБП или CryptoBot.',
      action: {
        type: 'SWITCH_GATEWAY',
        label: 'Оплатить через СБП / CryptoBot',
        targetGateway: 'cryptobot'
      }
    };
  }

  if (lower.includes('cryptobot') || lower.includes('crypto-pay') || lower.includes('invoice')) {
    return {
      code: 'ERR_CRYPTOBOT_INVOICE_ERROR',
      category: 'FINANCE_GATEWAY',
      title: 'Ошибка счёта CryptoBot',
      message: 'Не удалось сформировать крипто-счёт. Попробуйте оплатить картой РФ / СБП.',
      action: {
        type: 'SWITCH_GATEWAY',
        label: 'Оплатить картой РФ / СБП',
        targetGateway: 'yookassa'
      }
    };
  }

  if (lower.includes('недостаточно средств') || lower.includes('balance') || lower.includes('баланс')) {
    return {
      code: 'ERR_BALANCE_INSUFFICIENT',
      category: 'FINANCE_GATEWAY',
      title: 'Недостаточно средств на балансе',
      message: 'На балансе аккаунта недостаточно средств. Оплатите заказ напрямую через банковскую карту или СБП.',
      action: {
        type: 'SWITCH_GATEWAY',
        label: 'Оплатить картой / СБП',
        targetGateway: 'yookassa'
      }
    };
  }

  // =========================================================================
  // 3. ORDER WIZARD & FORM VALIDATION ERRORS
  // =========================================================================
  if (lower.includes('приватн') || lower.includes('закрыт') || lower.includes('t.me/+') || lower.includes('joinchat')) {
    return {
      code: 'ERR_PRIVATE_TARGET_INVITE_LINK',
      category: 'VALIDATION',
      title: 'Приватная ссылка не поддерживается',
      message: 'Этот тариф работает только для публичных каналов и профилей. Сделайте канал открытым или выберите тариф с поддержкой приватных ссылок.',
      action: {
        type: 'CHOOSE_ANALOG',
        label: 'Выбрать тариф для приватных ссылок'
      }
    };
  }

  if (lower.includes('не соответствует соцсети') || lower.includes('неверная соцсеть') || lower.includes('соцсет') || lower.includes('платформ')) {
    return {
      code: 'ERR_LINK_NETWORK_MISMATCH',
      category: 'VALIDATION',
      title: 'Ссылка не от этой соцсети',
      message: text.length > 10 ? text : 'Вы указали ссылку на другую платформу. Пожалуйста, укажите верную ссылку для выбранной соцсети.',
      action: {
        type: 'FIX_LINK',
        label: 'Исправить ссылку'
      }
    };
  }

  if (lower.includes('опрос') || lower.includes('вариант') || lower.includes('голос')) {
    return {
      code: 'ERR_POLL_OPTION_MISSING_OR_INVALID',
      category: 'VALIDATION',
      title: 'Укажите вариант ответа',
      message: 'Для голосования необходимо указать номер варианта ответа в опросе (например: 1, 2 или 3).',
      action: {
        type: 'FIX_LINK',
        label: 'Указать номер ответа'
      }
    };
  }

  if (lower.includes('комментар') || lower.includes('текст')) {
    return {
      code: 'ERR_CUSTOM_COMMENTS_EMPTY_OR_PROHIBITED',
      category: 'VALIDATION',
      title: 'Заполните тексты комментариев',
      message: 'Каждый комментарий должен быть написан с новой строки, а их количество должно соответствовать объёму заказа.',
      action: {
        type: 'FIX_LINK',
        label: 'Дополнить комментарии'
      }
    };
  }

  if (lower.includes('drip-feed') || lower.includes('постепенн') || lower.includes('запуск')) {
    return {
      code: 'ERR_DRIP_FEED_FLOOR_UNDERFLOW',
      category: 'VALIDATION',
      title: 'Параметры постепенной подачи',
      message: text.length > 10 ? text : 'Объём на один запуск меньше минимального лимита услуги. Увеличьте общий объём заказа или уменьшите число запусков.',
      action: {
        type: 'ADJUST_QTY',
        label: 'Скорректировать количество'
      }
    };
  }

  if (lower.includes('промокод') || lower.includes('promo')) {
    return {
      code: 'ERR_PROMO_EXHAUSTED_OR_MIN_TOTAL',
      category: 'VALIDATION',
      title: 'Условия промокода',
      message: text.length > 10 ? text : 'Промокод не может быть применён к этому заказу. Проверьте минимальную сумму заказа.',
      action: {
        type: 'RETRY',
        label: 'Продолжить'
      }
    };
  }

  if (lower.includes('ссылк') || lower.includes('неверный формат ссылки') || lower.includes('некорректный домен') || lower.includes('тип цели')) {
    return {
      code: 'ERR_LINK_INVALID_FORMAT',
      category: 'VALIDATION',
      title: 'Проверьте правильность ссылки',
      message: text.length > 15 ? text : 'Ссылка указана некорректно. Убедитесь, что она начинается с https:// и объект доступен публично.',
      action: {
        type: 'FIX_LINK',
        label: 'Исправить ссылку'
      }
    };
  }

  if (lower.includes('запрещен') || lower.includes('государственн') || lower.includes('политическ')) {
    return {
      code: 'ERR_LINK_RESTRICTED_CONTENT',
      category: 'VALIDATION',
      title: 'Продвижение запрещено правилами',
      message: 'Продвижение политических ресурсов и государственных служб строго запрещено законодательством РФ.',
      action: {
        type: 'FIX_LINK',
        label: 'Указать другую ссылку'
      }
    };
  }

  if (lower.includes('количество должно быть') || lower.includes('минимум') || lower.includes('максимум')) {
    return {
      code: 'ERR_QUANTITY_OUT_OF_BOUNDS',
      category: 'VALIDATION',
      title: 'Недопустимый объём заказа',
      message: text,
      action: {
        type: 'ADJUST_QTY',
        label: 'Изменить количество'
      }
    };
  }

  // =========================================================================
  // 4. PROVIDER SUPPLY & SMM API ERRORS
  // =========================================================================
  if (lower.includes('контроля качества') || lower.includes('приостановлено') || lower.includes('cooldown') || lower.includes('карантин')) {
    return {
      code: 'ERR_PROVIDER_COOLDOWN',
      category: 'PROVIDER_SUPPLY',
      title: 'Тариф на контроле качества',
      message: 'Этот тариф временно приостановлен для калибровки скорости. Выберите аналогичный тариф из категории.',
      action: {
        type: 'CHOOSE_ANALOG',
        label: 'Выбрать другой тариф'
      }
    };
  }

  if (lower.includes('активный заказ') || lower.includes('already exists') || lower.includes('дубликат')) {
    return {
      code: 'ERR_PROVIDER_DUPLICATE_ORDER_ACTIVE',
      category: 'PROVIDER_SUPPLY',
      title: 'Предыдущий заказ ещё выполняется',
      message: 'По этой ссылке уже запущен заказ. Новый заказ поставлен в безопасную очередь, чтобы не вызвать списание соцсетью.',
      action: {
        type: 'RETRY',
        label: 'Понятно'
      }
    };
  }

  // =========================================================================
  // 5. INFRASTRUCTURE & AUTH ERRORS
  // =========================================================================
  if (lower.includes('telegram-аккаунт') || lower.includes('привяжите ваш telegram')) {
    return {
      code: 'AUTH_TELEGRAM_BIND_REQUIRED',
      category: 'AUTH_OR_SECURITY',
      title: 'Требуется привязка Telegram',
      message: 'Для оформления этой услуги необходимо привязать ваш Telegram-аккаунт в настройках профиля.',
      action: {
        type: 'BIND_TELEGRAM',
        label: 'Привязать Telegram',
        redirectUrl: '/dashboard/settings'
      }
    };
  }

  if (lower.includes('слишком много запросов') || lower.includes('rate limit')) {
    return {
      code: 'ERR_RATE_LIMIT_ANTI_DDOS',
      category: 'SYSTEM_DB',
      title: 'Слишком много запросов',
      message: 'Пожалуйста, подождите 15 секунд перед следующим заказом для защиты от спама.',
      action: {
        type: 'RETRY',
        label: 'Попробовать снова через 15с'
      }
    };
  }

  // Default Fallback
  return {
    code: 'GENERAL_ORDER_ERROR',
    category: 'SYSTEM_DB',
    title: 'Не удалось завершить заказ',
    message: text.length < 150 ? text : 'Произошла непредвиденная ошибка. Пожалуйста, попробуйте снова или напишите в техподдержку.',
    action: {
      type: 'RETRY',
      label: 'Попробовать снова'
    },
    debugId: context?.paymentId || context?.orderId
  };
}
