// ==============================================================
// Telegram Enterprise Types
// OWASP Top 10 2025 aligned type definitions
// ==============================================================

// ── Button Management ──
export interface TelegramButton {
  id: string;
  tenantId: string;
  label: string;
  emoji: string;
  command: string;
  description: string;
  row: number;
  col: number;
  sortOrder: number;
  isVisible: boolean;
  isNew: boolean;
  requiresAuth: boolean;
  openUrl?: string | null;
  style: 'default' | 'primary' | 'danger';
  createdAt: Date;
  updatedAt: Date;
}

export interface TelegramButtonRow {
  row: number;
  buttons: TelegramButton[];
}

export type ButtonStyle = 'default' | 'primary' | 'danger';
export type ButtonLayoutMode = 'grid_2x3' | 'grid_3x2' | 'list' | 'custom';

// ── Template Management ──
export type ParseMode = 'HTML' | 'Markdown' | 'MarkdownV2';
export type TemplateCategory = 'general' | 'order' | 'payment' | 'support' | 'notification' | 'error';

export interface TelegramTemplate {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string;
  body: string;
  parseMode: ParseMode;
  category: TemplateCategory;
  variables: string[];
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  description: string;
  example: string;
}

export const TEMPLATE_VARIABLES: Record<TemplateCategory, TemplateVariable[]> = {
  general: [
    { name: '{siteName}', description: 'Название платформы', example: 'SMMplan' },
    { name: '{userName}', description: 'Имя пользователя', example: 'Артём' },
    { name: '{balance}', description: 'Текущий баланс', example: '1 500.00' },
    { name: '{date}', description: 'Текущая дата', example: '25.08.2026' },
  ],
  order: [
    { name: '{orderId}', description: 'ID заказа', example: '#ORD-12345' },
    { name: '{service}', description: 'Название услуги', example: 'Подписчики Instagram' },
    { name: '{quantity}', description: 'Количество', example: '1000' },
    { name: '{cost}', description: 'Стоимость', example: '150.00 ₽' },
    { name: '{link}', description: 'Ссылка на объект', example: 'https://instagram.com/user' },
    { name: '{status}', description: 'Статус заказа', example: 'В работе' },
    { name: '{startCount}', description: 'Начальное количество', example: '500' },
    { name: '{remains}', description: 'Остаток', example: '300' },
  ],
  payment: [
    { name: '{amount}', description: 'Сумма пополнения', example: '1 000 ₽' },
    { name: '{balance}', description: 'Новый баланс', example: '2 500.00 ₽' },
    { name: '{paymentMethod}', description: 'Способ оплаты', example: 'ЮKassa' },
    { name: '{txnId}', description: 'ID транзакции', example: 'TXN-abc123' },
  ],
  support: [
    { name: '{ticketId}', description: 'ID тикета', example: '#TKT-42' },
    { name: '{subject}', description: 'Тема обращения', example: 'Не начислились подписчики' },
    { name: '{operatorName}', description: 'Имя оператора', example: 'Анна' },
  ],
  notification: [
    { name: '{title}', description: 'Заголовок уведомления', example: 'Системное обновление' },
    { name: '{body}', description: 'Текст уведомления', example: 'Запланировано обслуживание' },
  ],
  error: [
    { name: '{errorCode}', description: 'Код ошибки', example: 'ERR_PAYMENT_TIMEOUT' },
    { name: '{errorMessage}', description: 'Сообщение об ошибке', example: 'Таймаут платежа' },
    { name: '{timestamp}', description: 'Время ошибки', example: '25.08.2026 14:30' },
  ],
};

// ── Proxy Configuration ──
export type ProxyProtocol = 'socks5' | 'http' | 'https';

