import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { db } from '@/lib/db';
import { SettingsProvider, SettingsManager, type EnvironmentMode } from '@/lib/settings';
import { providerService } from '@/services/providers/provider.service';
import { VaultService } from '@/lib/vault';
import fs from 'fs';
import path from 'path';

describe('Environment Modes E2E & Layout Verification Suite', () => {
  const TENANT_A = 'smmplan';
  const TENANT_B = 'flux';

  const mockProviderConfig = {
    id: 'prov_e2e_test_001',
    name: 'VexBoost Real Provider',
    apiUrl: 'https://vexboost.com/api/v2',
    apiKey: VaultService.encrypt('real_live_api_key_123'),
    balance: 50000,
    currency: 'RUB',
    isActive: true,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(async () => {
    // Reset to clean states
    await SettingsProvider.setEnvironmentMode('SANDBOX', TENANT_A);
    await SettingsProvider.setEnvironmentMode('PRODUCTION', TENANT_B);
  });

  afterAll(async () => {
    // Cleanup settings
    await SettingsProvider.setEnvironmentMode('SANDBOX', TENANT_A);
    await SettingsProvider.setEnvironmentMode('SANDBOX', TENANT_B);
  });

  describe('1. Layout & Banner Removal Audit', () => {
    it('should verify that the old test mode banner is completely removed from admin/layout.tsx', () => {
      const layoutPath = path.join(process.cwd(), 'src/app/admin/layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf8');

      // The obsolete banner text must NOT exist in the layout
      expect(layoutContent).not.toContain('Ghost Proxy перехватывает трафик');
      expect(layoutContent).not.toContain('Тестовый режим');

      // The compact EnvironmentModeSwitcher MUST exist in the header
      expect(layoutContent).toContain('<EnvironmentModeSwitcher');
    });

    it('should verify that inner card nested scrollbar is removed from admin/layout.tsx', () => {
      const layoutPath = path.join(process.cwd(), 'src/app/admin/layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf8');

      // Root content container has overflow-y-auto, not the inner card
      expect(layoutContent).toContain('flex-1 min-w-0 h-screen overflow-y-auto');
      expect(layoutContent).not.toContain('<div className="flex-1 w-full p-3 md:p-4.5 flex flex-col overflow-y-auto">');
    });
  });

  describe('2. Environment Modes Logic & Real vs Mock Provider Routing', () => {
    it('SANDBOX mode: should enable Mock Payment (0 ₽) and Mock Provider (Ghost / Mock API)', async () => {
      await SettingsProvider.setEnvironmentMode('SANDBOX', TENANT_A);

      const mode = await SettingsManager.getEnvironmentMode(TENANT_A);
      const isMockPayment = await SettingsManager.isMockPaymentEnabled(TENANT_A);
      const isMockProvider = await SettingsManager.isMockProviderEnabled(TENANT_A);

      expect(mode).toBe('SANDBOX');
      expect(isMockPayment).toBe(true);
      expect(isMockProvider).toBe(true);

      const instance = await providerService.getWorkerProviderInstance(mockProviderConfig as any, TENANT_A);
      expect((instance as any).apiUrl).toContain('/api/dev/mock-provider');
    });

    it('HYBRID mode: should enable Mock Payment (0 ₽) but route to REAL live provider (VexBoost)', async () => {
      await SettingsProvider.setEnvironmentMode('HYBRID', TENANT_A);

      const mode = await SettingsManager.getEnvironmentMode(TENANT_A);
      const isMockPayment = await SettingsManager.isMockPaymentEnabled(TENANT_A);
      const isMockProvider = await SettingsManager.isMockProviderEnabled(TENANT_A);

      expect(mode).toBe('HYBRID');
      expect(isMockPayment).toBe(true);
      expect(isMockProvider).toBe(false); // Real provider execution!

      const instance = await providerService.getWorkerProviderInstance(mockProviderConfig as any, TENANT_A);
      // In HYBRID, orders are sent to real provider URL, not mock!
      expect((instance as any).apiUrl).toBe('https://vexboost.com/api/v2');
    });

    it('ACQUIRING_TEST mode: should use Real Payment Gateway but Mock Provider', async () => {
      await SettingsProvider.setEnvironmentMode('ACQUIRING_TEST', TENANT_A);

      const mode = await SettingsManager.getEnvironmentMode(TENANT_A);
      const isMockPayment = await SettingsManager.isMockPaymentEnabled(TENANT_A);
      const isMockProvider = await SettingsManager.isMockProviderEnabled(TENANT_A);

      expect(mode).toBe('ACQUIRING_TEST');
      expect(isMockPayment).toBe(false); // Real payment gateway
      expect(isMockProvider).toBe(true);  // Mock provider

      const instance = await providerService.getWorkerProviderInstance(mockProviderConfig as any, TENANT_A);
      expect((instance as any).apiUrl).toContain('/api/dev/mock-provider');
    });

    it('PRODUCTION mode: should use Real Payment Gateway and REAL live provider', async () => {
      await SettingsProvider.setEnvironmentMode('PRODUCTION', TENANT_A);

      const mode = await SettingsManager.getEnvironmentMode(TENANT_A);
      const isMockPayment = await SettingsManager.isMockPaymentEnabled(TENANT_A);
      const isMockProvider = await SettingsManager.isMockProviderEnabled(TENANT_A);

      expect(mode).toBe('PRODUCTION');
      expect(isMockPayment).toBe(false);
      expect(isMockProvider).toBe(false);

      const instance = await providerService.getWorkerProviderInstance(mockProviderConfig as any, TENANT_A);
      expect((instance as any).apiUrl).toBe('https://vexboost.com/api/v2');
    });
  });

  describe('3. Multi-Tenant Mode Isolation', () => {
    it('should maintain completely independent environment modes per tenant without cross-talk', async () => {
      // Set smmplan to HYBRID and flux to SANDBOX
      await SettingsProvider.setEnvironmentMode('HYBRID', TENANT_A);
      await SettingsProvider.setEnvironmentMode('SANDBOX', TENANT_B);

      // Verify smmplan is HYBRID
      expect(await SettingsManager.getEnvironmentMode(TENANT_A)).toBe('HYBRID');
      expect(await SettingsManager.isMockProviderEnabled(TENANT_A)).toBe(false); // Real provider

      // Verify flux is SANDBOX
      expect(await SettingsManager.getEnvironmentMode(TENANT_B)).toBe('SANDBOX');
      expect(await SettingsManager.isMockProviderEnabled(TENANT_B)).toBe(true); // Mock provider

      // Verify provider instances reflect each tenant correctly
      const smmplanInstance = await providerService.getWorkerProviderInstance(mockProviderConfig as any, TENANT_A);
      const fluxInstance = await providerService.getWorkerProviderInstance(mockProviderConfig as any, TENANT_B);

      expect((smmplanInstance as any).apiUrl).toBe('https://vexboost.com/api/v2');
      expect((fluxInstance as any).apiUrl).toContain('/api/dev/mock-provider');
    });
  });
});
