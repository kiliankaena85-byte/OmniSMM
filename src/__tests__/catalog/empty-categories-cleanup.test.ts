import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanupEmptyCategoriesAction } from '@/actions/admin/catalog/categories';
import { db } from '@/lib/db';

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn((section: string, action: string, cb: any) =>
    cb({ id: 'admin_1', email: 'admin@smmplan.pro', role: 'ADMIN' })
  ),
}));

vi.mock('@/lib/admin-audit', () => ({
  auditAdmin: vi.fn(),
  auditAdminAwaitable: vi.fn().mockResolvedValue(true),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/db', () => {
  const categories: any[] = [];
  return {
    db: {
      category: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
    },
  };
});

describe('Empty Categories Cleanup Action & Sanitation (No Ghost Taxonomy)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success with 0 deleted when no empty categories exist', async () => {
    vi.mocked(db.category.findMany).mockResolvedValueOnce([]);

    const result = await cleanupEmptyCategoriesAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.deletedCount).toBe(0);
      expect(result.message).toContain('не обнаружено');
    }
    expect(db.category.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes all empty categories across all networks when networkId is not specified', async () => {
    const mockEmptyCats = [
      { id: 'cat_empty_1', name: 'Мусорные боты', networkId: 'net_tg', tenantId: 'smmplan' },
      { id: 'cat_empty_2', name: 'Старые просмотры', networkId: 'net_vk', tenantId: 'smmplan' },
    ];

    vi.mocked(db.category.findMany).mockResolvedValueOnce(mockEmptyCats as any);
    vi.mocked(db.category.deleteMany).mockResolvedValueOnce({ count: 2 });

    const result = await cleanupEmptyCategoriesAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.deletedCount).toBe(2);
      expect(result.message).toContain('Успешно удалено 2 пустых категорий');
    }

    expect(db.category.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['cat_empty_1', 'cat_empty_2'] } },
    });
  });

  it('deletes only empty categories within the selected network', async () => {
    const mockEmptyTgCats = [
      { id: 'cat_tg_empty', name: 'Пустые TG подписчики', networkId: 'net_tg', tenantId: 'smmplan' },
    ];

    vi.mocked(db.category.findMany).mockResolvedValueOnce(mockEmptyTgCats as any);
    vi.mocked(db.category.deleteMany).mockResolvedValueOnce({ count: 1 });

    const result = await cleanupEmptyCategoriesAction('net_tg');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.deletedCount).toBe(1);
    }

    expect(db.category.findMany).toHaveBeenCalledWith({
      where: {
        services: { none: {} },
        networkId: 'net_tg',
      },
      select: { id: true, name: true, networkId: true, tenantId: true },
    });
  });

  it('enforces services: { none: {} } invariant so cross-tenant populated categories are never targeted', async () => {
    vi.mocked(db.category.findMany).mockResolvedValueOnce([]);

    await cleanupEmptyCategoriesAction();

    // Verify the query strictly looks for categories where services has { none: {} }
    expect(db.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          services: { none: {} },
        }),
      })
    );
  });
});
