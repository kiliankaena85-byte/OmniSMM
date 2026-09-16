import { z } from 'zod';

function validateInn(inn: string): boolean {
  if (!/^\d{10}$|^\d{12}$/.test(inn)) return false;

  const digits = inn.split('').map(Number);

  if (inn.length === 10) {
    const coefficients = [2, 4, 10, 3, 5, 9, 4, 6, 8];
    const sum = coefficients.reduce((acc, coef, idx) => acc + coef * digits[idx], 0);
    const checksum = (sum % 11) % 10;
    return checksum === digits[9];
  } else if (inn.length === 12) {
    const coefficients11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const sum11 = coefficients11.reduce((acc, coef, idx) => acc + coef * digits[idx], 0);
    const checksum11 = (sum11 % 11) % 10;

    const coefficients12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const sum12 = coefficients12.reduce((acc, coef, idx) => acc + coef * digits[idx], 0);
    const checksum12 = (sum12 % 11) % 10;

    return checksum11 === digits[10] && checksum12 === digits[11];
  }

  return false;
}

function validateOgrn(ogrn: string): boolean {
  if (!/^\d{13}$|^\d{15}$/.test(ogrn)) return false;

  if (ogrn.length === 13) {
    const num = BigInt(ogrn.slice(0, 12));
    const checksum = Number(num % BigInt(11)) % 10;
    return checksum === Number(ogrn[12]);
  } else if (ogrn.length === 15) {
    const num = BigInt(ogrn.slice(0, 14));
    const checksum = Number(num % BigInt(13)) % 10;
    return checksum === Number(ogrn[14]);
  }

  return false;
}


// Users / Finance
export const updateBalanceSchema = z.object({
  userId: z.string().min(1),
  amount: z.coerce.number().int().min(-50000000, "Превышен лимит списания (500 тыс. руб)").max(50000000, "Превышен лимит начисления (500 тыс. руб)"),
  reason: z.string().trim().min(5, "Причина должна быть содержательной (не менее 5 символов)").max(500, "Описание причины не должно превышать 500 символов")
});

export const userIdSchema = z.object({
  userId: z.string().min(1)
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const entryIdSchema = z.object({
  entryId: z.string().min(1)
});

// Catalog
export const updateMarkupSchema = z.object({
  serviceId: z.string().min(1),
  markup: z.coerce.number()
});

export const toggleServiceSchema = z.object({
  serviceId: z.string().min(1),
  isActive: z.any().transform(val => val === 'true' || val === 'on')
});

export const bulkUpdateMarkupSchema = z.object({
  categoryId: z.string().nullable().optional(),
  platform: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
  markup: z.coerce.number().min(0).max(151.0)
});

// Settings
export const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT', 'USER', 'CLIENT', 'BANNED']),
  staffRoleId: z.string().nullable().optional(),
});

export const createRoleSchema = z.object({
  name: z.string().trim().min(2, "Название должно быть не менее 2 символов").max(50, "Название не должно превышать 50 символов"),
  description: z.string().trim().max(200).optional().default(""),
});

