/**
 * wave4-perimeter-security-invariants.test.ts
 * Юнит-тесты на инварианты Волны 4: Безопасность Периметра, Auth, RBAC и IDOR.
 */

import { describe, it, expect, vi } from 'vitest';
import { isKnownOrAllowedHost, cleanHostString } from '@/proxy';
import { requireStaffPermission } from '@/lib/server/rbac';
import { reportPaymentIssueAction } from '@/actions/customer/payment-issue';
import { db } from '@/lib/db';
import * as sessionModule from '@/lib/session';

describe('Wave 4 Invariants: Perimeter Security, RBAC & Multi-Tenant', () => {
  it('1. Proxy Host Allowlist: Accepts authorized domains & tunnels, rejects untrusted hosts', () => {
    // Authorized domains
    expect(isKnownOrAllowedHost('smmplan.pro')).toBe(true);
    expect(isKnownOrAllowedHost('api.smmplan.pro')).toBe(true);
    expect(isKnownOrAllowedHost('smmflux.ru')).toBe(true);
    expect(isKnownOrAllowedHost('test.smmplan.pro')).toBe(true);
    expect(isKnownOrAllowedHost('my-node.ts.net')).toBe(true);
    expect(isKnownOrAllowedHost('localhost:3000')).toBe(true);

    // Host cleaning
    expect(cleanHostString('smmplan.pro:3000')).toBe('smmplan.pro');
    expect(cleanHostString('smmplan.pro.')).toBe('smmplan.pro');

    // Untrusted hosts (Phishing / SSRF / Host Header Injection)
    expect(isKnownOrAllowedHost('evil-attacker.com')).toBe(false);
    expect(isKnownOrAllowedHost('smmplan.pro.evil.com')).toBe(false);
    expect(isKnownOrAllowedHost('fake-phish-smmflux.com')).toBe(false);
  });

  it('2. RBAC Guard Invariant: Rejects unauthorized callers and regular users from staff actions', async () => {
    vi.spyOn(sessionModule, 'verifySession').mockResolvedValue(null);

    const guestResult = await requireStaffPermission('settings', 'view', async () => {
      return { success: true, data: 'secret_admin_data' };
    });

    expect(guestResult).toEqual({
      success: false,
      error: 'Unauthorized access',
    });

    // Mock regular user (role: 'USER')
    vi.spyOn(sessionModule, 'verifySession').mockResolvedValue({
      userId: 'user-regular-123',
    } as any);

    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: 'user-regular-123',
      role: 'USER',
      staffRoleId: null,
      tenantId: 'smmplan',
    } as any);

    const regularUserResult = await requireStaffPermission('settings', 'view', async () => {
      return { success: true, data: 'secret_admin_data' };
    });

    expect(regularUserResult).toEqual({
      success: false,
      error: 'Forbidden: Administrator/Staff context required',
    });
  });

  it('3. Customer Payment IDOR Guard: Blocks access to payments belonging to another user', async () => {
    // Authenticated as user A
    vi.spyOn(sessionModule, 'verifySession').mockResolvedValue({
      userId: 'user-A',
    } as any);

    // Payment belongs to user B
    vi.spyOn(db.payment, 'findUnique').mockResolvedValue({
      id: 'pay-456',
      userId: 'user-B',
      orders: [],
    } as any);

    const result = await reportPaymentIssueAction('pay-456');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Доступ ограничен');
  });
});
