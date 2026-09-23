import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateUserRole } from '@/actions/admin/settings';
import { db } from '@/lib/db';
import { settingsService } from '@/services/admin/settings.service';

let mockAdminUser = { id: 'admin-id', role: 'ADMIN', email: 'admin@test.com' };

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn(async (section: string, mode: string, callback: any) => {
    return callback(mockAdminUser);
  }),
  requireOwnerPermission: vi.fn(async (callback: any) => {
    return callback(mockAdminUser);
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/services/admin/settings.service', () => ({
  settingsService: {
    updateUserRole: vi.fn(),
  },
}));

vi.mock('@/utils/ip', () => ({
  getClientIp: vi.fn(() => Promise.resolve('127.0.0.1')),
}));

vi.mock('@/lib/admin-audit', () => ({
  auditAdminAwaitable: vi.fn(() => Promise.resolve()),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('updateUserRole Server Action Security Bounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows OWNER to change any user\'s role (including existing ADMINs/OWNERs)', async () => {
    mockAdminUser = { id: 'owner-id', role: 'OWNER', email: 'owner@test.com' };

    // Target user is an ADMIN
    (db.user.findUnique as any).mockResolvedValue({
      id: 'target-admin-id',
      email: 'target-admin@test.com',
      role: 'ADMIN',
    });

    const formData = new FormData();
    formData.append('userId', 'target-admin-id');
    formData.append('role', 'SUPPORT');

    await expect(updateUserRole(formData)).resolves.not.toThrow();
    expect(settingsService.updateUserRole).toHaveBeenCalledWith('target-admin-id', 'SUPPORT', null);
  });

  it('prevents ADMIN, MANAGER, or SUPPORT from promoting a user to ADMIN or OWNER', async () => {
    mockAdminUser = { id: 'admin-id', role: 'ADMIN', email: 'admin@test.com' };

    // Target user is a normal USER
    (db.user.findUnique as any).mockResolvedValue({
      id: 'target-user-id',
      email: 'target-user@test.com',
      role: 'USER',
    });

    // Attempting to promote target user to ADMIN
    const formData = new FormData();
    formData.append('userId', 'target-user-id');
    formData.append('role', 'ADMIN');

    await expect(updateUserRole(formData)).rejects.toThrow('Только Владелец может назначать роли Админ или Владелец');
    expect(settingsService.updateUserRole).not.toHaveBeenCalled();
  });

  it('prevents ADMIN, MANAGER, or SUPPORT from demoting/modifying an existing ADMIN or OWNER user', async () => {
    mockAdminUser = { id: 'admin-id', role: 'ADMIN', email: 'admin@test.com' };

    // Target user is an OWNER
    (db.user.findUnique as any).mockResolvedValue({
      id: 'target-owner-id',
      email: 'target-owner@test.com',
      role: 'OWNER',
    });

    // Attempting to demote target OWNER to SUPPORT
    const formData = new FormData();
    formData.append('userId', 'target-owner-id');
    formData.append('role', 'SUPPORT');

    await expect(updateUserRole(formData)).rejects.toThrow('Только Владелец может изменять права администраторов');
    expect(settingsService.updateUserRole).not.toHaveBeenCalled();
  });

  it('prevents a user from changing their own role', async () => {
    mockAdminUser = { id: 'admin-id', role: 'ADMIN', email: 'admin@test.com' };

    // Attempting to change own role
    const formData = new FormData();
    formData.append('userId', 'admin-id');
    formData.append('role', 'SUPPORT');

    await expect(updateUserRole(formData)).rejects.toThrow('Cannot change own role');
    expect(settingsService.updateUserRole).not.toHaveBeenCalled();
  });
});
