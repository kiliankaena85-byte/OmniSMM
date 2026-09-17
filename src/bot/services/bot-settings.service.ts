/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * BotSettingsService — Dynamic configuration provider for Telegram Bot.
 * 
 * Provides:
 * - Strict multi-tenant isolation (where: { id: tenantId })
 * - High-performance TTL memory cache (30s) with instant cache invalidation
 * - Fully dynamic menu buttons matching & action resolution
 * - Live templates, CSAT reasons, and security policy retrieval
 */

import { db } from '@/lib/db';
import {
  type TelegramMenuButton,
  type TelegramMessageTemplatesConfig,
  type TelegramRatingReasonsConfig,
  DEFAULT_TELEGRAM_MENU_BUTTONS,
  DEFAULT_TELEGRAM_MESSAGE_TEMPLATES,
  DEFAULT_TELEGRAM_RATING_REASONS,
} from '@/types/telegram';
import type { SystemSettings } from '@prisma/client';

interface CachedTenantSettings {
  settings: SystemSettings | null;
  cachedAt: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds

export class BotSettingsService {
  private static cache = new Map<string, CachedTenantSettings>();

  /**
   * Invalidate settings cache (called by admin actions on update)
   */
  static invalidate(tenantId?: string): void {
    if (tenantId) {
      this.cache.delete(tenantId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Fetch raw SystemSettings for a specific tenant with memory cache
   */
  static async getSettings(tenantId: string = 'smmplan'): Promise<SystemSettings | null> {
    const normTenant = tenantId || 'smmplan';
    const now = Date.now();
    const hit = this.cache.get(normTenant);

    if (hit && now - hit.cachedAt < CACHE_TTL_MS) {
      return hit.settings;
    }

    try {
      const settings = await db.systemSettings.findUnique({
        where: { id: normTenant }
      });

      this.cache.set(normTenant, { settings, cachedAt: now });
      return settings;
    } catch (err) {
      console.error(`[BotSettingsService] Failed to load settings for ${normTenant}:`, err);
      return hit?.settings || null;
    }
  }

  /**
   * Get decrypted Telegram Bot Token configured in the Admin Panel (Authoritative Source of Truth)
   */
  static async getBotToken(tenantId: string = 'smmplan'): Promise<string | null> {
    const settings = await this.getSettings(tenantId);
    if (!settings?.telegramBotToken) return null;

    try {
      const { decrypt } = await import('@/lib/crypto/encryption');
      const decrypted = decrypt(settings.telegramBotToken);
      if (decrypted && /^\d{8,11}:[A-Za-z0-9_-]{35}$/.test(decrypted.trim())) {
        return decrypted.trim();
      }
    } catch (err) {
      console.error(`[BotSettingsService] Failed to decrypt bot token for ${tenantId}:`, err);
    }
    return null;
  }

  /**
   * Get active menu buttons configured in the Admin Panel
   */
  static async getMenuButtons(tenantId: string = 'smmplan'): Promise<TelegramMenuButton[]> {
    const settings = await this.getSettings(tenantId);
    const rawButtons = settings?.telegramMenuConfig as unknown as TelegramMenuButton[] | null;

    if (Array.isArray(rawButtons) && rawButtons.length > 0) {
      return rawButtons.filter(b => b.isActive !== false);
    }

    return DEFAULT_TELEGRAM_MENU_BUTTONS;
  }

  /**
   * Get message templates configured in the Admin Panel
   */
  static async getTemplates(tenantId: string = 'smmplan'): Promise<TelegramMessageTemplatesConfig> {
    const settings = await this.getSettings(tenantId);
    const rawTemplates = settings?.telegramTemplates as unknown as Partial<TelegramMessageTemplatesConfig> | null;

    const base = { ...DEFAULT_TELEGRAM_MESSAGE_TEMPLATES };

    if (rawTemplates && typeof rawTemplates === 'object') {
      if (rawTemplates.welcome?.trim()) base.welcome = rawTemplates.welcome.trim();
      if (rawTemplates.ticketClosedRating?.trim()) base.ticketClosedRating = rawTemplates.ticketClosedRating.trim();
      if (rawTemplates.ratingThanks?.trim()) base.ratingThanks = rawTemplates.ratingThanks.trim();
      if (rawTemplates.delayWarning?.trim()) base.delayWarning = rawTemplates.delayWarning.trim();
      if (rawTemplates.paymentIssue?.trim()) base.paymentIssue = rawTemplates.paymentIssue.trim();
      if (rawTemplates.serviceRefill?.trim()) base.serviceRefill = rawTemplates.serviceRefill.trim();
      if (rawTemplates.refundNotice?.trim()) base.refundNotice = rawTemplates.refundNotice.trim();
    } else if (settings?.welcomeMessage?.trim()) {
      base.welcome = settings.welcomeMessage.trim();
    }

    return base;
  }

  /**
   * Get CSAT rating reasons configured in the Admin Panel
   */
  static async getRatingReasons(tenantId: string = 'smmplan'): Promise<TelegramRatingReasonsConfig> {
    const settings = await this.getSettings(tenantId);
    const rawReasons = settings?.telegramRatingReasons as unknown as Partial<TelegramRatingReasonsConfig> | null;

    if (rawReasons && typeof rawReasons === 'object') {
      return {
        negative: rawReasons.negative?.length ? rawReasons.negative : DEFAULT_TELEGRAM_RATING_REASONS.negative,
        neutral: rawReasons.neutral?.length ? rawReasons.neutral : DEFAULT_TELEGRAM_RATING_REASONS.neutral,
        positive: rawReasons.positive?.length ? rawReasons.positive : DEFAULT_TELEGRAM_RATING_REASONS.positive,
      };
    }

    return DEFAULT_TELEGRAM_RATING_REASONS;
  }

  /**
   * Get Security & Maintenance configuration from the Admin Panel
   */
  static async getSecurityConfig(tenantId: string = 'smmplan') {
    const settings = await this.getSettings(tenantId);
    return {
      maintenanceMode: settings?.telegramMaintenanceMode ?? false,
      rateLimitPerMin: settings?.telegramRateLimitPerMin ?? 30,
      maxMessageLength: settings?.telegramMaxMessageLength ?? 4096,
      logErrors: settings?.telegramLogErrors ?? true,
    };
  }

  /**
   * Check if maintenance mode is active
   */
  static async isMaintenanceActive(tenantId: string = 'smmplan'): Promise<boolean> {
    const sec = await this.getSecurityConfig(tenantId);
    return sec.maintenanceMode;
  }

  /**
   * Find a matching configured button by incoming user text.
   * Matches exact label or normalized emoji-stripped label.
   */
  static async findButtonByText(text: string, tenantId: string = 'smmplan'): Promise<TelegramMenuButton | null> {
    const trimmed = (text || '').trim();
    if (!trimmed) return null;

    const buttons = await this.getMenuButtons(tenantId);

    // 1. Exact match (case-insensitive)
    const exact = buttons.find(b => b.label.trim().toLowerCase() === trimmed.toLowerCase());
    if (exact) return exact;

    // 2. Normalized match (strip leading emoji & whitespace)
    const cleanInput = trimmed.replace(/^[\p{Emoji}\p{Symbol}\s]+/u, '').toLowerCase().trim();
    if (cleanInput.length > 2) {
      const fuzzy = buttons.find(b => {
        const cleanLabel = b.label.replace(/^[\p{Emoji}\p{Symbol}\s]+/u, '').toLowerCase().trim();
        return cleanLabel === cleanInput || cleanLabel.startsWith(cleanInput) || cleanInput.startsWith(cleanLabel);
      });
      if (fuzzy) return fuzzy;
    }

    return null;
  }
}
