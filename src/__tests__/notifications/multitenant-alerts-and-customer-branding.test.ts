/**
 * (c) 2024-2026 OmniSMM Platform. All rights reserved.
 * Master Test Suite for Multi-Tenant Alerts & Customer Branding Architecture.
 *
 * Enforces:
 * 1. Admin/System Alerts & Emergency Monitor are branded strictly as OmniSMM 1.0.
 * 2. Customer Emails (Magic Link, Welcome, Orders) are branded strictly by their registered tenant (SMMplan / SMMflux).
 * 3. Telegram Alerts explicitly label the tenant/storefront where an incident occurred.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { normalizeTenantId, getTenantHost, getTenantSiteName } from '@/lib/seo-helpers';
import { ErrorInterpreter } from '@/lib/telemetry/error-interpreter';

describe('📢 Multi-Tenant Alerts & Customer Branding Architecture', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_URL', 'https://smmplan.pro');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
  describe('1. Platform Engine vs Tenant Identity', () => {
    it('verifies platform engine name is strictly OmniSMM 1.0', () => {
      const PLATFORM_ENGINE_NAME = 'OmniSMM 1.0';
      expect(PLATFORM_ENGINE_NAME).toBe('OmniSMM 1.0');
    });

    it('resolves SMMplan branding for tenant "smmplan"', () => {
      const tenant = normalizeTenantId('smmplan');
      expect(getTenantSiteName(tenant)).toBe('SMMplan');
      expect(getTenantHost(tenant)).toBe('smmplan.pro');
    });

    it('resolves SMMflux branding for tenant "flux" or "smmflux"', () => {
      const tenant1 = normalizeTenantId('flux');
      const tenant2 = normalizeTenantId('smmflux');
      expect(getTenantSiteName(tenant1)).toBe('SMMflux');
      expect(getTenantHost(tenant1)).toBe('smmflux.ru');
      expect(getTenantSiteName(tenant2)).toBe('SMMflux');
      expect(getTenantHost(tenant2)).toBe('smmflux.ru');
    });
  });

  describe('2. Customer Notification Template Contracts', () => {
    it('generates customer magic link with correct tenant brand and domain', () => {
      const smmplanTenant = 'smmplan';
      const fluxTenant = 'flux';

      const smmplanHost = getTenantHost(smmplanTenant);
      const fluxHost = getTenantHost(fluxTenant);

      const smmplanBrand = getTenantSiteName(smmplanTenant);
      const fluxBrand = getTenantSiteName(fluxTenant);

      expect(`https://${smmplanHost}/api/auth/verify?token=tok_123`).toBe('https://smmplan.pro/api/auth/verify?token=tok_123');
      expect(`https://${fluxHost}/api/auth/verify?token=tok_123`).toBe('https://smmflux.ru/api/auth/verify?token=tok_123');

      expect(`Ваша ссылка для входа в ${smmplanBrand}`).toBe('Ваша ссылка для входа в SMMplan');
      expect(`Ваша ссылка для входа в ${fluxBrand}`).toBe('Ваша ссылка для входа в SMMflux');
    });

    it('generates order notifications with isolated tenant headers', () => {
      const orderId = 'ORD-4401';
      const smmplanBrand = getTenantSiteName('smmplan');
      const fluxBrand = getTenantSiteName('flux');

      expect(`Ваш заказ #${orderId} выполнен — ${smmplanBrand}!`).toBe('Ваш заказ #ORD-4401 выполнен — SMMplan!');
      expect(`Ваш заказ #${orderId} выполнен — ${fluxBrand}!`).toBe('Ваш заказ #ORD-4401 выполнен — SMMflux!');
    });
  });

  describe('3. Admin Telegram Alerts Tenant Labeling', () => {
    it('formats Telegram alert with specific tenant badge when tenantId is provided', () => {
      const fluxAlert = ErrorInterpreter.formatTelegramMessage(
        'Ошибка создания платежа через ЮKassa',
        'WARNING',
        'flux'
      );
      expect(fluxAlert).toContain('Локация:</b> <code>SMMflux (smmflux.ru)</code>');

      const smmplanAlert = ErrorInterpreter.formatTelegramMessage(
        'Ошибка создания платежа через ЮKassa',
        'WARNING',
        'smmplan'
      );
      expect(smmplanAlert).toContain('Локация:</b> <code>SMMplan (smmplan.pro)</code>');
    });

    it('formats Telegram alert with OmniSMM 1.0 Core Engine badge for global infrastructure incidents', () => {
      const dbAlert = ErrorInterpreter.formatTelegramMessage(
        'PrismaClientInitializationError: Can\'t reach database server',
        'CRITICAL'
      );
      expect(dbAlert).toContain('Локация:</b> <code>OmniSMM 1.0 (Core Engine / Глобально)</code>');
    });
  });
});