export const globalSettingsSchema = z.object({
  maintenanceMode: z.any().transform((val) => val === 'true' || val === 'on').optional(),
  siteName: z.string().trim().max(100).optional(),
  siteDescription: z.string().trim().max(500).optional(),
  usnScheme: z.enum(['INCOME', 'INCOME_EXPENSES']).optional(),
  telegramBotToken: z.string().trim().max(300).nullable().optional(),
  telegramBotMode: z.enum(['polling', 'webhook']).optional().default('polling'),
  welcomeMessage: z.string().trim().max(2000).nullable().optional(),
  yookassaShopId: z.string().trim().max(150).nullable().optional(),
  yookassaSecretKey: z.string().trim().max(300).nullable().optional(),
  yookassaWebhookSecret: z.string().trim().max(300).nullable().optional(),
  yookassaTestShopId: z.string().trim().max(150).nullable().optional(),
  yookassaTestSecretKey: z.string().trim().max(300).nullable().optional(),
  cryptoBotToken: z.string().trim().max(300).nullable().optional(),
  exchangeRateUSD: z.coerce.number().min(0, "Курс не должен быть меньше 0").max(300, "Курс не должен превышать 300").optional(),
  emailProvider: z.string().trim().max(100).optional(),
  resendApiKey: z.string().trim().max(300).nullable().optional(),
  smtpHost: z.string().trim().max(250).nullable().optional(),
  smtpPort: z.coerce.number().int("Порт должен быть целым числом").min(1, "Минимальный порт: 1").max(65535, "Максимальный порт: 65535").optional(),
  smtpUser: z.string().trim().max(250).nullable().optional(),
  smtpPassword: z.string().trim().max(300).nullable().optional(),
  supportEmailDomain: z.string().trim().regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Некорректный формат домена (например, smmplan.pro)").or(z.literal("")).nullable().optional(),
  inboundEmailWebhookSecret: z.string().trim().max(300).nullable().optional(),
  contactSupportEmail: z.string().trim().email("Некорректный формат email").or(z.literal("")).nullable().optional(),
  contactPrivacyEmail: z.string().trim().email("Некорректный формат email").or(z.literal("")).nullable().optional(),
  contactTelegramBot: z.string().trim().max(150).nullable().optional(),
  contactTelegramChannel: z.string().trim().max(150).nullable().optional(),
  contactWhatsApp: z.string().trim().max(150).nullable().optional(),
  contactVk: z.string().trim().max(150).nullable().optional(),
  legalCompanyName: z.string().trim().max(250).nullable().optional(),
  legalCompanyInn: z.string().trim().nullable().optional()
    .transform((val) => (val === 'Укажите ИНН' || !val ? '' : val))
    .refine((val) => !val || /^(\d{10}|\d{12})$/.test(val), "ИНН должен состоять строго из 10 или 12 цифр")
    .refine((val) => {
      if (!val) return true;
      return validateInn(val);
    }, "Некорректная контрольная сумма ИНН"),
  legalCompanyOgrnip: z.string().trim().nullable().optional()
    .transform((val) => (val === 'Укажите ОГРНИП' || !val ? '' : val))
    .refine((val) => !val || /^(\d{13}|\d{15})$/.test(val), "ОГРН/ОГРНИП должен состоять строго из 13 или 15 цифр")
    .refine((val) => {
      if (!val) return true;
      return validateOgrn(val);
    }, "Некорректная контрольная сумма ОГРН/ОГРНИП"),
  legalCompanyAddress: z.string().trim().max(1000).nullable().optional(),
  robokassaLogin: z.string().trim().max(150).nullable().optional(),
  robokassaPassword: z.string().trim().max(300).nullable().optional(),
  robokassaWebhookPassword: z.string().trim().max(300).nullable().optional(),
  taxRate: z.coerce.number().min(0, "Ставка налога не должна быть меньше 0%").max(100, "Ставка налога не должна превышать 100%").optional(),
  opexMonthly: z.coerce.number().min(0, "Постоянные расходы не могут быть меньше 0").optional(),
  quarantineThreshold: z.coerce.number().min(0, "Порог не должен быть меньше 0%").max(100, "Порог не должен превышать 100%").optional(),
  globalMarkup: z.coerce.number().min(1.05, "Минимальная наценка: 1.05 (+5%)").max(100, "Наценка не должна превышать 100.0").optional(),
  safetyFloor: z.coerce.number().min(1.05, "Порог безопасности не должен быть меньше 1.05 (+5%)").max(100, "Порог безопасности не должен превышать 100.0").optional(),
  siteLogoUrl: z.string().trim().max(500).nullable().optional().transform((val) => (val === '' ? null : val)),
  siteFaviconUrl: z.string().trim().max(500).nullable().optional().transform((val) => (val === '' ? null : val)),
  geminiApiKeys: z.string().trim().max(2000).nullable().optional(),
  geminiProxy: z.string().trim().max(500).nullable().optional(),
});

// Orders
export const orderIdSchema = z.object({
  orderId: z.string().min(1),
});