export interface TelegramProxy {
  id: string;
  tenantId: string;
  label: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string | null;
  passwordEncrypted?: string | null;
  isActive: boolean;
  lastTestAt?: Date | null;
  lastTestLatencyMs?: number | null;
  lastTestSuccess?: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProxyTestResult {
  success: boolean;
  latencyMs?: number;
  error?: string;
  testedAt: string;
}

// ── Error Tracking ──
export type ErrorLevel = 'ERROR' | 'WARN' | 'FATAL';
export type ErrorSource = 'webhook' | 'polling' | 'command' | 'callback_query' | 'scene';

export interface TelegramErrorLog {
  id: string;
  tenantId: string;
  level: ErrorLevel;
  source: ErrorSource;
  errorCode?: string | null;
  errorMessage: string;
  stackTrace?: string | null;
  updateData?: string | null;
  userId?: string | null;
  chatId?: string | null;
  isResolved: boolean;
  resolvedBy?: string | null;
  resolvedAt?: Date | null;
  occurrenceCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
}

// ── Statistics ──
export interface TelegramDailyStat {
  id: string;
  tenantId: string;
  date: Date;
  messagesReceived: number;
  messagesSent: number;
  commandsHandled: number;
  callbacksHandled: number;
  newUsers: number;
  ordersCreated: number;
  ticketsCreated: number;
  errorsCount: number;
  avgLatencyMs?: number | null;
  p99LatencyMs?: number | null;
  createdAt: Date;
}

export interface TelegramStatsOverview {
  today: TelegramDailyStat | null;
  yesterday: TelegramDailyStat | null;
  last7Days: TelegramDailyStat[];
  linkedUsersCount: number;
  telegramTicketsCount: number;
  totalOrdersCount: number;
  activeButtonsCount: number;
  activeTemplatesCount: number;
  unresolvedErrorsCount: number;
  errorsLast24h: number;
}

// ── Diagnostics ──
export interface TelegramBotDiagnostics {
  success: boolean;
  pingMs?: number;
  daemonRunning?: boolean;
  heartbeatAgeMs?: number;
  bot?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
    can_join_groups: boolean;
    can_read_all_group_messages: boolean;
    supports_inline_queries: boolean;
  };
  webhook?: {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
  };
  proxy?: {
    isActive: boolean;
    label?: string;
    protocol?: string;
    lastTestLatencyMs?: number;
  };
  security?: {
    webhookSecretSet: boolean;
    rateLimitPerMin: number;
    allowedIpsCount: number;
    maintenanceMode: boolean;
  };
  stats?: {
    linkedUsersCount: number;
    telegramTicketsCount: number;
    totalOrdersCount: number;
    activeButtonsCount: number;
    activeTemplatesCount: number;
    unresolvedErrorsCount: number;
  };
  error?: string;
}

// ── Security ──
export interface WebhookSecurityConfig {
  webhookSecret: string;
  allowedIps: string[];
  rateLimitPerMin: number;
  maxMessageLength: number;
}

// ── Action Results ──
export interface TelegramActionResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: unknown;
}

// ── Enterprise Menu & CSAT Types & Constants ──

export type TelegramMenuButtonAction = 
  | 'FAST_ORDER'    // 🚀 Быстрый заказ по ссылке
  | 'CATALOG'       // 🛍 Каталог услуг
  | 'ORDERS'        // 📦 Мои заказы
  | 'REFILL'        // 💰 Пополнить
  | 'PROFILE'       // 👤 Профиль
  | 'SUPPORT'       // 🆘 Поддержка
  | 'REFERRALS'     // 👥 Рефералы
  | 'URL'           // 🌐 Внешняя ссылка
  | 'WEB_APP'       // 📱 Telegram Mini App
  | 'COMMAND'       // ⚡ Команда (/start, /help)
  | 'TEXT_REPLY';   // 💬 Быстрый текст / FAQ ответ

export interface TelegramMenuButton {
  id: string;
  label: string;
  action: TelegramMenuButtonAction;
  row: number;
  col: number;
  value?: string;
  isActive: boolean;
}

