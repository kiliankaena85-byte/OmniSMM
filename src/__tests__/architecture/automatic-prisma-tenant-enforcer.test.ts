import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
  createTenantEnforcerExtension,
  type TenantContextResolver,
  type PrismaBatchTransactionClient,
} from '../../lib/prisma-tenant-enforcer';

describe('Automatic Prisma Tenant Enforcer (RLS 2026)', () => {
  let mockPrisma: PrismaBatchTransactionClient;
  let mockTransactionFn: Mock<(arr: PromiseLike<unknown>[]) => Promise<unknown[]>>;
  let mockExecuteRawUnsafeFn: Mock<(query: string) => Promise<unknown>>;
  let mockExecuteRawFn: Mock<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>>;
  let mockQueryFn: Mock<(args: Record<string, unknown>) => Promise<unknown>>;
  let mockContext: TenantContextResolver;
  let mockResolveActiveTenantId: Mock<() => Promise<string | null>>;
  let mockIsTenantBypassActive: Mock<() => boolean>;
  let mockIsInTransactionContext: Mock<() => boolean>;

  beforeEach(() => {
    mockQueryFn = vi.fn(async (_args: Record<string, unknown>) => 'query-result');

    mockTransactionFn = vi.fn(async (arr: PromiseLike<unknown>[]) => Promise.all(arr));
    mockExecuteRawUnsafeFn = vi.fn(async (_query: string) => 'raw-unsafe-result');
    mockExecuteRawFn = vi.fn(async (_strings: TemplateStringsArray, ..._values: unknown[]) => 'raw-result');

    mockPrisma = {
      $transaction: <T>(arr: PromiseLike<unknown>[]) => mockTransactionFn(arr) as Promise<T[]>,
      $executeRawUnsafe: (query: string) => mockExecuteRawUnsafeFn(query),
      $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => mockExecuteRawFn(strings, ...values),
    };

    mockResolveActiveTenantId = vi.fn(async () => null as string | null);
    mockIsTenantBypassActive = vi.fn(() => false);
    mockIsInTransactionContext = vi.fn(() => false);

    mockContext = {
      resolveActiveTenantId: () => mockResolveActiveTenantId(),
      isTenantBypassActive: () => mockIsTenantBypassActive(),
      isInTransactionContext: () => mockIsInTransactionContext(),
    };
  });

  it('should inject SET LOCAL ROLE app_user and set_config when tenant is active', async () => {
    mockResolveActiveTenantId.mockResolvedValue('flux');
    mockIsTenantBypassActive.mockReturnValue(false);

    const extension = createTenantEnforcerExtension(mockPrisma, mockContext);
    const op = extension.query.order.$allOperations;
    
    const result = await op({ args: { where: { id: 1 } }, query: (args) => mockQueryFn(args) });
    
    expect(result).toBe('query-result');
    expect(mockTransactionFn).toHaveBeenCalledTimes(1);
    expect(mockExecuteRawUnsafeFn).toHaveBeenCalledWith('SET LOCAL ROLE app_user');
    expect(mockExecuteRawFn).toHaveBeenCalled();
    expect(mockQueryFn).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('should use bypass config when bypass is active', async () => {
    mockResolveActiveTenantId.mockResolvedValue('flux');
    mockIsTenantBypassActive.mockReturnValue(true);

    const extension = createTenantEnforcerExtension(mockPrisma, mockContext);
    const op = extension.query.order.$allOperations;
    
    const result = await op({ args: {}, query: (args) => mockQueryFn(args) });
    
    expect(result).toBe('query-result');
    expect(mockTransactionFn).toHaveBeenCalledTimes(1);
    expect(mockExecuteRawUnsafeFn).toHaveBeenCalledWith('SET LOCAL ROLE app_user');
    expect(mockExecuteRawFn).toHaveBeenCalled(); // bypass
  });

  it('should only set app_user when no tenant context exists', async () => {
    mockResolveActiveTenantId.mockResolvedValue(null);
    mockIsTenantBypassActive.mockReturnValue(false);

    const extension = createTenantEnforcerExtension(mockPrisma, mockContext);
    const op = extension.query.order.$allOperations;
    
    const result = await op({ args: {}, query: (args) => mockQueryFn(args) });
    
    expect(result).toBe('query-result');
    expect(mockTransactionFn).toHaveBeenCalledTimes(1);
    expect(mockExecuteRawUnsafeFn).toHaveBeenCalledWith('SET LOCAL ROLE app_user');
    expect(mockExecuteRawFn).not.toHaveBeenCalled();
  });

  it('should bypass extra transaction when isInTransactionContext is active', async () => {
    mockIsInTransactionContext.mockReturnValue(true);

    const extension = createTenantEnforcerExtension(mockPrisma, mockContext);
    const op = extension.query.order.$allOperations;
    
    const result = await op({ args: { where: { id: 123 } }, query: (args) => mockQueryFn(args) });
    
    expect(result).toBe('query-result');
    expect(mockTransactionFn).not.toHaveBeenCalled();
    expect(mockQueryFn).toHaveBeenCalledWith({ where: { id: 123 } });
  });
});
