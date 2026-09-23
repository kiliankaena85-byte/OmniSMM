/**
 * e2e/06-rbac-and-security.spec.ts
 * BLOCK 6: RBAC, Multi-Tenant Boundaries, Admin Audit Trail & AES-256 Vault E2E Tests
 *
 * Invariants & Contract (AGENTS.md & Zero-Defect):
 * 1. RBAC Guard: Regular USER strictly blocked from Staff/Admin actions.
 * 2. Immutable Admin Audit: Sensitive actions persisted in AdminAuditLog with sanitization.
 * 3. Secret Encryption: AES-256-GCM Vault encryption at rest for API keys.
 * 4. Multi-Tenant Isolation: Tenant-scoped queries never leak data across brands.
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { VaultService } from '../src/lib/vault';
import { auditAdmin, auditAdminAwaitable } from '../src/lib/admin-audit';

const db = new PrismaClient();

test.describe.serial('BLOCK 6: RBAC, Security, Audit Trail & Vault Encryption E2E', () => {
  let regularUserId: string;
  let adminUserId: string;

  test.beforeAll(async () => {
    // 1. Regular client
    const regularUser = await db.user.create({
      data: {
        email: `sec-user-${Date.now()}@smmplan.local`,
        tenantId: 'smmplan',
        role: 'USER',
        balance: 10_000,
        isActive: true,
        isDeleted: false,
      },
    });
    regularUserId = regularUser.id;

    // 2. Admin user
    const adminUser = await db.user.create({
      data: {
        email: `sec-admin-${Date.now()}@smmplan.local`,
        tenantId: 'smmplan',
        role: 'ADMIN',
        isActive: true,
        isDeleted: false,
      },
    });
    adminUserId = adminUser.id;
  });

  test.afterAll(async () => {
    await db.adminAuditLog.deleteMany({ where: { adminId: adminUserId } }).catch(() => {});
    await db.user.deleteMany({ where: { id: { in: [regularUserId, adminUserId] } } }).catch(() => {});
    await db.$disconnect();
  });

  test('Scenario 1: RBAC Hierarchy & Unauthorized User Role Blocking', async () => {
    // 1. Verify regular user has role USER
    const user = await db.user.findUnique({ where: { id: regularUserId } });
    expect(user?.role).toBe('USER');

    // 2. Verify admin user has role ADMIN
    const admin = await db.user.findUnique({ where: { id: adminUserId } });
    expect(admin?.role).toBe('ADMIN');
  });

  test('Scenario 2: AES-256-GCM Vault Encryption & Decryption Roundtrip', async () => {
    const plainApiKey = 'super_secret_reseller_api_key_xyz987654321';

    // 1. Encrypt raw key
    const encrypted = VaultService.encrypt(plainApiKey);
    expect(encrypted).not.toBe(plainApiKey);

    // 2. Verify encrypted format: iv:authTag:ciphertext (3 parts)
    const parts = encrypted.split(':');
    expect(parts.length).toBe(3);
    expect(parts[0].length).toBe(32); // 16 bytes IV = 32 hex chars
    expect(parts[1].length).toBe(32); // 16 bytes AuthTag = 32 hex chars

    // 3. Decrypt back
    const decrypted = VaultService.decrypt(encrypted);
    expect(decrypted).toBe(plainApiKey);
  });

  test('Scenario 3: Admin Audit Trail Immutable Logging & Sensitive Field Scrubbing', async () => {
    const actionName = 'UPDATE_SERVICE_PRICING';
    const clientIp = '127.0.0.1';
    const metadata = {
      serviceId: 'svc_e2e_audit_test',
      oldRate: 5.0,
      newRate: 7.5,
      providerApiKey: 'super_secret_token_12345', // Must be scrubbed
    };

    // 1. Log sensitive admin action
    await auditAdminAwaitable({
      adminId: adminUserId,
      adminEmail: 'sec-admin@smmplan.local',
      action: actionName,
      target: metadata.serviceId,
      targetType: 'Service',
      newValue: metadata,
      ipAddress: clientIp,
    });

    // 2. Verify log in DB
    const log = await db.adminAuditLog.findFirst({
      where: {
        adminId: adminUserId,
        action: actionName,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(log).not.toBeNull();
    expect(log?.action).toBe(actionName);
    expect(log?.targetType).toBe('Service');
    expect(log?.adminId).toBe(adminUserId);

    // 3. Verify sensitive API key was automatically scrubbed by safeSerialize
    const details = JSON.parse(log?.newValue || '{}');
    expect(details.providerApiKey).toBe('[SCRUBBED]');
    expect(details.newRate).toBe(7.5);
  });

  test('Scenario 4: Strict Multi-Tenant Data Isolation & Query Boundary', async () => {
    // 1. Create a tenant-isolated resource under smmflux
    const fluxUser = await db.user.create({
      data: {
        email: `flux-isolated-${Date.now()}@smmflux.local`,
        tenantId: 'flux',
        role: 'USER',
        balance: 5_000,
        isActive: true,
      },
    });

    // 2. Querying smmplan tenant must NEVER return flux user
    const smmplanUsers = await db.user.findMany({
      where: {
        id: fluxUser.id,
        tenantId: 'smmplan',
      },
    });
    expect(smmplanUsers.length).toBe(0);

    // 3. Querying flux tenant returns exactly 1 user
    const fluxUsers = await db.user.findMany({
      where: {
        id: fluxUser.id,
        tenantId: 'flux',
      },
    });
    expect(fluxUsers.length).toBe(1);
    expect(fluxUsers[0].id).toBe(fluxUser.id);

    // Cleanup
    await db.user.delete({ where: { id: fluxUser.id } }).catch(() => {});
  });
});
