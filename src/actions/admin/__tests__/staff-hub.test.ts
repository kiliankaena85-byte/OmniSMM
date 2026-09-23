import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { 
  getStaffMembersWithMetrics, 
  getStaffPersonalLogsAction, 
  updateStaffMemberAction 
} from '../staff';
import { verifySession } from '@/lib/session';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
  decryptSessionToken: vi.fn(),
  encryptSessionToken: vi.fn(),
}));

describe('👥 Staff Hub & Audit Analytics Server Actions', () => {
  let testAdminId: string;
  let testSupportId: string;

  beforeEach(async () => {
    // Create admin and support user
    const admin = await db.user.create({
      data: {
        email: `staff_lead_${Date.now()}@smmplan.pro`,
        role: 'OWNER',
        balance: BigInt(0),
        tenantId: 'smmplan',
      },
    });
    testAdminId = admin.id;

    vi.mocked(verifySession).mockResolvedValue({
      userId: testAdminId,
      email: admin.email,
      role: 'OWNER',
      tenantId: 'smmplan',
    } as any);

    const support = await db.user.create({
      data: {
        email: `support_agent_${Date.now()}@smmplan.pro`,
        role: 'SUPPORT',
        supportLimitCents: 500000, // 5000 RUB
        balance: BigInt(0),
        tenantId: 'smmplan',
      },
    });
    testSupportId = support.id;

    // Seed some audit actions for today
    await db.adminAuditLog.create({
      data: {
        adminId: testSupportId,
        adminEmail: support.email,
        action: 'REPLY_TICKET',
        target: '101',
        targetType: 'TICKET',
        createdAt: new Date(),
      },
    });

    await db.adminAuditLog.create({
      data: {
        adminId: testSupportId,
        adminEmail: support.email,
        action: 'REFILL_ORDER',
        target: '202',
        targetType: 'ORDER',
        createdAt: new Date(),
      },
    });
  });

  it('1. Fetches staff metrics with 24-hour activity distribution', async () => {
    const res = await getStaffMembersWithMetrics();
    expect(res.success).toBe(true);
    if (!res.success) return;

    const supportUser = res.data.find((s) => s.id === testSupportId);
    expect(supportUser).toBeDefined();
    expect(supportUser?.role).toBe('SUPPORT');
    expect(supportUser?.totalActionsToday).toBeGreaterThanOrEqual(2);
    expect(supportUser?.activityHours).toHaveLength(24);
    expect(supportUser?.ticketsRepliedToday).toBeGreaterThanOrEqual(1);
  });

  it('2. Formats personal audit logs into human-readable Russian language', async () => {
    const res = await getStaffPersonalLogsAction(testSupportId);
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.logs.length).toBeGreaterThanOrEqual(2);
    const replyLog = res.logs.find((l) => l.action === 'REPLY_TICKET');
    expect(replyLog).toBeDefined();
    expect(replyLog?.actionTitle).toContain('Ответ на тикет #101');
    expect(replyLog?.actionDescription).toContain('Сотрудник отправил сообщение');
    expect(replyLog?.iconType).toBe('ticket');

    const refillLog = res.logs.find((l) => l.action === 'REFILL_ORDER');
    expect(refillLog).toBeDefined();
    expect(refillLog?.actionTitle).toContain('Гарантийный докрут (Refill) #202');
  });

  it('3. Updates staff role and support trust limit', async () => {
    const updateRes = await updateStaffMemberAction({
      userId: testSupportId,
      role: 'MANAGER',
      supportLimitRubles: 7500,
    });

    expect(updateRes.success).toBe(true);

    const updatedUser = await db.user.findUnique({ where: { id: testSupportId } });
    expect(updatedUser?.role).toBe('MANAGER');
    expect(updatedUser?.supportLimitCents).toBe(750000); // 7500 RUB * 100 cents
  });
});
