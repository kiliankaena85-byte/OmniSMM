/**
 * Professional Order & Gateway Error Taxonomy for OmniSMM 1.0.
 * Classifies raw errors from external providers, network gateways, and internal engines
 * into standardized, deterministic error codes with human-friendly Russian explanations
 * and actionable instructions for Support, Operators, and Admins.
 */

export interface ClassifiedOrderError {
  code: string;
  category: 'LINK' | 'PROVIDER' | 'GATEWAY' | 'LIMIT' | 'PAYMENT' | 'SYSTEM';
  titleRu: string;
  descriptionRu: string;
  recommendedAction: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const ERROR_TAXONOMY: Record<string, Omit<ClassifiedOrderError, 'code'>> = {
  // ── LINK ERRORS (Client-side Issues) ──
  ERR_LINK_PRIVATE: {
    category: 'LINK',
    titleRu: 'Закрытый профиль / приватный контент',
    descriptionRu: 'Целевой аккаунт или публикация закрыты настройками приватности соцсети. Поставщик не может доставить услугу.',
    recommendedAction: 'Попросить клиента открыть профиль/пост в настройках приватности соцсети и оформить заказ повторно.',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-500/30'
  },
  ERR_LINK_INVALID: {
    category: 'LINK',
    titleRu: 'Некорректная ссылка / неверный формат',
    descriptionRu: 'Указанный формат ссылки не соответствует требованиям выбранной соцсети (например, ссылка на канал вместо поста).',
    recommendedAction: 'Проверить формат ссылки в заказе и указать клиенту корректный пример (например, https://t.me/post/123).',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-500/30'
  },
  ERR_LINK_NOT_FOUND: {
    category: 'LINK',
    titleRu: 'Страница или контент удалены (404)',
    descriptionRu: 'Публикация, видеоролик или страница пользователя не найдены на серверах социальной сети.',
    recommendedAction: 'Уведомить клиента, что контент по ссылке недоступен или был удален.',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-500/30'
  },
  ERR_LINK_DUPLICATE_ACTIVE: {
    category: 'LIMIT',
    titleRu: 'Дублирующий заказ уже в работе',
    descriptionRu: 'На данную ссылку уже запущен активный заказ у этого провайдера. Повторный запуск заблокирован защитой от наложения.',
    recommendedAction: 'Дождаться завершения текущего заказа по этой ссылке, либо выбрать другой провайдер.',
    badgeBg: 'bg-sky-500/10',
    badgeText: 'text-sky-700 dark:text-sky-300',
    badgeBorder: 'border-sky-500/30'
  },

  // ── PROVIDER ERRORS (External Gateway Issues) ──
  ERR_PROVIDER_LOW_BALANCE: {
    category: 'PROVIDER',
    titleRu: 'Исчерпан баланс у провайдера',
    descriptionRu: 'На балансе шлюза поставщика недостаточно средств для размещения заказа. Включен авто-возврат средств клиенту.',
    recommendedAction: 'Администратору: пополнить баланс у шлюза провайдера или активировать Failover-маршрут (кнопка ⟳ Перезапустить).',
    badgeBg: 'bg-red-500/10',
    badgeText: 'text-red-700 dark:text-red-300',
    badgeBorder: 'border-red-500/30'
  },
  ERR_PROVIDER_SERVICE_DISABLED: {
    category: 'PROVIDER',
    titleRu: 'Услуга отключена или удалена поставщиком',
    descriptionRu: 'ID услуги больше недоступен у внешнего провайдера (услуга на техработах или снята с продажи).',
    recommendedAction: 'Переключить услугу на резервного поставщика в Каталоге или выбрать другой маршрут.',
    badgeBg: 'bg-orange-500/10',
    badgeText: 'text-orange-700 dark:text-orange-300',
    badgeBorder: 'border-orange-500/30'
  },
  ERR_PROVIDER_RATE_LIMIT: {
    category: 'PROVIDER',
    titleRu: 'Превышен лимит запросов к API провайдера',
    descriptionRu: 'Внешний шлюз поставщика временно ограничил входящий поток запросов (HTTP 429 Too Many Requests).',
    recommendedAction: 'Очередь автоматически повторит отправку через несколько минут. Действий не требуется.',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-500/30'
  },
  ERR_PROVIDER_MAINTENANCE: {
    category: 'PROVIDER',
    titleRu: 'Технические работы у провайдера',
    descriptionRu: 'Серверы поставщика временно закрыты на плановое техническое обслуживание.',
    recommendedAction: 'Поставить заказ на паузу или перезапустить через альтернативный шлюз.',
    badgeBg: 'bg-zinc-500/10',
    badgeText: 'text-zinc-700 dark:text-zinc-300',
    badgeBorder: 'border-zinc-500/30'
  },

  // ── GATEWAY / NETWORK ERRORS ──
  ERR_GATEWAY_TIMEOUT: {
    category: 'GATEWAY',
    titleRu: 'Таймаут ответа шлюза (> 10 сек)',
    descriptionRu: 'Внешний сервер провайдера не ответил в течение установленного таймаута (ConnectTimeout / Socket Hang Up).',
    recommendedAction: 'Проверить состояние сетевого подключения к провайдеру и нажать «⟳ Перезапустить».',
    badgeBg: 'bg-red-500/10',
    badgeText: 'text-red-700 dark:text-red-300',
    badgeBorder: 'border-red-500/30'
  },
  ERR_GATEWAY_HTTP_5XX: {
    category: 'GATEWAY',
    titleRu: 'Серверная ошибка шлюза (HTTP 500/502/504)',
    descriptionRu: 'Сбой на серверах провайдера или авария инфраструктуры Cloudflare/Nginx поставщика.',
    recommendedAction: 'Нажать «⟳ Перезапустить» или переключить заказ на запасной провайдер.',
    badgeBg: 'bg-red-500/10',
    badgeText: 'text-red-700 dark:text-red-300',
    badgeBorder: 'border-red-500/30'
  },
  ERR_GATEWAY_SSRF: {
    category: 'GATEWAY',
    titleRu: 'Сетевая блокировка шлюза (SSRF / Private IP)',
    descriptionRu: 'Запрос к API поставщика заблокирован встроенным сетевым экраном SSRF (адрес шлюза разрешается в закрытый/приватный IP).',
    recommendedAction: 'Проверить URL шлюза поставщика в настройках, DNS-маршрутизацию или работу прокси-сервера Clash/Mihomo.',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-500/30'
  },

  // ── LIMIT & QUANTITY ERRORS ──
  ERR_LIMIT_MIN_QTY: {
    category: 'LIMIT',
    titleRu: 'Количество меньше минимального порога',
    descriptionRu: 'Заказанный объем меньше минимально допустимого лимита у поставщика.',
    recommendedAction: 'Сверить минимальный объем услуги в Каталоге и обновить настройки.',
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-700 dark:text-purple-300',
    badgeBorder: 'border-purple-500/30'
  },
  ERR_LIMIT_MAX_QTY: {
    category: 'LIMIT',
    titleRu: 'Превышен максимальный лимит объема',
    descriptionRu: 'Заказанный объем превышает максимальную разовую емкость услуги у провайдера.',
    recommendedAction: 'Разбить заказ на несколько запусков (Dripfeed) или выбрать услугу с большим пулом.',
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-700 dark:text-purple-300',
    badgeBorder: 'border-purple-500/30'
  },

  // ── FINANCIAL PROTECTION & MARGIN ERRORS ──
  ERR_PRICE_DRIFT_NEGATIVE_MARGIN: {
    category: 'LIMIT',
    titleRu: 'Отрицательная маржа (Защита от убытка)',
    descriptionRu: 'Себестоимость у провайдера превышает оплату клиента (поставщик поднял цены). Заказ удержан в очереди PENDING_CHECK.',
    recommendedAction: 'Нажать «Сменить провайдера» на более дешевого, либо «Отменить и вернуть» 100% средств на баланс клиента.',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-500/30'
  },
  ERR_PAYMENT_EXPIRED: {
    category: 'PAYMENT',
    titleRu: 'Время ожидания оплаты истекло (24ч)',
    descriptionRu: 'Клиент не завершил платеж в течение суток. Заказ автоматически закрыт системой.',
    recommendedAction: 'Если клиент утверждает, что оплатил, проверить статус счета в платежном шлюзе по ID транзакции.',
    badgeBg: 'bg-zinc-500/10',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    badgeBorder: 'border-zinc-500/30'
  },
  ERR_PAYMENT_FAILED: {
    category: 'PAYMENT',
    titleRu: 'Платеж отклонен банком или шлюзом',
    descriptionRu: 'Платежная система отклонила транзакцию (недостаточно средств на карте, 3DS отказ).',
    recommendedAction: 'Попробовать альтернативный платежный метод (СБП, ЮKassa, Крипта, Банковская карта).',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-500/30'
  },

  // ── GENERAL SYSTEM ERROR ──
  ERR_SYSTEM_GENERAL: {
    category: 'SYSTEM',
    titleRu: 'Системное исключение / Неизвестная ошибка',
    descriptionRu: 'Непредвиденное исключение во время обработки задачи.',
    recommendedAction: 'Проверить технические логи инцидента или обратиться к ведущему разработчику.',
    badgeBg: 'bg-zinc-500/10',
    badgeText: 'text-zinc-700 dark:text-zinc-300',
    badgeBorder: 'border-zinc-500/30'
  }
};

/**
 * Deterministically classifies any incoming error string into a standardized Error Taxonomy Code.
 */
export function classifyOrderError(rawError: string | null | undefined): ClassifiedOrderError | null {
  if (!rawError) return null;
  const str = rawError.trim();
  if (!str) return null;

  const lower = str.toLowerCase();

  // 0. SSRF & Gateway Network Security errors (must precede private content check)
  if (
    lower.includes('private ip') ||
    lower.includes('ssrf') ||
    lower.includes('blocked url') ||
    lower.includes('loopback') ||
    lower.includes('metadata') ||
    lower.includes('private network') ||
    (lower.includes('ip-') && lower.includes('private')) ||
    (lower.includes('private') && (lower.includes('ip') || lower.includes('host') || lower.includes('address') || lower.includes('gateway') || lower.includes('dns')))
  ) {
    return { code: 'ERR_GATEWAY_SSRF', ...ERROR_TAXONOMY.ERR_GATEWAY_SSRF };
  }

  // 1. Private / Access / Link errors (strictly for social media targets)
  if (
    lower.includes('account is private') ||
    lower.includes('profile is private') ||
    lower.includes('channel is private') ||
    lower.includes('group is private') ||
    lower.includes('target is private') ||
    lower.includes('is private') ||
    lower.includes('this account is private') ||
    lower.includes('closed profile') ||
    lower.includes('profile is closed') ||
    lower.includes('аккаунт закрыт') ||
    lower.includes('закрытый профиль') ||
    lower.includes('закрытый аккаунт') ||
    lower.includes('приватный канал') ||
    lower.includes('приватный аккаунт') ||
    lower.includes('приватная группа') ||
    (lower.includes('private') && !lower.includes('network') && !lower.includes('ip') && !lower.includes('host')) ||
    (lower.includes('closed') && !lower.includes('connection') && !lower.includes('socket')) ||
    (lower.includes('restricted') && !lower.includes('ip'))
  ) {
    return { code: 'ERR_LINK_PRIVATE', ...ERROR_TAXONOMY.ERR_LINK_PRIVATE };
  }

  if (
    lower.includes('not found') || 
    lower.includes('page not found') || 
    lower.includes('deleted') || 
    lower.includes('404') ||
    lower.includes('не найден')
  ) {
    return { code: 'ERR_LINK_NOT_FOUND', ...ERROR_TAXONOMY.ERR_LINK_NOT_FOUND };
  }

  if (
    lower.includes('invalid link') || 
    lower.includes('bad link') || 
    lower.includes('wrong url') || 
    lower.includes('incorrect link') ||
    lower.includes('неверная ссылка')
  ) {
    return { code: 'ERR_LINK_INVALID', ...ERROR_TAXONOMY.ERR_LINK_INVALID };
  }

  if (
    lower.includes('already in progress') || 
    lower.includes('duplicate order') || 
    lower.includes('duplicate') ||
    lower.includes('уже в работе')
  ) {
    return { code: 'ERR_LINK_DUPLICATE_ACTIVE', ...ERROR_TAXONOMY.ERR_LINK_DUPLICATE_ACTIVE };
  }

  // 1.b Price Drift & Negative Margin Protection
  if (
    lower.includes('price_drift_hold') ||
    lower.includes('отрицательной маржи') ||
    lower.includes('себестоимость') && lower.includes('превышает')
  ) {
    return { code: 'ERR_PRICE_DRIFT_NEGATIVE_MARGIN', ...ERROR_TAXONOMY.ERR_PRICE_DRIFT_NEGATIVE_MARGIN };
  }

  // 2. Provider Balance & Quota errors
  if (
    lower.includes('not enough balance') || 
    lower.includes('not enough funds') || 
    lower.includes('low balance') || 
    lower.includes('insufficient funds') || 
    lower.includes('balance low') ||
    lower.includes('недостаточно средств')
  ) {
    return { code: 'ERR_PROVIDER_LOW_BALANCE', ...ERROR_TAXONOMY.ERR_PROVIDER_LOW_BALANCE };
  }

  if (
    lower.includes('rate limit') || 
    lower.includes('too many requests') || 
    lower.includes('429')
  ) {
    return { code: 'ERR_PROVIDER_RATE_LIMIT', ...ERROR_TAXONOMY.ERR_PROVIDER_RATE_LIMIT };
  }

  if (
    lower.includes('service disabled') || 
    lower.includes('service not found') || 
    lower.includes('service inactive') || 
    lower.includes('service not available') ||
    lower.includes('услуга отключена')
  ) {
    return { code: 'ERR_PROVIDER_SERVICE_DISABLED', ...ERROR_TAXONOMY.ERR_PROVIDER_SERVICE_DISABLED };
  }

  if (lower.includes('maintenance') || lower.includes('техработы')) {
    return { code: 'ERR_PROVIDER_MAINTENANCE', ...ERROR_TAXONOMY.ERR_PROVIDER_MAINTENANCE };
  }

  // 3. Network & Gateway errors
  if (
    lower.includes('timeout') || 
    lower.includes('timed out') || 
    lower.includes('socket hang up') || 
    lower.includes('connecttimeout') ||
    lower.includes('таймаут')
  ) {
    return { code: 'ERR_GATEWAY_TIMEOUT', ...ERROR_TAXONOMY.ERR_GATEWAY_TIMEOUT };
  }

  if (
    lower.includes('502') || 
    lower.includes('500') || 
    lower.includes('503') || 
    lower.includes('504') || 
    lower.includes('bad gateway') ||
    lower.includes('internal server error')
  ) {
    return { code: 'ERR_GATEWAY_HTTP_5XX', ...ERROR_TAXONOMY.ERR_GATEWAY_HTTP_5XX };
  }

  // 4. Quantity Limit errors
  if (lower.includes('min') || lower.includes('less than min')) {
    return { code: 'ERR_LIMIT_MIN_QTY', ...ERROR_TAXONOMY.ERR_LIMIT_MIN_QTY };
  }
  if (lower.includes('max') || lower.includes('more than max')) {
    return { code: 'ERR_LIMIT_MAX_QTY', ...ERROR_TAXONOMY.ERR_LIMIT_MAX_QTY };
  }

  // 5. Payment errors
  if (lower.includes('оплата не поступила') || lower.includes('истекло') || lower.includes('expire')) {
    return { code: 'ERR_PAYMENT_EXPIRED', ...ERROR_TAXONOMY.ERR_PAYMENT_EXPIRED };
  }
  if (lower.includes('платёж отменён') || lower.includes('payment failed')) {
    return { code: 'ERR_PAYMENT_FAILED', ...ERROR_TAXONOMY.ERR_PAYMENT_FAILED };
  }

  // Fallback classified
  return {
    code: 'ERR_SYSTEM_GENERAL',
    category: 'SYSTEM',
    titleRu: str.length > 60 ? `${str.slice(0, 60)}...` : str,
    descriptionRu: str,
    recommendedAction: ERROR_TAXONOMY.ERR_SYSTEM_GENERAL.recommendedAction,
    badgeBg: ERROR_TAXONOMY.ERR_SYSTEM_GENERAL.badgeBg,
    badgeText: ERROR_TAXONOMY.ERR_SYSTEM_GENERAL.badgeText,
    badgeBorder: ERROR_TAXONOMY.ERR_SYSTEM_GENERAL.badgeBorder,
  };
}
