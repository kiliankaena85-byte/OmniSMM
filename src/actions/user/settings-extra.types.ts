export interface CompanyRequisitesInput {
  companyName?: string | null;
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  legalAddress?: string | null;
}

export interface UpdateCompanyRequisitesResult {
  success: boolean;
  error?: string;
}

export interface ApiWebhookInput {
  webhookUrl?: string | null;
  isWebhookActive?: boolean;
  regenerateSecret?: boolean;
}

export interface UpdateApiWebhookResult {
  success: boolean;
  error?: string;
  webhookSecret?: string | null;
  webhookUrl?: string | null;
  isWebhookActive?: boolean;
}

export interface Confirm152FzConsentResult {
  success: boolean;
  error?: string;
  tosAcceptedAt?: Date | string | null;
  tosAcceptedIp?: string | null;
}

export interface ApiKeyActionResult {
  success: boolean;
  apiKey?: string;
  error?: string;
}

export interface TelegramBindDetailsResult {
  success: boolean;
  error?: string;
  botUsername?: string;
  bindToken?: string;
  deepLink?: string;
  expiresAt?: string;
}

export interface TelegramNotificationSettingsInput {
  notifyOrders?: boolean;
  notifyBalance?: boolean;
  notifyTickets?: boolean;
}

export interface TelegramNotificationSettingsResult {
  success: boolean;
  error?: string;
  telegramNotifyOrders?: boolean;
  telegramNotifyBalance?: boolean;
  telegramNotifyTickets?: boolean;
}

export interface UnbindTelegramResult {
  success: boolean;
  error?: string;
}
