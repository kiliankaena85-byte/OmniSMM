// ==============================================================
// Telegram Enterprise Zod Validation Schemas
// OWASP Top 10 2025: Strict input validation (A03 Injection Prevention)
// ==============================================================

import { z } from 'zod';

// ── Shared safe string: strips control chars, limits length ──
const safeString = (min: number, max: number, name: string) =>
  z.string()
    .trim()
    .min(min, min > 0 ? `${name}: обязательно для заполнения` : undefined)
    .max(max, `${name}: максимум ${max} символов`)
    .refine(
      (v) => !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(v),
      `${name}: содержит недопустимые управляющие символы`
    );

// ── Button Schemas ──
export const createButtonSchema = z.object({
  label: safeString(1, 64, 'Название кнопки'),
  emoji: z.string().trim().max(8, 'Эмодзи: максимум 8 символов').regex(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]*$/u, 'Некорректный эмодзи').default(''),
  command: z.string().trim().min(1, 'Команда обязательна').max(128, 'Команда: максимум 128 символов').regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Команда: только латиница, цифры, _, начинается с буквы'),
  description: z.string().trim().max(256, 'Описание: максимум 256 символов').default(''),
  row: z.number().int().min(0).max(9, 'Максимум 10 строк (0-9)').default(0),
  col: z.number().int().min(0).max(2, 'Максимум 3 колонки (0-2)').default(0),
  isVisible: z.boolean().default(true),
  isNew: z.boolean().default(false),
  requiresAuth: z.boolean().default(false),
  openUrl: z.string().url('Некорректный URL').max(2048).nullable().optional(),
  style: z.enum(['default', 'primary', 'danger']).default('default'),
});

export const updateButtonSchema = createButtonSchema.partial().extend({
  id: z.string().min(1, 'Некорректный ID'),
});

export const reorderButtonsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      sortOrder: z.number().int().min(0),
      row: z.number().int().min(0).max(9),
      col: z.number().int().min(0).max(2),
    })
  ).min(1).max(30, 'Максимум 30 кнопок'),
});

// ── Template Schemas ──
export const createTemplateSchema = z.object({
  name: safeString(1, 128, 'Название шаблона'),
  slug: z.string().trim().min(1, 'Slug обязателен').max(64, 'Slug: максимум 64 символа')
    .regex(/^[a-z][a-z0-9_]*$/, 'Slug: только строчные латинские буквы, цифры и _'),
  description: z.string().trim().max(512, 'Описание: максимум 512 символов').default(''),
  body: z.string().trim().min(1, 'Тело шаблона обязательно').max(8000, 'Тело: максимум 8000 символов'),
  parseMode: z.enum(['HTML', 'Markdown', 'MarkdownV2']).default('HTML'),
  category: z.enum(['general', 'order', 'payment', 'support', 'notification', 'error']).default('general'),
  isActive: z.boolean().default(true),
});

export const updateTemplateSchema = createTemplateSchema.partial().extend({
  id: z.string().min(1, 'Некорректный ID шаблона'),
});

// ── Proxy Schemas ──
const proxyHostSchema = z.string().trim()
  .max(253, 'Хост: максимум 253 символа')
  .regex(/^(?!-)[A-Za-z0-9-]{1,63}(\.[A-Za-z0-9-]{1,63})*\.?$/, 'Некорректный формат хоста')
  .or(z.string().ip('Некорректный IP-адрес'));

export const createProxySchema = z.object({
  label: safeString(1, 64, 'Название'),
  protocol: z.enum(['socks5', 'socks5h', 'http', 'https']).default('socks5'),
  host: proxyHostSchema,
  port: z.number().int().min(1).max(65535, 'Порт: 1-65535'),
  username: z.string().trim().max(128, 'Имя пользователя: максимум 128 символов').nullable().optional(),
  password: z.string().trim().max(256, 'Пароль: максимум 256 символов').nullable().optional(),
});

export const updateProxySchema = createProxySchema.partial().extend({
  id: z.string().min(1, 'Некорректный ID прокси'),
});

