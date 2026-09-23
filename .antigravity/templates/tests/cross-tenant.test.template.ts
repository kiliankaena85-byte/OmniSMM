import { describe, it, expect } from 'vitest';
import { assertSameTenant } from '@/lib/tenant-scope';

describe('Cross-Tenant Test Template', () => {
  it('blocks cross-tenant access when tenantId mismatches', () => {
    const session = { tenantId: 'tenant-A' };
    const entity = { tenantId: 'tenant-B' };
    expect(() => assertSameTenant(session, entity)).toThrow('SECURITY_TENANT_MISMATCH');
  });
});
