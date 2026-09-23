import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { 
  assignShiftAction, 
  swapShiftAction, 
  applyShiftTemplateAction, 
  getMonthlyPayrollAction, 
  getMonthShiftsAction 
} from '../shifts';
import { verifySession } from '@/lib/session';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
  decryptSessionToken: vi.fn(),
  encryptSessionToken: vi.fn(),
}));

describe('📅 Staff Shifts, Swaps & Monthly Payroll Server Actions', () => {
  let adminUser: { id: string; email: string };
  let supportA: { id: string; email: string };
  let supportB: { id: string; email: string };

  const currentYear = 2026;
  const currentMonth = 8; // August

  beforeEach(async () => {
    // 1. Create Admin
    const admin = await db.user.create({
      data: {
        email: `shift_lead_${Date.now()}@smmplan.pro`,
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

    // 2. Create Support A & B
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
  });

  it('1. Assigns a planned day shift and vacation for a staff member', async () => {
    const shiftRes = await assignShiftAction({
      userId: supportA.id,
      dateStr: '2026-08-10',
      shiftType: 'DAY',
      status: 'PLANNED',
      rateRubles: 2500,
    });
    expect(shiftRes.success).toBe(true);

    const vacRes = await assignShiftAction({
      userId: supportA.id,
      dateStr: '2026-08-15',
      shiftType: 'DAY',
      status: 'VACATION',
      rateRubles: 0,
    });
    expect(vacRes.success).toBe(true);

    const monthRes = await getMonthShiftsAction(currentYear, currentMonth);
    expect(monthRes.success).toBe(true);
    if (!monthRes.success) return;

    const rowA = monthRes.rows.find((r) => r.userId === supportA.id);
    expect(rowA).toBeDefined();
    expect(rowA?.shifts[10]?.shiftType).toBe('DAY');
    expect(rowA?.shifts[10]?.status).toBe('PLANNED');
    expect(rowA?.shifts[15]?.status).toBe('VACATION');
  });

  it('2. Records a shift swap from Support A to Support B', async () => {
    // Create shift for A
    const shiftRes = await assignShiftAction({
      userId: supportA.id,
      dateStr: '2026-08-20',
      shiftType: 'DAY',
      status: 'PLANNED',
      rateRubles: 3000,
    });
    expect(shiftRes.success).toBe(true);
    if (!shiftRes.success) return;

    // Swap to Support B
    const swapRes = await swapShiftAction({
      shiftId: shiftRes.shift.id,
      substituteUserId: supportB.id,
      notes: 'Заболел, попросил подменить',
    });
    expect(swapRes.success).toBe(true);

    const updated = await db.staffShift.findUnique({
      where: { id: shiftRes.shift.id },
    });
    expect(updated?.status).toBe('SWAPPED');
    expect(updated?.substituteUserId).toBe(supportB.id);
  });

  it('3. Applies a 2/2 shift template for the entire month', async () => {
    const templateRes = await applyShiftTemplateAction({
      userId: supportB.id,
      year: currentYear,
      month: currentMonth,
      templateType: '2_2_DAY',
      startDay: 1,
      rateRubles: 2500,
    });
    expect(templateRes.success).toBe(true);
    if (!templateRes.success) return;

    expect(templateRes.createdCount).toBeGreaterThanOrEqual(14);

    const monthRes = await getMonthShiftsAction(currentYear, currentMonth);
    expect(monthRes.success).toBe(true);
    if (!monthRes.success) return;

    const rowB = monthRes.rows.find((r) => r.userId === supportB.id);
    expect(rowB?.plannedShiftsCount).toBeGreaterThanOrEqual(14);
  });

  it('4. Calculates monthly payroll accounting for completed shifts and swaps', async () => {
    // 1 shift worked by A (2500 RUB)
    await assignShiftAction({
      userId: supportA.id,
      dateStr: '2026-08-01',
      shiftType: 'DAY',
      status: 'PLANNED',
      rateRubles: 2500,
    });

    // 1 shift of A swapped to B (3000 RUB -> goes to B)
    const shift2 = await assignShiftAction({
      userId: supportA.id,
      dateStr: '2026-08-02',
      shiftType: 'DAY',
      status: 'PLANNED',
      rateRubles: 3000,
    });
    if (shift2.success) {
      await swapShiftAction({
        shiftId: shift2.shift.id,
        substituteUserId: supportB.id,
        notes: 'Подмена',
      });
    }

    const payrollRes = await getMonthlyPayrollAction(currentYear, currentMonth);
    expect(payrollRes.success).toBe(true);
    if (!payrollRes.success) return;

    const payA = payrollRes.rows.find((r) => r.userId === supportA.id);
    const payB = payrollRes.rows.find((r) => r.userId === supportB.id);

    // Support A worked 1 own shift = 2500 RUB (the swapped one went to B)
    expect(payA?.baseSalaryRubles).toBe(2500);
    expect(payA?.substitutionsTaken).toBe(1);

    // Support B covered 1 shift for A = 3000 RUB
    expect(payB?.substitutionsGiven).toBe(1);
    expect(payB?.baseSalaryRubles).toBe(3000);
  });

  it('5. Handles partial hourly cover within a day (e.g. 3 hours out of 12h)', async () => {
    // Shift on 2026-08-05 for Support A (2400 RUB = 200 RUB/hour)
    const shift = await assignShiftAction({
      userId: supportA.id,
      dateStr: '2026-08-05',
      shiftType: 'DAY',
      status: 'PLANNED',
      rateRubles: 2400,
    });
    expect(shift.success).toBe(true);
    if (!shift.success) return;

    // Support B covers 3 hours for A (3 * 200 = 600 RUB to B, 1800 RUB stays with A)
    const swap = await swapShiftAction({
      shiftId: shift.shift.id,
      substituteUserId: supportB.id,
      substituteHours: 3,
      notes: 'Подменил 3 часа с 14:00 до 17:00 по договоренности',
    });
    expect(swap.success).toBe(true);

    const payrollRes = await getMonthlyPayrollAction(currentYear, currentMonth);
    expect(payrollRes.success).toBe(true);
    if (!payrollRes.success) return;

    const payA = payrollRes.rows.find((r) => r.userId === supportA.id);
    const payB = payrollRes.rows.find((r) => r.userId === supportB.id);

    // A retains 1800 RUB for remaining 9 hours
    expect(payA?.baseSalaryRubles).toBe(1800);
    // B receives 600 RUB for 3 hours worked
    expect(payB?.baseSalaryRubles).toBe(600);
  });
});