// ── Security Schemas (OWASP A01, A05, A07, A08) ──
export const securityConfigSchema = z.object({
  webhookSecret: z.string()
    .trim()
    .min(16, 'Секрет вебхука: минимум 16 символов')
    .max(128, 'Секрет: максимум 128 символов')
    .regex(/^[a-zA-Z0-9_\-+!@#$%^&*()]+$/, 'Секрет содержит недопустимые символы')
    .nullable()
    .optional(),
  allowedIps: z.array(
    z.string().ip('Некорректный IP-адрес')
  ).max(20, 'Максимум 20 IP-адресов').default([]),
  rateLimitPerMin: z.number().int().min(5).max(120, 'Лимит: 5-120 запросов/мин').default(30),
  maxMessageLength: z.number().int().min(256).max(4096, 'Максимум: 4096 символов').default(4096),
  telegramMaintenanceMode: z.boolean().default(false),
  telegramLogErrors: z.boolean().default(true),
  telegramEnableCsat: z.boolean().default(true),
  telegramEnableSmartBind: z.boolean().default(true),
});

// ── Test Alert Schema ──
export const sendTestAlertSchema = z.object({
  chatId: z.string().trim().min(1, 'ID чата обязателен').regex(/^-?\d+$/, 'ID чата: только целое число'),
  message: z.string().trim().min(1, 'Сообщение не может быть пустым').max(4096, 'Максимум 4096 символов'),
  parseMode: z.enum(['HTML', 'Markdown', 'MarkdownV2']).default('HTML'),
});

// ── Error Resolver Schema ──
export const resolveErrorSchema = z.object({
  errorId: z.string().min(1, 'ID ошибки обязателен'),
  resolution: z.string().trim().max(512).optional(),
});

export const massResolveErrorsSchema = z.object({
  errorIds: z.array(z.string().min(1)).min(1, 'Выберите хотя бы одну ошибку').max(100),
});

// ── Query Schemas ──
export const statsQuerySchema = z.object({
  period: z.enum(['today', '7d', '30d', '90d']).default('7d'),
});

// ── HTML Sanitizer Helper (OWASP A03) ──
// Telegram supports only a strict subset of HTML tags:
// <b>, <strong>, <i>, <em>, <u>, <ins>, <s>, <strike>, <del>, <tg-spoiler>,
// <a>, <tg-emoji>, <code>, <pre>, <blockquote>
const ALLOWED_HTML_TAGS = /<\/?(b|strong|i|em|u|ins|s|strike|del|tg-spoiler|code|pre|blockquote)(\s[^>]*)?>/gi;
const ALLOWED_A_TAG = /<a\s+href="https?:\/\/[^"]+"(\s+[^>]*)?>|<\/a>/gi;

export function sanitizeTelegramHtml(input: string): string {
  if (!input) return '';

  // Step 1: Escape dangerous characters except allowable tags
  let result = input
    .replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;')
    .replace(/<(?!\/?(b|strong|i|em|u|ins|s|strike|del|tg-spoiler|code|pre|blockquote|a(\s+href="https?:\/\/[^"]+")?)(\s[^>]*)?>)/gi, '&lt;')
    .replace(/>/g, (match, offset, str) => {
      const before = str.slice(0, offset);
      if (/<(b|strong|i|em|u|ins|s|strike|del|tg-spoiler|code|pre|blockquote|a)(\s[^>]*)?$/i.test(before) ||
          /<\/(b|strong|i|em|u|ins|s|strike|del|tg-spoiler|code|pre|blockquote|a)$/i.test(before)) {
        return '>';
      }
      return '&gt;';
    });

  // Step 2: Strip script, iframe, onerror, onclick attributes
  result = result
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '');

  return result;
}

// ── Extract Variables from Template Body ──
export function extractTemplateVariables(body: string): string[] {
  const matches = body.match(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g);
  if (!matches) return [];
  const unique = [...new Set(matches.map((m) => m.slice(1, -1)))];
  return unique;
}
