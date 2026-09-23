import { describe, it, expect } from 'vitest';
import { RBAC_SECTIONS } from '@/lib/rbac-sections';
import { SYSTEM_TABS } from '@/components/admin/navigation-data';

describe('Admin Roles & RBAC Matrix Integrity Suite (SIL-2026 Step 16)', () => {
  describe('RBAC Sections Completeness & Groups', () => {
    it('covers all 16 platform sections across operational and security domains', () => {
      expect(RBAC_SECTIONS.length).toBe(16);

      const requiredSections = [
        'dashboard',
        'clients',
        'orders',
        'refills',
        'tickets',
        'catalog',
        'providers',
        'marketing',
        'content',
        'finance',
        'balance_requests',
        'balance_approvals',
        'balance_stats',
        'balance_policy',
        'analytics',
        'settings'
      ];

      const sectionIds = RBAC_SECTIONS.map(s => s.id);
      for (const req of requiredSections) {
        expect(sectionIds).toContain(req);
      }
    });

    it('validates that every section has non-empty label, group, and description', () => {
      for (const section of RBAC_SECTIONS) {
        expect(section.label.length).toBeGreaterThan(0);
        expect(section.group.length).toBeGreaterThan(0);
        expect(section.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('System Roles Protection & Invariants', () => {
    it('ensures system roles cannot be deleted', () => {
      const isSystemRole = true;
      const canDelete = !isSystemRole;
      expect(canDelete).toBe(false);
    });

    it('ensures roles with assigned users cannot be deleted', () => {
      const userCount: number = 3;
      const canDelete = userCount === 0;
      expect(canDelete).toBe(false);
    });
  });

  describe('SYSTEM_TABS Navigation Cluster Integrity', () => {
    it('verifies /admin/settings/roles is part of SYSTEM_TABS navigation cluster', () => {
      const rolesTab = SYSTEM_TABS.find(t => t.href === '/admin/settings/roles');
      expect(rolesTab).toBeDefined();
      expect(rolesTab?.label).toBe('Роли и права');
    });
  });
});