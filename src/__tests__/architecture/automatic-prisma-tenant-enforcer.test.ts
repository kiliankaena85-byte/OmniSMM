import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveActiveTenantId, isTenantBypassActive } from '@/lib/tenant-context';
import { createTenantEnforcerExtension } from '@/lib/prisma-tenant-enforcer';

vi.mock('@/lib/tenant-context', () => ({
  resolveActiveTenantId: vi.fn(),
  isTenantBypassActive: vi.fn(),
}));

describe('Automatic Prisma Tenant Enforcer (RLS 2026)', () => {
  let mockPrisma: any;
  let mockQuery: any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockQuery = vi.fn().mockResolvedValue('query-result');
    mockPrisma = {
      $transaction: vi.fn().mockImplementation(async (arr: any[]) => {
        const res0 = await arr[0];
        const res1 = await arr[1];
        return [res0, res1];
      }),
      $executeRawUnsafe: vi.fn().mockResolvedValue('raw-unsafe-result'),
      $executeRaw: vi.fn().mockResolvedValue('raw-result'),
    };
  });

  it('should inject SET LOCAL ROLE app_user and set_config when tenant is active', async () => {
    vi.mocked(resolveActiveTenantId).mockResolvedValue('flux');
    vi.mocked(isTenantBypassActive).mockReturnValue(false);

    const extension = createTenantEnforcerExtension(mockPrisma);
    const op = extension.query.order.$allOperations;
    
    const result = await op({ args: { where: { id: 1 } }, query: mockQuery });
    
    expect(result).toBe('query-result');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith('SET LOCAL ROLE app_user');
    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('should use bypass config when bypass is active', async () => {
    vi.mocked(resolveActiveTenantId).mockResolvedValue('flux');
    vi.mocked(isTenantBypassActive).mockReturnValue(true);

    const extension = createTenantEnforcerExtension(mockPrisma);
    const op = extension.query.order.$allOperations;
    
    const result = await op({ args: {}, query: mockQuery });
    
    expect(result).toBe('query-result');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith('SET LOCAL ROLE app_user');
    expect(mockPrisma.$executeRaw).toHaveBeenCalled(); // bypass
  });

  it('should only set app_user when no tenant context exists', async () => {
    vi.mocked(resolveActiveTenantId).mockResolvedValue(null);
    vi.mocked(isTenantBypassActive).mockReturnValue(false);

    const extension = createTenantEnforcerExtension(mockPrisma);
    const op = extension.query.order.$allOperations;
    
    const result = await op({ args: {}, query: mockQuery });
    
    expect(result).toBe('query-result');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith('SET LOCAL ROLE app_user');
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });
});
