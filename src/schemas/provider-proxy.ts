// ==============================================================
// Provider Proxy Zod Validation Schemas
// OWASP A03: Strict input validation
// ==============================================================

import { z } from 'zod';

const safeString = (max: number, name: string) =>
  z.string().trim().max(max, `${name}: максимум ${max} символов`);

const proxyHostSchema = z.string().trim()
  .max(253, 'Хост: максимум 253 символа')
  .regex(/^(?!-)[A-Za-z0-9-]{1,63}(\.[A-Za-z0-9-]{1,63})*\.?$/, 'Некорректный формат хоста')
  .or(z.string().ip('Некорректный IP-адрес'));

export const createProxySchema = z.object({
  label: safeString(128, 'Название').min(1, 'Название обязательно'),
  description: safeString(512, 'Описание').default(''),
  protocol: z.enum(['http', 'https', 'socks5']).default('https'),
  category: z.enum(['PAID_PREMIUM', 'FREE_PUBLIC', 'BACKUP_RESERVE']).default('PAID_PREMIUM'),
  host: proxyHostSchema,
  port: z.number().int().min(1).max(65535, 'Порт: 1-65535'),
  username: safeString(128, 'Имя пользователя').nullable().optional(),
  password: safeString(256, 'Пароль').nullable().optional(),
  isRotating: z.boolean().default(false),
  geoCountry: z.string().length(2).nullable().optional(),
  tags: z.array(z.string().max(32)).max(10, 'Максимум 10 тегов').default([]),
  subscriptionUrl: z.string().url('Некорректный URL подписки').max(2048).nullable().optional().or(z.literal('')),
  expiresAt: z.string().datetime().nullable().optional().or(z.date().nullable().optional()),
});

export const updateProxySchema = createProxySchema.partial().extend({
  id: z.string().min(1, 'Некорректный ID прокси'),
});

export const testProxySchema = z.object({
  proxyId: z.string().min(1),
  targetUrl: z.string().url('Некорректный URL').max(2048).optional().default('https://httpbin.org/ip'),
});

export const assignProxySchema = z.object({
  providerId: z.string().min(1, 'ID провайдера обязателен'),
  proxyId: z.string().min(1).nullable(), // null = прямое подключение
});

export const batchAssignSchema = z.object({
  assignments: z.array(z.object({
    providerId: z.string().min(1),
    proxyId: z.string().min(1).nullable(),
  })).min(1).max(100),
});

export const proxyLogQuerySchema = z.object({
  proxyId: z.string().optional(),
  providerId: z.string().optional(),
  errorOnly: z.boolean().default(false),
  limit: z.number().int().min(1).max(200).default(50),
});

export const importSubscriptionSchema = z.object({
  subscriptionUrl: z.string().url('Некорректный URL подписки').max(2048),
  label: safeString(128, 'Название').optional(),
  category: z.enum(['PAID_PREMIUM', 'FREE_PUBLIC', 'BACKUP_RESERVE']).default('PAID_PREMIUM'),
  protocol: z.enum(['http', 'https', 'socks5']).default('socks5'),
  inboundHost: proxyHostSchema.default('127.0.0.1'),
  inboundPort: z.number().int().min(1).max(65535).default(7891),
  autoAssignToProviders: z.boolean().default(true),
});

export const importRawListSchema = z.object({
  rawListText: z.string().min(1, 'Список прокси не может быть пустым').max(50000),
  category: z.enum(['PAID_PREMIUM', 'FREE_PUBLIC', 'BACKUP_RESERVE']).default('PAID_PREMIUM'),
  defaultProtocol: z.enum(['http', 'https', 'socks5']).default('socks5'),
  tag: safeString(32, 'Тег').optional(),
});
