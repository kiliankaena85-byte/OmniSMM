import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { 
  assignShiftAction, 
  swapShiftAction, 
  requestTimeOffAction, 
  getAvailableSubstitutesAction 
} from '@/actions/admin/shifts';
import { verifySession } from '@/lib/session';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
  decryptSessionToken: vi.fn(),
  encryptSessionToken: vi.fn(),
}));

describe('🛡️ Staff Shifts Poka-Yoke & Collision Prevention Premortem Tests', () => {
  let adminUser: { id: string; email: string };
  let supportA: { id: string; email: string };
  let supportB: { id: string; email: string };
  let supportC: { id: string; email: string };

  beforeEach(async () => {
    // 1. Admin
    const admin = await db.user.create({
      data: {
        email: `collision_lead_${Date.now()}@smmplan.pro`,
        role: 'OWNER',
        balance: BigInt(0),
        tenantId: 'smmplan',
      },
    });
    adminUser = { id: admin.id, email: admin.email };

    vi.mocked(verifySession).mockResolvedValue({
      userId: adminUser.id,
      email: adminUser.email,
      role: 'OWNER',
      tenantId: 'smmplan',
    } as any);

    // 2. Support A, B, C
    const userA = await db.user.create({
      data: {
        email: `support_a_${Date.now()}@smmplan.pro`,
        role: 'SUPPORT',
        balance: BigInt(0),
        tenantId: 'smmplan',
      },
    });
    supportA = { id: userA.id, email: userA.email };

    const userB = await db.user.create({
      data: {
        email: `support_b_${Date.now()}@smmplan.pro`,
        role: 'SUPPORT',
        balance: BigInt(0),
        tenantId: 'smmplan',
      },
    });
    supportB = { id: userB.id, email: userB.email };

    const userC = await db.user.create({
      data: {
        email: `support_c_${Date.now()}@smmplan.pro`,
        role: 'SUPPORT',
        balance: BigInt(0),
        tenantId: 'smmplan',
      },
    });
    supportC = { id: userC.id, email: userC.email };
  });

  it('Scenario 1: Prevents double shift collision (substitute already has a shift in the same slot)', async () => {
    // Assign Day shift to Support A on 2026-09-10
    const shiftARes = await assignShiftAction({
      userId: supportA.id,
      dateStr: '2026-09-10',
      shiftType: 'DAY',
      status: 'PLANNED',
      rateRubles: 2500,
    });
    expect(shiftARes.success).toBe(true);
    const shiftAObj = (shiftARes as any).shift;

    // Assign Day shift to Support B on the same date 2026-09-10
    const shiftBRes = await assignShiftAction({
      userId: supportB.id,
      dateStr: '2026-09-10',
      shiftType: 'DAY',
      status: 'PLANNED',
      rateRubles: 2500,
    });
    expect(shiftBRes.success).toBe(true);

    // Support A tries to swap shift with Support B on 2026-09-10 -> MUST BE BLOCKED
    const swapRes = await swapShiftAction({
      shiftId: shiftAObj.id,
      substituteUserId: supportB.id,
      substituteHours: 0,
      notes: 'Попытка подмены на уже занятого сотрудника',
    });

    expect(swapRes.success).toBe(false);
    expect(swapRes.error).toContain('Коллега уже назначен на смену в этот же временной слот');
  });

  it('Scenario 2: Prevents phantom substitute collision (substitute is on vacation/sick)', async () => {
    // Assign Day shift to Support A on 2026-09-15
    const shiftARes = await assignShiftAction({
      userId: supportA.id,
      dateStr: '2026-09-15',
      shiftType: 'DAY',
      status: 'PLANNED',
      rateRubles: 2500,
    });
    expect(shiftARes.success).toBe(true);
    const shiftAObj = (shiftARes as any).shift;

    // Support C takes vacation covering 2026-09-15
    const timeOffRes = await requestTimeOffAction({
      userId: supportC.id,
      dateFromStr: '2026-09-14',
      dateToStr: '2026-09-18',
      status: 'VACATION',
      notes: 'Ежегодный отпуск',
    });
    expect(timeOffRes.success).toBe(true);

    // Support A tries to transfer shift to Support C during vacation -> MUST BE BLOCKED
    const swapRes = await swapShiftAction({
      shiftId: shiftAObj.id,
      substituteUserId: supportC.id,
      substituteHours: 0,
      notes: 'Попытка передать смену отпускнику',
    });

    expect(swapRes.success).toBe(false);
    expect(swapRes.error).toContain('Коллега недоступен в этот день (в отпуске)');
  });

  it('Scenario 3: Atomic Reciprocal 2-Way Swap ("Я за тебя во вторник, ты за меня в четверг")', async () => {
    // 1. Support A has shift on 2026-09-15 (Tuesday)
    const shiftARes = await assignShiftAction({
      userId: supportA.id,
      dateStr: '2026-09-15',
      shiftType: 'DAY',
      status: 'PLANNED',
      rateRubles: 2500,
    });
    const shiftA = (shiftARes as any).shift;

    // 2. Support B has shift on 2026-09-17 (Thursday)
    const shiftBRes = await assignShiftAction({
      userId: supportB.id,
      dateStr: '2026-09-17',
      shiftType: 'DAY',
      status: 'PLANNED',
      rateRubles: 2500,
    });
    const shiftB = (shiftBRes as any).shift;

    // 3. Execute 2-way reciprocal exchange
    const swapRes = await swapShiftAction({
      shiftId: shiftA.id,
      substituteUserId: supportB.id,
      reciprocalShiftId: shiftB.id,
      substituteHours: 0,
      notes: 'Взаимный обмен: вторник на четверг',
    });

    expect(swapRes.success).toBe(true);

    // Verify both shifts were updated in atomic transaction
    const updatedA = await db.staffShift.findUnique({ where: { id: shiftA.id } });
    const updatedB = await db.staffShift.findUnique({ where: { id: shiftB.id } });

    expect(updatedA?.status).toBe('SWAPPED');
    expect(updatedA?.substituteUserId).toBe(supportB.id);

    expect(updatedB?.status).toBe('SWAPPED');
    expect(updatedB?.substituteUserId).toBe(supportA.id);
  });

  it('Scenario 4: Vacation Overwrite Protection (frees scheduled work shifts and reports count)', async () => {
    // Assign 2 planned shifts to Support A
    await assignShiftAction({
      userId: supportA.id,
      dateStr: '2026-09-20',
      shiftType: 'DAY',
      status: 'PLANNED',
      rateRubles: 2500,
    });
    await assignShiftAction({
      userId: supportA.id,
      dateStr: '2026-09-22',
      shiftType: 'DAY',
      status: 'PLANNED',
      rateRubles: 2500,
    });

    // Request vacation covering 2026-09-19 to 2026-09-23
    const timeOffRes = await requestTimeOffAction({
      userId: supportA.id,
      dateFromStr: '2026-09-19',
      dateToStr: '2026-09-23',
      status: 'VACATION',
      notes: 'Отпуск',
    });

    expect(timeOffRes.success).toBe(true);
    expect((timeOffRes as any).daysCount).toBe(5);
    expect((timeOffRes as any).freedWorkShifts).toBe(2); // Automatically detected and freed 2 planned shifts
  });

  it('Scenario 5: Availability evaluation accurately flags free, busy, and on-vacation staff', async () => {
    // 1. Shift on 2026-09-25 for Support A
    const shiftARes = await assignShiftAction({
      userId: supportA.id,
      dateStr: '2026-09-25',
      shiftType: 'DAY',
      status: 'PLANNED',
      rateRubles: 2500,
    });
    const shiftA = (shiftARes as any).shift;

    // Support B is on vacation on 2026-09-25
    await requestTimeOffAction({
      userId: supportB.id,
      dateFromStr: '2026-09-24',
      dateToStr: '2026-09-26',
      status: 'VACATION',
    });

    // Support C is completely free on 2026-09-25
    const availRes = await getAvailableSubstitutesAction(shiftA.id);
    expect(availRes.success).toBe(true);

    const candidates = (availRes as any).candidates as Array<{ id: string; isAvailable: boolean; statusBadge: string }>;
    const candB = candidates?.find(c => c.id === supportB.id);
    const candC = candidates?.find(c => c.id === supportC.id);

    expect(candB?.isAvailable).toBe(false);
    expect(candB?.statusBadge).toBe('VACATION');

    expect(candC?.isAvailable).toBe(true);
    expect(candC?.statusBadge).toBe('FREE');
  });
});
