import { describe, it, expect } from 'vitest';
import { resolveOrderOrderBy } from '@/services/admin/order.service';

describe('Admin Orders Sorting Suite (ASC / DESC Invariants)', () => {
  it('defaults to { createdAt: "desc" } when no sorting params are supplied', () => {
    const orderBy = resolveOrderOrderBy(undefined, undefined);
    expect(orderBy).toEqual({ createdAt: 'desc' });
  });

  it('correctly maps top-level direct fields with asc and desc directions', () => {
    expect(resolveOrderOrderBy('numericId', 'asc')).toEqual({ numericId: 'asc' });
    expect(resolveOrderOrderBy('numericId', 'desc')).toEqual({ numericId: 'desc' });

    expect(resolveOrderOrderBy('charge', 'asc')).toEqual({ charge: 'asc' });
    expect(resolveOrderOrderBy('charge', 'desc')).toEqual({ charge: 'desc' });

    expect(resolveOrderOrderBy('status', 'asc')).toEqual({ status: 'asc' });
    expect(resolveOrderOrderBy('status', 'desc')).toEqual({ status: 'desc' });

    expect(resolveOrderOrderBy('createdAt', 'asc')).toEqual({ createdAt: 'asc' });
    expect(resolveOrderOrderBy('createdAt', 'desc')).toEqual({ createdAt: 'desc' });
  });

  it('correctly maps client/user sorting to relation user.email', () => {
    expect(resolveOrderOrderBy('client', 'asc')).toEqual({ user: { email: 'asc' } });
    expect(resolveOrderOrderBy('client', 'desc')).toEqual({ user: { email: 'desc' } });
    expect(resolveOrderOrderBy('user', 'asc')).toEqual({ user: { email: 'asc' } });
    expect(resolveOrderOrderBy('email', 'desc')).toEqual({ user: { email: 'desc' } });
  });

  it('safely rejects unsupported / arbitrary fields and falls back to default { createdAt: "desc" }', () => {
    expect(resolveOrderOrderBy('dangerous_sql_injection', 'desc')).toEqual({ createdAt: 'desc' });
    expect(resolveOrderOrderBy('passwordHash', 'asc')).toEqual({ createdAt: 'desc' });
  });

  it('defaults direction to "desc" if invalid order direction is provided', () => {
    expect(resolveOrderOrderBy('numericId', 'invalid' as any)).toEqual({ numericId: 'desc' });
  });
});
