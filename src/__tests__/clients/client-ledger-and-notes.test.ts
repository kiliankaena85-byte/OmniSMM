import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn(async (_section, _perm, callback) => {
    return callback({ id: 'staff_1', email: 'support@smmplan.pro', role: 'SUPPORT' }, 'SUPPORT', 'smmplan');
  }),
  requireAdmin: vi.fn(async (callback) => {
    return callback({ id: 'admin_1', email: 'admin@smmplan.pro', role: 'ADMIN' }, 'ADMIN', 'smmplan');
  }),
}));

import { 
  supportGoodwillCreditAction,
  clearClientNoteAction,
  createClientNoteAction,
  deleteClientNoteAction,
  editClientNoteAction,
  getClientNotesAction
} from '@/actions/admin/clients';
import { 
  SUPPORT_CREDIT_REASONS, 
  SUPPORT_DEBIT_REASONS 
} from '@/lib/constants/support-reasons';

describe('Client CRM, Ledger & Poka-Yoke Invariants', () => {
  it('should verify that CREDIT and DEBIT reasons are strictly segregated without overlap', () => {
    expect(SUPPORT_CREDIT_REASONS.length).toBeGreaterThanOrEqual(5);
    expect(SUPPORT_DEBIT_REASONS.length).toBeGreaterThanOrEqual(4);

    // No compensation/bonus/goodwill reasons in DEBIT
    for (const debitReason of SUPPORT_DEBIT_REASONS) {
      const lower = debitReason.toLowerCase();
      expect(lower.includes('компенсация')).toBe(false);
      expect(lower.includes('бонус')).toBe(false);
      expect(lower.includes('доброй воли')).toBe(false);
    }

    // All compensation reasons must belong to CREDIT
    const hasDelayCompensation = SUPPORT_CREDIT_REASONS.some(r => r.includes('задержку'));
    const hasProviderError = SUPPORT_CREDIT_REASONS.some(r => r.includes('провайдера'));
    expect(hasDelayCompensation).toBe(true);
    expect(hasProviderError).toBe(true);
  });

  it('should reject DEBIT operations containing compensation or bonus in reason (Server Poka-Yoke)', async () => {
    const formData = new FormData();
    formData.set('userId', 'user_test_123');
    formData.set('amount', '3000');
    formData.set('direction', 'DEBIT');
    formData.set('reason', 'Компенсация за задержку заказа');

    const result = await supportGoodwillCreditAction(formData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Недопустимая причина для списания');
    }
  });

  it('should validate empty content in createClientNoteAction', async () => {
    const res = await createClientNoteAction('user_123', '   ');
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('не может быть пустым');
    }
  });

  it('should cleanly migrate legacy-note to UserNote on edit without 500 error', async () => {
    const { db } = await import('@/lib/db');
    const timestamp = Date.now() + Math.random().toString(36).slice(2, 6);
    const testClient = await db.user.create({
      data: {
        email: `legacy_client_${timestamp}@smmplan.local`,
        role: 'USER',
        isActive: true,
        adminNote: 'Старая текстовая заметка из V1',
      }
    });

    try {
      const res = await editClientNoteAction('legacy-note', testClient.id, 'Обновленная заметка из V2');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.note.content).toBe('Обновленная заметка из V2');
        expect(res.note.id).not.toBe('legacy-note'); // Generated real CUID
      }

      // Check DB sync
      const checkUser = await db.user.findUniqueOrThrow({ where: { id: testClient.id } });
      expect(checkUser.adminNote).toBe('Обновленная заметка из V2');

      const userNotes = await db.userNote.findMany({ where: { userId: testClient.id } });
      expect(userNotes.length).toBe(1);
      expect(userNotes[0].content).toBe('Обновленная заметка из V2');
    } finally {
      await db.userNote.deleteMany({ where: { userId: testClient.id } });
      await db.user.deleteMany({ where: { id: testClient.id } });
    }
  });

  it('should cleanly delete legacy-note without 500 error and clear User.adminNote', async () => {
    const { db } = await import('@/lib/db');
    const timestamp = Date.now() + Math.random().toString(36).slice(2, 6);
    const testClient = await db.user.create({
      data: {
        email: `legacy_del_${timestamp}@smmplan.local`,
        role: 'USER',
        isActive: true,
        adminNote: 'Заметка под удаление',
      }
    });

    try {
      const res = await deleteClientNoteAction('legacy-note', testClient.id);
      expect(res.success).toBe(true);

      const checkUser = await db.user.findUniqueOrThrow({ where: { id: testClient.id } });
      expect(checkUser.adminNote).toBeNull();
    } finally {
      await db.user.deleteMany({ where: { id: testClient.id } });
    }
  });

  it('should allow SUPPORT role to update client discount via updateClientDiscountAction', async () => {
    const { updateClientDiscountAction } = await import('@/actions/admin/clients');
    const { db } = await import('@/lib/db');
    const timestamp = Date.now() + Math.random().toString(36).slice(2, 6);
    const testClient = await db.user.create({
      data: {
        email: `discount_client_${timestamp}@smmplan.local`,
        role: 'USER',
        isActive: true,
        personalDiscount: 0,
      }
    });

    try {
      const res = await updateClientDiscountAction(testClient.id, 15);
      expect(res.success).toBe(true);

      const checkUser = await db.user.findUniqueOrThrow({ where: { id: testClient.id } });
      expect(checkUser.personalDiscount).toBe(15);
    } finally {
      await db.user.deleteMany({ where: { id: testClient.id } });
    }
  });
});
