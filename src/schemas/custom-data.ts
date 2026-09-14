import { z } from 'zod';

/**
 * Strips ASCII control characters (\x00-\x08, \x0B, \x0C, \x0E-\x1F, \x7F)
 * but explicitly preserves standard newlines (\n, \r) and tabs (\t).
 */
export const sanitizeControlChars = (val: string): string =>
  val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

/**
 * Basic Unicode Emoji Validator.
 * Matches standard emoji sequences, skin tone modifiers, and zero-width joiners.
 */
export const EMOJI_REGEX = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component})+$/u;

/**
 * Valid handle format: alphanumeric, underscore, dot, optional leading @.
 */
export const USERNAME_REGEX = /^@?[a-zA-Z0-9_.]{3,32}$/;

// -----------------------------------------------------------------------------
// Sub-Schemas
// -----------------------------------------------------------------------------

export const CommentsCustomDataSchema = z.object({
  kind: z.literal('COMMENTS'),
  lines: z
    .array(
      z
        .string()
        .transform(val => sanitizeControlChars(val.trim()))
        .refine(val => val.length > 0, { message: 'Строка комментария не может быть пустой' })
        .refine(val => val.length <= 500, { message: 'Длина одного комментария не должна превышать 500 символов' })
    )
    .min(1, 'Необходимо указать хотя бы один комментарий')
    .max(1000, 'Максимальное количество комментариев — 1 000 строк'),
});

export const ReactionsCustomDataSchema = z.object({
  kind: z.literal('REACTIONS'),
  emojis: z
    .array(
      z
        .string()
        .trim()
        .refine(
          val => EMOJI_REGEX.test(val) || /^\d{15,22}$/.test(val), // Allows custom Telegram Document IDs
          { message: 'Некорректный символ реакции или ID эмодзи' }
        )
    )
    .min(1, 'Выберите хотя бы одну реакцию')
    .max(10, 'Максимум 10 реакций одновременно'),
});

export const PollCustomDataSchema = z.object({
  kind: z.literal('POLL'),
  optionIndex: z
    .number()
    .int('Номер ответа должен быть целым числом')
    .min(1, 'Минимальный номер ответа — 1')
    .max(20, 'Максимальный номер ответа — 20'),
  optionText: z
    .string()
    .max(100, 'Текст ответа не должен превышать 100 символов')
    .transform(val => sanitizeControlChars(val.trim()))
    .optional(),
});

export const MentionsCustomDataSchema = z.object({
  kind: z.literal('MENTIONS'),
  usernames: z
    .array(
      z
        .string()
        .transform(val => val.trim().replace(/^@/, ''))
        .refine(val => USERNAME_REGEX.test(val), { message: 'Некорректный логин пользователя' })
    )
    .min(1, 'Укажите хотя бы одного пользователя')
    .max(500, 'Максимум 500 пользователей в списке'),
  hashtag: z
    .string()
    .max(50, 'Хэштег не должен превышать 50 символов')
    .transform(val => val.trim().replace(/^#/, ''))
    .optional(),
});

export const MediaGroupCustomDataSchema = z.object({
  kind: z.literal('MEDIA_GROUP'),
  firstPostUrl: z.string().url('Некорректная ссылка на первое медиа'),
  lastPostUrl: z.string().url('Некорректная ссылка на последнее медиа'),
});

export const SubscriptionCustomDataSchema = z.object({
  kind: z.literal('SUBSCRIPTION'),
  minPerPost: z.number().int().min(1, 'Минимум на пост — 1'),
  maxPerPost: z.number().int().min(1, 'Максимум на пост — 1'),
  futurePosts: z.number().int().min(1).max(100, 'Максимум 100 будущих публикаций'),
  delayMinutes: z.number().int().min(0).max(1440).default(0),
});

// -----------------------------------------------------------------------------
// Unified Order Custom Data Discriminated Union
// -----------------------------------------------------------------------------

export const OrderCustomDataSchema = z.discriminatedUnion('kind', [
  CommentsCustomDataSchema,
  ReactionsCustomDataSchema,
  PollCustomDataSchema,
  MentionsCustomDataSchema,
  MediaGroupCustomDataSchema,
  SubscriptionCustomDataSchema,
]);

export type OrderCustomData = z.infer<typeof OrderCustomDataSchema>;
export type CommentsCustomData = z.infer<typeof CommentsCustomDataSchema>;
export type ReactionsCustomData = z.infer<typeof ReactionsCustomDataSchema>;
export type PollCustomData = z.infer<typeof PollCustomDataSchema>;
export type MentionsCustomData = z.infer<typeof MentionsCustomDataSchema>;
export type MediaGroupCustomData = z.infer<typeof MediaGroupCustomDataSchema>;
export type SubscriptionCustomData = z.infer<typeof SubscriptionCustomDataSchema>;

/**
 * Serializes OrderCustomData into a database-safe JSON string
 * with total size bounded at 5,000 characters.
 */
export function serializeCustomData(data: OrderCustomData): string {
  const json = JSON.stringify(data);
  if (json.length > 5000) {
    throw new Error('Сериализованные пользовательские данные превышают лимит в 5000 символов');
  }
  return json;
}

/**
 * Safely parses database customData string into strongly-typed OrderCustomData.
 * Falls back gracefully to legacy COMMENTS or POLL parsing if string is not JSON.
 */
export function parseCustomData(raw: string | null | undefined): OrderCustomData | null {
  if (!raw || raw.trim().length === 0) return null;
  const trimmed = raw.trim();

  // 1. Attempt standard JSON parsing
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const result = OrderCustomDataSchema.safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      // Continue to fallback
    }
  }

  // 2. Legacy numeric poll fallback
  if (/^\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    if (num >= 1 && num <= 20) {
      return { kind: 'POLL', optionIndex: num };
    }
  }

  // 3. Legacy multiline comments fallback
  const lines = trimmed
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length > 0) {
    return { kind: 'COMMENTS', lines };
  }

  return null;
}
