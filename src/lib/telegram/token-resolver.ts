/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Centralized Telegram Token & Identity Resolver.
 * Guarantees strict validation, Vault decryption, and rejects placeholders.
 */

import { normalizeTenantId, sanitizeTenantSlug } from '@/lib/tenant-resolver-edge';
import { db } from '@/lib/db';
import { VaultService } from '@/lib/vault';

const KNOWN_PLACEHOLDERS = new Set([
  'dummy_token',
  'your_telegram_bot_token_here',
  'your_bot_token',
  'your_token',
  'your_token_here',
  'telegram_bot_token',
  'placeholder',
  'none',
  'null',
  'undefined',
]);

// Official Telegram Bot Token format: <bot_id>:<token_string>
// e.g. <bot_id>:<token_string>
const TELEGRAM_TOKEN_REGEX = /^\d{6,13}:[A-Za-z0-9_-]{35,}$/;

/**
 * Checks whether the given token string is a known dummy/placeholder value.
 */
export function isPlaceholderToken(token?: string | null): boolean {
  if (!token) return true;
  const trimmed = token.trim();
  if (trimmed.length < 10) return true;
  if (trimmed.includes('•••')) return true;
  if (KNOWN_PLACEHOLDERS.has(trimmed.toLowerCase())) return true;
  return false;
}

/**
 * Checks whether the string conforms to the Telegram Bot API token format.
 */
export function isValidTelegramToken(token?: string | null): boolean {
  if (!token) return false;
  const trimmed = token.trim();
  if (isPlaceholderToken(trimmed)) return false;
  return TELEGRAM_TOKEN_REGEX.test(trimmed);
}

/**
 * Strips leading '@' characters and invalid whitespace from a Telegram username.
 */
export function cleanTelegramUsername(raw?: string | null): string {
  if (!raw) return '';
  return raw.trim().replace(/^@+/, '');
}

/**
 * Cleans a Telegram channel name, preserving standard handle without leading '@'.
 */
export function cleanTelegramChannel(raw?: string | null): string {
  if (!raw) return '';
  return raw.trim().replace(/^@+/, '');
}

/**
 * Resolves the valid, decrypted Telegram Bot Token for a given tenant.
 * Priority:
 * 1. Database TelegramBotInstance (active bot instance for tenant)
 * 2. Database SystemSettings (Vault AES-256-GCM encrypted)
 * 3. Fallback to process.env.TELEGRAM_BOT_TOKEN (strictly for 'smmplan' / default tenant)
 *
 * Rejects all placeholders and malformed tokens returning null.
 */
export async function resolveTelegramToken(targetTenantId?: string): Promise<string | null> {
  const tenantId = sanitizeTenantSlug(targetTenantId);

  // 1. Try resolving from active TelegramBotInstance (prioritized for white-label & custom bots)
  try {
    const botInstance = await db.telegramBotInstance.findFirst({
      where: {
        tenantId,
        isActive: true,
      },
      select: { tokenEncrypted: true },
      orderBy: { createdAt: 'desc' },
    });

    if (botInstance?.tokenEncrypted) {
      let decrypted = botInstance.tokenEncrypted;
      try {
        const d = VaultService.decrypt(botInstance.tokenEncrypted);
        if (d) decrypted = d;
      } catch {
        // May already be unencrypted in dev mode
      }

      if (isValidTelegramToken(decrypted)) {
        return decrypted.trim();
      }
    }
  } catch (err) {
    console.warn(`[TokenResolver] Failed to resolve token from TelegramBotInstance for tenant ${tenantId}:`, err);
  }

  // 2. Try resolving from Database SystemSettings (Vault AES-256-GCM encrypted)
  try {
    const settings = await db.systemSettings.findUnique({
      where: { id: tenantId },
      select: { telegramBotToken: true },
    });

    if (settings?.telegramBotToken) {
      let decrypted = settings.telegramBotToken;
      try {
        const d = VaultService.decrypt(settings.telegramBotToken);
        if (d) decrypted = d;
      } catch {
        // May already be unencrypted in local dev
      }

      if (isValidTelegramToken(decrypted)) {
        return decrypted.trim();
      }
    }
  } catch (err) {
    console.warn(`[TokenResolver] Failed to resolve token from DB for tenant ${tenantId}:`, err);
  }

  // 3. Safe Fallback to process.env.TELEGRAM_BOT_TOKEN for smmplan
  const defaultTenant = process.env.BOT_TENANT_ID || 'smmplan';
  if (tenantId === defaultTenant || tenantId === 'smmplan') {
    const envToken = process.env.TELEGRAM_BOT_TOKEN;
    if (isValidTelegramToken(envToken)) {
      return envToken!.trim();
    }
  }

  return null;
}

/**
 * Resolves the valid, decrypted Telegram Webhook Secret for a given tenant.
 * Priority:
 * 1. Database SystemSettings (Vault AES-256-GCM encrypted)
 * 2. Fallback to process.env.TELEGRAM_WEBHOOK_SECRET (for 'smmplan' / default tenant)
 */
export async function resolveTelegramWebhookSecret(targetTenantId?: string): Promise<string | null> {
  const tenantId = sanitizeTenantSlug(targetTenantId);

  try {
    const settings = await db.systemSettings.findUnique({
      where: { id: tenantId },
      select: { telegramWebhookSecret: true },
    });

    if (settings?.telegramWebhookSecret) {
      let decrypted = settings.telegramWebhookSecret;
      try {
        const d = VaultService.decrypt(settings.telegramWebhookSecret);
        if (d) decrypted = d;
      } catch {
        // May already be unencrypted in dev mode
      }
      if (decrypted && decrypted.trim().length > 0) {
        return decrypted.trim();
      }
    }
  } catch (err) {
    console.warn(`[TokenResolver] Failed to resolve webhook secret from DB for tenant ${tenantId}:`, err);
  }

  // Fallback to process.env.TELEGRAM_WEBHOOK_SECRET for smmplan
  const defaultTenant = process.env.BOT_TENANT_ID || 'smmplan';
  if (tenantId === defaultTenant || tenantId === 'smmplan') {
    const envSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (envSecret && envSecret.trim().length > 0) {
      return envSecret.trim();
    }
  }

  return null;
}
