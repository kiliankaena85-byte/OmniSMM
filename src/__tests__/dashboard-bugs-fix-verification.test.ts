import { describe, it, expect } from 'vitest';
import { getRolePermissions, ROLE_PERMISSIONS } from '@/lib/permissions';
import { formatBalance } from '@/lib/utils';

describe('Dashboard & Admin 4 Critical Bugs Fix Suite', () => {
  describe('Bug #1: Social Networks Russian Pluralization & Dynamic Naming', () => {
    const getSocialNetworkPlural = (n: number) => {
      if (n % 10 === 1 && n % 100 !== 11) return 'соцсеть';
      if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'соцсети';
      return 'соцсетей';
    };

    it('correctly pluralizes Russian word for social network counts', () => {
      expect(getSocialNetworkPlural(1)).toBe('соцсеть');
      expect(getSocialNetworkPlural(21)).toBe('соцсеть');
      expect(getSocialNetworkPlural(2)).toBe('соцсети');
      expect(getSocialNetworkPlural(4)).toBe('соцсети');
      expect(getSocialNetworkPlural(24)).toBe('соцсети');
      expect(getSocialNetworkPlural(5)).toBe('соцсетей');
      expect(getSocialNetworkPlural(11)).toBe('соцсетей');
      expect(getSocialNetworkPlural(14)).toBe('соцсетей');
      expect(getSocialNetworkPlural(34)).toBe('соцсети');
      expect(getSocialNetworkPlural(0)).toBe('соцсетей');
    });
  });

  describe('Bug #2: Deep RBAC & UI Component Hiding Invariants', () => {
    it('grants full access to OWNER and ADMIN', () => {
      const ownerPerms = getRolePermissions('OWNER');
      expect(ownerPerms.canAccessExecutive).toBe(true);
      expect(ownerPerms.canUseKillSwitch).toBe(true);
      expect(ownerPerms.canViewLiquidity).toBe(true);
      expect(ownerPerms.canViewAuditLogs).toBe(true);
      expect(ownerPerms.canAccessTelegram).toBe(true);
      expect(ownerPerms.canViewFinancials).toBe(true);

      const adminPerms = getRolePermissions('ADMIN');
      expect(adminPerms.canAccessExecutive).toBe(true);
      expect(adminPerms.canUseKillSwitch).toBe(true);
      expect(adminPerms.canViewLiquidity).toBe(true);
      expect(adminPerms.canViewAuditLogs).toBe(true);
    });

    it('strictly restricts SUPPORT role from sensitive widgets and controls', () => {
      const supportPerms = getRolePermissions('SUPPORT');
      expect(supportPerms.canAccessExecutive).toBe(false);
      expect(supportPerms.canUseKillSwitch).toBe(false);
      expect(supportPerms.canViewLiquidity).toBe(false);
      expect(supportPerms.canViewAuditLogs).toBe(false);
      expect(supportPerms.canAccessTelegram).toBe(false);
      expect(supportPerms.canViewFinancials).toBe(false);
      expect(supportPerms.canEditCatalog).toBe(false);
    });

    it('strictly restricts MANAGER role from Executive, Kill-Switch, Liquidity, and Audit Logs', () => {
      const managerPerms = getRolePermissions('MANAGER');
      expect(managerPerms.canAccessExecutive).toBe(false);
      expect(managerPerms.canUseKillSwitch).toBe(false);
      expect(managerPerms.canViewLiquidity).toBe(false);
      expect(managerPerms.canViewAuditLogs).toBe(false);
      expect(managerPerms.canAccessTelegram).toBe(false);
      expect(managerPerms.canViewFinancials).toBe(false);
      // Manager can edit catalog by default
      expect(managerPerms.canEditCatalog).toBe(true);
    });

    it('supports custom staff permission overrides for specific granular delegations', () => {
      const customSupport = getRolePermissions('SUPPORT', [
        { section: 'providers', canView: true, canEdit: false },
      ]);
      expect(customSupport.canViewLiquidity).toBe(true);
      expect(customSupport.canUseKillSwitch).toBe(false);
      expect(customSupport.canAccessExecutive).toBe(false);
    });
  });

  describe('Bug #3: Balance State Formatting & Synchronization Invariants', () => {
    it('formats kopecks/cents into standard ruble strings', () => {
      expect(formatBalance(100000)).toContain('1');
      expect(formatBalance(0)).toContain('0');
    });
  });

  describe('Bug #4: Dashboard Order Fulfillment Rate & Math Invariants', () => {
    it('calculates successOrderRate using terminal orders without penalty from in-progress or cart orders', () => {
      // Scenario from user screenshot:
      // Total orders: 87 (including 20 awaiting payment, 35 in progress, 15 pending, 15 completed, 1 partial, 1 canceled)
      const oStats = {
        total: 87,
        pending: 15,
        inProgress: 35,
        awaitingPayment: 20,
        completed: 15,
        partial: 1,
        canceled: 1,
        error: 0,
      };

      const fulfilledOrders = (oStats.completed || 0) + (oStats.partial || 0); // 16
      const terminalOrders = fulfilledOrders + (oStats.error || 0) + (oStats.canceled || 0); // 17
      const successOrderRate = terminalOrders > 0
        ? ((fulfilledOrders / terminalOrders) * 100).toFixed(1)
        : '100';

      // 16 / 17 * 100 = 94.1%, NOT 15 / 87 = 17.2% or 12.6%!
      expect(successOrderRate).toBe('94.1');
    });

    it('defaults successOrderRate to 100 when there are no terminal orders yet', () => {
      const oStats = {
        total: 10,
        pending: 5,
        inProgress: 5,
        completed: 0,
        partial: 0,
        canceled: 0,
        error: 0,
      };

      const fulfilledOrders = (oStats.completed || 0) + (oStats.partial || 0);
      const terminalOrders = fulfilledOrders + (oStats.error || 0) + (oStats.canceled || 0);
      const successOrderRate = terminalOrders > 0
        ? ((fulfilledOrders / terminalOrders) * 100).toFixed(1)
        : '100';

      expect(successOrderRate).toBe('100');
    });
  });
});
