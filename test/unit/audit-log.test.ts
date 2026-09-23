/**
 * QA-1: Backend QA Engineer
 * Test Suite: Admin Audit Logging (D-1)
 * Standards: TOGAF Data Flow Control, OWASP A09 (Security Logging)
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminCatalogService } from '@/services/admin/catalog.service';
import { db } from '@/lib/db';
import { auditAdmin } from '@/lib/admin-audit';

vi.mock('@/lib/admin-audit', () => {
    return {
        auditAdmin: vi.fn(),
    }
});

// Since the service already implements AdminAuditLog globally via lib/admin-audit
// We test that updateMarkup correctly fires the audit function.
describe('Admin Audit Trail (D-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-AUDIT-001: Changing service markup triggers audit log record', async () => {
    // Mock db.service.findUniqueOrThrow & update
    vi.spyOn(db.service, 'findUniqueOrThrow').mockResolvedValue({
      id: 'srv_1',
      markup: 2.0,
      name: 'Test Service',
    } as any);

    vi.spyOn(db.service, 'update').mockResolvedValue({} as any);

    const adminContext = { id: 'admin-123', email: 'admin@example.com' };
    
    await adminCatalogService.updateMarkup('srv_1', 3.5, adminContext);

    // Verify Audit Admin was called
    expect(auditAdmin).toHaveBeenCalledTimes(1);
    expect(auditAdmin).toHaveBeenCalledWith(expect.objectContaining({
      adminId: 'admin-123',
      action: 'SERVICE_MARKUP_CHANGE',
      target: 'srv_1',
      targetType: 'SERVICE',
      oldValue: { markup: 2.0 },
      newValue: { markup: 3.5 }
    }));
  });
});