export const DEFAULT_TELEGRAM_MENU_BUTTONS: TelegramMenuButton[] = [
  { id: 'btn_1', label: '🛍 Каталог услуг', action: 'CATALOG', row: 0, col: 0, isActive: true },
  { id: 'btn_2', label: '📦 Мои заказы', action: 'ORDERS', row: 0, col: 1, isActive: true },
  { id: 'btn_3', label: '💰 Пополнить', action: 'REFILL', row: 1, col: 0, isActive: true },
  { id: 'btn_4', label: '👤 Профиль', action: 'PROFILE', row: 1, col: 1, isActive: true },
  { id: 'btn_5', label: '🆘 Поддержка', action: 'SUPPORT', row: 2, col: 0, isActive: true },
  { id: 'btn_6', label: '👥 Рефералы', action: 'REFERRALS', row: 2, col: 1, isActive: true },
];

export interface TelegramRatingReasonsConfig {
  negative: string[];
  neutral: string[];
  positive: string[];
}

export const DEFAULT_TELEGRAM_RATING_REASONS: TelegramRatingReasonsConfig = {
  negative: ['Долгий ответ', 'Проблема не решена', 'Грубость оператора', 'Технический сбой'],
  neutral: ['Долго решали', 'Неполный ответ', 'Сложный процесс', 'Мало информации'],
  positive: ['Быстрый ответ', 'Вежливый оператор', 'Проблема решена на 100%', 'Понятная инструкция', 'Отличный сервис']
};

export interface TelegramMessageTemplatesConfig {
  welcome: string;
  ticketClosedRating: string;
  ratingThanks: string;
  delayWarning: string;
  paymentIssue: string;
  serviceRefill: string;
  refundNotice: string;
}

export const DEFAULT_TELEGRAM_MESSAGE_TEMPLATES: TelegramMessageTemplatesConfig = {
  welcome: '👋 <b>Добро пожаловать в {siteName}!</b>\n\nПлатформа автоматического продвижения в социальных сетях.\n\n💰 Ваш баланс: <b>{balance} ₽</b>\n\nВыберите действие в меню ниже:',
  ticketClosedRating: '✅ <b>Ваш вопрос решён и тикет #{ticketId} закрыт.</b>\n\nПожалуйста, оцените качество работы службы поддержки:',
  ratingThanks: '⭐ <b>Спасибо за вашу оценку {stars}!</b>\n\nВаш отзыв помогает нам становиться лучше. Если у вас возникнут новые вопросы, просто напишите в этот чат.',
  delayWarning: '⏳ <b>Внимание: высокая нагрузка</b>\n\nВ связи с пиковой загрузкой время ответа оператора может составлять до 15 минут. Мы уже занимаемся вашим вопросом!',
  paymentIssue: '💳 <b>Вопрос по оплате заказа #{orderId}</b>\n\nМы проверяем статус платежа через банковский шлюз. Средства будут зачислены в течение нескольких минут.',
  serviceRefill: '🔄 <b>Гарантийная докрутка запущена</b>\n\nПо вашему заказу #{orderId} отправлен запрос поставщику на восстановление списанных показателей.',
  refundNotice: '💸 <b>Возврат средств оформлен</b>\n\nПо тикету #{ticketId} выполнен возврат на баланс в размере <b>{amount} ₽</b>.'
};

export interface TelegramEnterpriseConfig {
  menuButtons: TelegramMenuButton[];
  ratingReasons: TelegramRatingReasonsConfig;
  templates: TelegramMessageTemplatesConfig;
}

export interface TicketFeedbackStats {
  totalCount: number;
  avgScore: number;
  scoreBreakdown: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  topReasons: { reason: string; count: number }[];
}

export interface TicketFeedbackItem {
  id: string;
  ticketId: string;
  ticketSubject: string;
  userId: string;
  userEmail: string;
  score: number;
  reasons: string[];
  comment?: string | null;
  source: string;
  createdAt: string;
}
