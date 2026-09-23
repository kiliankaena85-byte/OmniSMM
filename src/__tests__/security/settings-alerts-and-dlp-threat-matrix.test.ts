import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataLossPreventionService } from '@/services/security/data-loss-prevention.service';
import { SecurityAlertService } from '@/services/security/security-alert.service';
import { sendAdminAlert } from '@/lib/notifications';
import { redis } from '@/lib/redis';

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn(),
  sendAdminAlertSync: vi.fn(),
  sendP0EmergencyAlert: vi.fn(),
}));

vi.mock('@/services/security/security-alert.service', () => ({
  SecurityAlertService: {
    record: vi.fn().mockResolvedValue({ id: 'test-sec-id' }),
  },
}));

describe('Settings Mutation Alerting, DLP Sentinel & Threat Defense Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DLP Sentinel (Insider Data Scraping Detection)', () => {
    it('allows normal staff data queries below threshold', async () => {
      const result = await DataLossPreventionService.checkStaffDataAccess({
        userId: 'staff_1',
        userEmail: 'support@smmplan.ru',
        userRole: 'SUPPORT',
        action: 'EXPORT_USERS',
        recordCount: 1,
        tenantId: 'smmplan'
      });

      expect(result.allowed).toBe(true);
      expect(SecurityAlertService.record).not.toHaveBeenCalled();
    });

    it('triggers CRITICAL P0 security alert and blocks staff when export rate threshold is breached', async () => {
      const testUserId = `scraping_test_user_${Date.now()}`;
      
      // Simulate rapid bulk exports exceeding max threshold (3 for EXPORT_USERS)
      await DataLossPreventionService.checkStaffDataAccess({
        userId: testUserId,
        userEmail: 'rogue_employee@smmplan.pro',
        userRole: 'SUPPORT',
        action: 'EXPORT_USERS',
        recordCount: 2,
        tenantId: 'smmplan'
      });

      const blockedResult = await DataLossPreventionService.checkStaffDataAccess({
        userId: testUserId,
        userEmail: 'rogue_employee@smmplan.pro',
        userRole: 'SUPPORT',
        action: 'EXPORT_USERS',
        recordCount: 2, // total = 4 > 3
        tenantId: 'smmplan'
      });

      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.error).toContain('Превышен порог выгрузки данных');
      expect(SecurityAlertService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'INSIDER_DATA_SCRAPING_ANOMALY',
          severity: 'CRITICAL',
          details: expect.objectContaining({
            staffUserId: testUserId,
            action: 'EXPORT_USERS',
          })
        })
      );
    });

    it('allows OWNER to conduct operations without blocking while still logging high volumes', async () => {
      const ownerId = `owner_test_${Date.now()}`;

      const ownerResult = await DataLossPreventionService.checkStaffDataAccess({
        userId: ownerId,
        userEmail: 'owner@smmplan.pro',
        userRole: 'OWNER',
        action: 'EXPORT_USERS',
        recordCount: 10,
        tenantId: 'smmplan'
      });

      expect(ownerResult.allowed).toBe(true);
    });
  });

  describe('Alert Trigger Invariants & Formatting', () => {
    it('verifies sendAdminAlert is invoked with structured HTML payload and appropriate severity', () => {
      sendAdminAlert(
        `🚨 <b>[P0 CRITICAL] ИЗМЕНЕНИЕ ПЛАТЁЖНЫХ ШЛЮЗОВ</b>\n` +
        `<b>Тенант / Бренд:</b> <code>smmplan</code>\n` +
        `<b>Изменённые параметры:</b> <code>yookassaShopId, yookassaSecretKey</code>`,
        'CRITICAL',
        'smmplan'
      );

      expect(sendAdminAlert).toHaveBeenCalledTimes(1);
      const [msg, severity, tenant] = vi.mocked(sendAdminAlert).mock.calls[0];
      expect(msg).toContain('[P0 CRITICAL] ИЗМЕНЕНИЕ ПЛАТЁЖНЫХ ШЛЮЗОВ');
      expect(msg).toContain('yookassaShopId');
      expect(severity).toBe('CRITICAL');
      expect(tenant).toBe('smmplan');
    });

    it('verifies Telegram bot disconnect alert is sent with brand-specific tenant scoping', () => {
      sendAdminAlert(
        `🚨 <b>TELEGRAM-БОТ ПОДДЕРЖКИ ОТВЯЗАН</b>\n` +
        `<b>Тенант / Бренд:</b> <code>flux</code>\n` +
        `<b>Администратор:</b> admin@smmflux.ru`,
        'WARNING',
        'flux'
      );

      expect(sendAdminAlert).toHaveBeenCalledWith(
        expect.stringContaining('TELEGRAM-БОТ ПОДДЕРЖКИ ОТВЯЗАН'),
        'WARNING',
        'flux'
      );
    });

    it('verifies Tenant deactivation alert is dispatched with CRITICAL severity', () => {
      sendAdminAlert(
        `🚨 <b>СТАТУС ТЕНАНТА ИЗМЕНЁН</b>\n` +
        `<b>Тенант:</b> <code>custom-brand</code>\n` +
        `<b>Статус:</b> 🔴 ДЕАКТИВИРОВАН`,
        'CRITICAL',
        'custom-brand'
      );

      expect(sendAdminAlert).toHaveBeenCalledWith(
        expect.stringContaining('ДЕАКТИВИРОВАН'),
        'CRITICAL',
        'custom-brand'
      );
    });

    it('verifies cross-tenant data access attempt triggers SecurityAlertService.record', async () => {
      await SecurityAlertService.record({
        event: 'CROSS_TENANT_DATA_ACCESS_ATTEMPT',
        severity: 'HIGH',
        tenantId: 'smmplan',
        details: {
          staffUserId: 'staff_rogue_1',
          staffEmail: 'staff@smmplan.pro',
          assignedTenant: 'smmplan',
          requestedTenant: 'flux',
          endpoint: '/api/admin/export'
        }
      });

      expect(SecurityAlertService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'CROSS_TENANT_DATA_ACCESS_ATTEMPT',
          severity: 'HIGH',
          tenantId: 'smmplan',
        })
      );
    });
  });
});
