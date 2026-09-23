'use server';

import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // ignore outside Next.js request context (e.g. in vitest runner)
  }
}

export interface ShiftInfo {
  id: string;
  userId: string;
  userEmail: string;
  dateStr: string; // YYYY-MM-DD
  dayNumber: number; // 1..31
  shiftType: string; // 'DAY', 'NIGHT', 'CUSTOM'
  status: string; // 'PLANNED', 'COMPLETED', 'SWAPPED', 'VACATION', 'SICK', 'DAY_OFF'
  substituteUserId?: string | null;
  substituteUserEmail?: string | null;
  substituteHours?: number; // 0 = вся смена, >0 = часы подмены
  rateRubles: number;
  bonusRubles: number;
  penaltyRubles: number;
  notes?: string | null;
}

export interface StaffScheduleRow {
  userId: string;
  userEmail: string;
  role: string;
  shifts: Record<number, ShiftInfo>; // Day 1..31 -> ShiftInfo
  plannedShiftsCount: number;
  actualWorkedCount: number;
  swappedCount: number;
  vacationDaysCount: number;
  sickDaysCount: number;
}

export interface StaffMemberOption {
  id: string;
  email: string;
  role: string;
}

export interface AvailableSubstituteDTO {
  id: string;
  email: string;
  role: string;
  isAvailable: boolean;
  statusBadge: 'FREE' | 'BUSY_SAME_SLOT' | 'BUSY_OTHER_SLOT' | 'VACATION' | 'SICK';
  statusText: string;
  availableReciprocalShifts: Array<{
    id: string;
    dateStr: string;
    dayNumber: number;
    shiftType: string;
  }>;
}

export interface PayrollRow {
  userId: string;
  userEmail: string;
  role: string;
  plannedShifts: number;
  actualShifts: number;
  substitutionsGiven: number; // сколько раз подменил других (+)
  substitutionsTaken: number; // сколько раз его подменили (-)
  vacationDays: number;
  sickDays: number;
  ticketsHandled: number;
  baseSalaryRubles: number;
  bonusRubles: number;
  penaltyRubles: number;
  netPayoutRubles: number;
}

/**
 * Fetches the entire staff schedule matrix for a given month,
 * including caller context for personalized views.
 */
export async function getMonthShiftsAction(year: number, month: number) {
  return requireStaffPermission('staff', 'view', async (admin) => {
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const daysInMonth = new Date(year, month, 0).getDate();
    const tenantFilter = admin.tenantId ? { tenantId: admin.tenantId } : {};

    const staffUsers = await db.user.findMany({
      where: {
        OR: [
          { role: { in: ['SUPPORT', 'MANAGER', 'ADMIN', 'OWNER'] } },
          { staffRoleId: { not: null } },
        ],
        ...tenantFilter
      },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    });

    const staffIds = staffUsers.map((u) => u.id);

    const shifts = await db.staffShift.findMany({
      where: {
        OR: [
          { userId: { in: staffIds } },
          { substituteUserId: { in: staffIds } },
        ],
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        user: { select: { email: true } },
        substituteUser: { select: { email: true } },
      },
      orderBy: { date: 'asc' },
    });

    const scheduleRows: StaffScheduleRow[] = staffUsers.map((staff) => {
      const userShifts = shifts.filter((s) => s.userId === staff.id);
      const shiftsMap: Record<number, ShiftInfo> = {};

      let plannedCount = 0;
      let actualCount = 0;
      let swappedCount = 0;
      let vacationCount = 0;
      let sickCount = 0;

      userShifts.forEach((s) => {
        const day = new Date(s.date).getUTCDate();
        shiftsMap[day] = {
          id: s.id,
          userId: s.userId,
          userEmail: s.user.email,
          dateStr: s.date.toISOString().split('T')[0],
          dayNumber: day,
          shiftType: s.shiftType,
          status: s.status,
          substituteUserId: s.substituteUserId,
          substituteUserEmail: s.substituteUser?.email,
          substituteHours: s.substituteHours || 0,
          rateRubles: s.rateRubles,
          bonusRubles: s.bonusRubles,
          penaltyRubles: s.penaltyRubles,
          notes: s.notes,
        };

        if (['PLANNED', 'COMPLETED'].includes(s.status)) {
          plannedCount++;
          if (s.status === 'COMPLETED' || !s.substituteUserId || s.substituteHours > 0) {
            actualCount++;
          }
        }
        if (s.status === 'SWAPPED') {
          swappedCount++;
          if (s.substituteHours > 0) {
            actualCount++;
          }
        }
        if (s.status === 'VACATION') {
          vacationCount++;
        }
        if (s.status === 'SICK') {
          sickCount++;
        }
      });

      return {
        userId: staff.id,
        userEmail: staff.email,
        role: staff.role,
        shifts: shiftsMap,
        plannedShiftsCount: plannedCount,
        actualWorkedCount: actualCount,
        swappedCount,
        vacationDaysCount: vacationCount,
        sickDaysCount: sickCount,
      };
    });

    const staffOptions: StaffMemberOption[] = staffUsers.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
    }));

    return {
      success: true as const,
      daysInMonth,
      year,
      month,
      currentUserId: admin.id,
      currentUserRole: admin.role,
      staffList: staffOptions,
      rows: scheduleRows,
    };
  });
}

const assignShiftSchema = z.object({
  userId: z.string().min(1),
  dateStr: z.string().min(10), // YYYY-MM-DD
  shiftType: z.enum(['DAY', 'NIGHT', 'CUSTOM']),
  status: z.enum(['PLANNED', 'COMPLETED', 'SWAPPED', 'VACATION', 'SICK', 'DAY_OFF']),
  rateRubles: z.number().min(0).max(100000).default(2500),
  notes: z.string().optional(),
});

/**
 * Assigns or updates a single shift for a staff member.
 * Includes Poka-Yoke collision checks against existing shifts and time off.
 */
export async function assignShiftAction(input: z.infer<typeof assignShiftSchema>) {
  return requireStaffPermission('staff', 'view', async (admin) => {
    const parsed = assignShiftSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: 'Некорректные параметры смены' };
    }

    const isPrivileged = ['OWNER', 'ADMIN', 'MANAGER'].includes(admin.role);
    if (!isPrivileged && admin.id !== input.userId) {
      return { success: false as const, error: 'Вы можете выставлять смены только для себя' };
    }

    const shiftDate = new Date(`${input.dateStr}T00:00:00.000Z`);

    // Check if user is currently on Vacation/Sick on this day
    const existingSameDay = await db.staffShift.findFirst({
      where: {
        userId: input.userId,
        date: shiftDate,
        status: { in: ['VACATION', 'SICK', 'DAY_OFF'] },
      },
    });

    if (existingSameDay && ['PLANNED', 'COMPLETED'].includes(input.status)) {
      return {
        success: false as const,
        error: `Нельзя назначить рабочую смену: сотрудник находится в статусе «${existingSameDay.status === 'VACATION' ? 'Отпуск' : existingSameDay.status === 'SICK' ? 'Больничный' : 'Отгул'}». Сначала снимите отпуск.`,
      };
    }

    const shift = await db.staffShift.upsert({
      where: {
        userId_date_shiftType: {
          userId: input.userId,
          date: shiftDate,
          shiftType: input.shiftType,
        },
      },
      create: {
        userId: input.userId,
        date: shiftDate,
        shiftType: input.shiftType,
        status: input.status,
        rateRubles: input.rateRubles,
        notes: input.notes,
      },
      update: {
        status: input.status,
        rateRubles: input.rateRubles,
        notes: input.notes,
      },
    });

    const ipAddress = await getClientIp('unknown');
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'UPDATE_SERVICE_PRICE',
      target: shift.id,
      targetType: 'STAFF_SHIFT',
      newValue: { userId: input.userId, date: input.dateStr, status: input.status },
      ipAddress,
    });

    safeRevalidatePath('/admin/staff');
    return { success: true as const, shift };
  });
}

/**
 * Evaluates substitute availability and reciprocal shift candidates for a given shift.
 */
export async function getAvailableSubstitutesAction(shiftId: string) {
  return requireStaffPermission('staff', 'view', async (admin) => {
    const shift = await db.staffShift.findUnique({
      where: { id: shiftId },
      include: { user: true },
    });

    if (!shift) {
      return { success: false as const, error: 'Смена не найдена' };
    }

    const targetDate = shift.date;
    const year = targetDate.getUTCFullYear();
    const month = targetDate.getUTCMonth() + 1;
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const tenantFilter = admin.tenantId ? { tenantId: admin.tenantId } : {};

    // Fetch all other staff members
    const staffUsers = await db.user.findMany({
      where: {
        id: { not: shift.userId },
        OR: [
          { role: { in: ['SUPPORT', 'MANAGER', 'ADMIN', 'OWNER'] } },
          { staffRoleId: { not: null } },
        ],
        ...tenantFilter
      },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    });

    // Fetch shifts of all candidates for the target date and the month
    const candidateShifts = await db.staffShift.findMany({
      where: {
        userId: { in: staffUsers.map(u => u.id) },
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    const result: AvailableSubstituteDTO[] = staffUsers.map((candidate) => {
      const candidateShiftsThisMonth = candidateShifts.filter(s => s.userId === candidate.id);
      const shiftOnTargetDate = candidateShiftsThisMonth.find(s => s.date.getTime() === targetDate.getTime());

      let isAvailable = true;
      let statusBadge: AvailableSubstituteDTO['statusBadge'] = 'FREE';
      let statusText = 'Свободен для подмены ✅';

      if (shiftOnTargetDate) {
        if (shiftOnTargetDate.status === 'VACATION') {
          isAvailable = false;
          statusBadge = 'VACATION';
          statusText = 'В отпуске 🌴 (недоступен)';
        } else if (shiftOnTargetDate.status === 'SICK') {
          isAvailable = false;
          statusBadge = 'SICK';
          statusText = 'На больничном 🩹 (недоступен)';
        } else if (shiftOnTargetDate.shiftType === shift.shiftType && ['PLANNED', 'COMPLETED', 'SWAPPED'].includes(shiftOnTargetDate.status)) {
          isAvailable = false;
          statusBadge = 'BUSY_SAME_SLOT';
          statusText = 'Уже дежурит в этот же слот ⚠️';
        } else if (['PLANNED', 'COMPLETED', 'SWAPPED'].includes(shiftOnTargetDate.status)) {
          // Works another shift on the same day (e.g. night vs day)
          isAvailable = true; // Can do partial or 24h, but warn
          statusBadge = 'BUSY_OTHER_SLOT';
          statusText = 'Дежурит в другую смену (24ч подряд) ⚠️';
        }
      }

      // Find candidates reciprocal shifts for 2-way swap
      const availableReciprocalShifts = candidateShiftsThisMonth
        .filter(s => ['PLANNED', 'COMPLETED'].includes(s.status) && s.id !== shift.id)
        .map(s => ({
          id: s.id,
          dateStr: s.date.toISOString().split('T')[0],
          dayNumber: s.date.getUTCDate(),
          shiftType: s.shiftType,
        }));

      return {
        id: candidate.id,
        email: candidate.email,
        role: candidate.role,
        isAvailable,
        statusBadge,
        statusText,
        availableReciprocalShifts,
      };
    });

    return {
      success: true as const,
      shift: {
        id: shift.id,
        dateStr: shift.date.toISOString().split('T')[0],
        shiftType: shift.shiftType,
        userEmail: shift.user.email,
      },
      candidates: result,
    };
  });
}

const swapShiftSchema = z.object({
  shiftId: z.string().min(1),
  substituteUserId: z.string().min(1),
  substituteHours: z.number().min(0).max(24).optional().default(0), // 0 = полная смена, >0 = часы подмены
  reciprocalShiftId: z.string().optional(), // Опциональная встречная смена для взаимного обмена (2-Way Swap)
  notes: z.string().min(1),
});

/**
 * Records a shift swap or reciprocal 2-way shift exchange with full Poka-Yoke collision prevention.
 */
export async function swapShiftAction(input: z.input<typeof swapShiftSchema>) {
  return requireStaffPermission('staff', 'view', async (admin) => {
    const parsed = swapShiftSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: 'Заполните причину и выберите коллегу для подмены' };
    }

    const existing = await db.staffShift.findUnique({
      where: { id: input.shiftId },
      include: { user: true },
    });

    if (!existing) {
      return { success: false as const, error: 'Смена не найдена' };
    }

    const isPrivileged = ['OWNER', 'ADMIN', 'MANAGER'].includes(admin.role);
    if (!isPrivileged && admin.id !== existing.userId) {
      return { success: false as const, error: 'Вы можете передать только собственную смену' };
    }

    if (existing.userId === input.substituteUserId) {
      return { success: false as const, error: 'Нельзя назначить подмену на самого себя' };
    }

    // Poka-Yoke Collision Check on Substitute's status on that target date
    const targetDate = existing.date;
    const substituteExistingShift = await db.staffShift.findFirst({
      where: {
        userId: input.substituteUserId,
        date: targetDate,
      },
    });

    if (substituteExistingShift) {
      if (['VACATION', 'SICK', 'DAY_OFF'].includes(substituteExistingShift.status)) {
        return {
          success: false as const,
          error: `Коллега недоступен в этот день (${substituteExistingShift.status === 'VACATION' ? 'в отпуске' : 'на больничном'}). Выберите другого сотрудника.`,
        };
      }
      if (
        substituteExistingShift.shiftType === existing.shiftType &&
        ['PLANNED', 'COMPLETED', 'SWAPPED'].includes(substituteExistingShift.status)
      ) {
        return {
          success: false as const,
          error: `Коллега уже назначен на смену в этот же временной слот (${existing.shiftType === 'DAY' ? 'Дневная' : 'Ночная'}). Выберите другого сотрудника.`,
        };
      }
    }

    // Atomic Execution: 1-Way Cover OR 2-Way Reciprocal Exchange
    if (input.reciprocalShiftId) {
      const reciprocalShift = await db.staffShift.findUnique({
        where: { id: input.reciprocalShiftId },
        include: { user: true },
      });

      if (!reciprocalShift || reciprocalShift.userId !== input.substituteUserId) {
        return { success: false as const, error: 'Встречная смена коллеги не найдена' };
      }

      await db.$transaction([
        db.staffShift.update({
          where: { id: input.shiftId },
          data: {
            status: 'SWAPPED',
            substituteUserId: input.substituteUserId,
            substituteHours: input.substituteHours,
            notes: `Взаимный обмен: ${input.notes}`,
          },
        }),
        db.staffShift.update({
          where: { id: input.reciprocalShiftId },
          data: {
            status: 'SWAPPED',
            substituteUserId: existing.userId,
            substituteHours: input.substituteHours,
            notes: `Взаимный обмен: ${input.notes}`,
          },
        }),
      ]);
    } else {
      await db.staffShift.update({
        where: { id: input.shiftId },
        data: {
          status: 'SWAPPED',
          substituteUserId: input.substituteUserId,
          substituteHours: input.substituteHours,
          notes: input.notes,
        },
      });
    }

    const ipAddress = await getClientIp('unknown');
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'UPDATE_USER_ROLE',
      target: input.shiftId,
      targetType: 'STAFF_SHIFT_SWAP',
      oldValue: { scheduledUser: existing.user.email },
      newValue: { substituteUserId: input.substituteUserId, reciprocalShiftId: input.reciprocalShiftId, notes: input.notes },
      ipAddress,
    });

    safeRevalidatePath('/admin/staff');
    return { success: true as const };
  });
}

/**
 * Deletes / cancels a shift slot.
 */
export async function deleteShiftAction(shiftId: string) {
  return requireStaffPermission('staff', 'view', async (admin) => {
    const existing = await db.staffShift.findUnique({
      where: { id: shiftId },
    });

    if (!existing) {
      return { success: false as const, error: 'Смена не найдена' };
    }

    const isPrivileged = ['OWNER', 'ADMIN', 'MANAGER'].includes(admin.role);
    if (!isPrivileged && admin.id !== existing.userId) {
      return { success: false as const, error: 'Вы можете отменить только свою смену' };
    }

    await db.staffShift.delete({
      where: { id: shiftId },
    });

    safeRevalidatePath('/admin/staff');
    return { success: true as const };
  });
}

const timeOffSchema = z.object({
  userId: z.string().min(1),
  dateFromStr: z.string().min(10),
  dateToStr: z.string().min(10),
  status: z.enum(['VACATION', 'SICK', 'DAY_OFF']),
  notes: z.string().optional(),
});

/**
 * Batch registers a vacation, sick leave or day off period for a staff member.
 * Automatically clears scheduled working shifts and alerts about freed slots.
 */
export async function requestTimeOffAction(input: z.infer<typeof timeOffSchema>) {
  return requireStaffPermission('staff', 'view', async (admin) => {
    const parsed = timeOffSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: 'Некорректные даты периода' };
    }

    const isPrivileged = ['OWNER', 'ADMIN', 'MANAGER'].includes(admin.role);
    if (!isPrivileged && admin.id !== input.userId) {
      return { success: false as const, error: 'Вы можете оформить заявку только на себя' };
    }

    const fromDate = new Date(`${input.dateFromStr}T00:00:00.000Z`);
    const toDate = new Date(`${input.dateToStr}T00:00:00.000Z`);

    if (fromDate > toDate) {
      return { success: false as const, error: 'Дата начала не может быть позже даты окончания' };
    }

    const curr = new Date(fromDate);
    let count = 0;
    let freedWorkShifts = 0;

    while (curr <= toDate) {
      const shiftDate = new Date(curr);

      // Check if user had a planned work shift on this date
      const existingWorkShift = await db.staffShift.findFirst({
        where: {
          userId: input.userId,
          date: shiftDate,
          status: { in: ['PLANNED', 'COMPLETED', 'SWAPPED'] },
        },
      });

      if (existingWorkShift) {
        freedWorkShifts++;
      }

      await db.staffShift.upsert({
        where: {
          userId_date_shiftType: {
            userId: input.userId,
            date: shiftDate,
            shiftType: 'DAY',
          },
        },
        create: {
          userId: input.userId,
          date: shiftDate,
          shiftType: 'DAY',
          status: input.status,
          substituteUserId: null,
          rateRubles: 0,
          notes: input.notes || (input.status === 'VACATION' ? 'Отпуск' : input.status === 'SICK' ? 'Больничный' : 'Отгул'),
        },
        update: {
          status: input.status,
          substituteUserId: null,
          rateRubles: 0,
          notes: input.notes || (input.status === 'VACATION' ? 'Отпуск' : input.status === 'SICK' ? 'Больничный' : 'Отгул'),
        },
      });

      count++;
      curr.setDate(curr.getDate() + 1);
    }

    safeRevalidatePath('/admin/staff');
    return { success: true as const, daysCount: count, freedWorkShifts };
  });
}

const bulkTemplateSchema = z.object({
  userId: z.string().min(1),
  year: z.number(),
  month: z.number(),
  templateType: z.enum(['2_2_DAY', '2_2_NIGHT', '5_2', 'DAILY']),
  startDay: z.number().min(1).max(31).default(1),
  rateRubles: z.number().min(0).max(50000).default(2500),
});

/**
 * Bulk applies a shift pattern (2/2, 5/2) for a staff member for the entire month.
 */
export async function applyShiftTemplateAction(input: z.infer<typeof bulkTemplateSchema>) {
  return requireStaffPermission('staff', 'edit', async (admin) => {
    const daysInMonth = new Date(input.year, input.month, 0).getDate();
    const shiftType = input.templateType === '2_2_NIGHT' ? 'NIGHT' : 'DAY';

    const recordsToCreate = [];

    for (let day = 1; day <= daysInMonth; day++) {
      let isWorking = false;

      if (input.templateType === '5_2') {
        const dateObj = new Date(input.year, input.month - 1, day);
        const dayOfWeek = dateObj.getDay();
        isWorking = dayOfWeek !== 0 && dayOfWeek !== 6;
      } else if (input.templateType === '2_2_DAY' || input.templateType === '2_2_NIGHT') {
        const diff = (day - input.startDay) % 4;
        const normalizedDiff = (diff + 4) % 4;
        isWorking = normalizedDiff === 0 || normalizedDiff === 1;
      } else if (input.templateType === 'DAILY') {
        isWorking = true;
      }

      if (isWorking) {
        const shiftDate = new Date(Date.UTC(input.year, input.month - 1, day, 0, 0, 0, 0));
        recordsToCreate.push({
          userId: input.userId,
          date: shiftDate,
          shiftType,
          status: 'PLANNED',
          rateRubles: input.rateRubles,
        });
      }
    }

    for (const rec of recordsToCreate) {
      await db.staffShift.upsert({
        where: {
          userId_date_shiftType: {
            userId: rec.userId,
            date: rec.date,
            shiftType: rec.shiftType,
          },
        },
        create: rec,
        update: {
          status: 'PLANNED',
          rateRubles: rec.rateRubles,
        },
      });
    }

    const ipAddress = await getClientIp('unknown');
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'UPDATE_SERVICE_PRICE',
      target: input.userId,
      targetType: 'STAFF_TEMPLATE_APPLY',
      newValue: { template: input.templateType, count: recordsToCreate.length },
      ipAddress,
    });

    safeRevalidatePath('/admin/staff');
    return { success: true as const, createdCount: recordsToCreate.length };
  });
}

/**
 * Calculates monthly timesheet and payroll for all staff members.
 */
export async function getMonthlyPayrollAction(year: number, month: number) {
  return requireStaffPermission('staff', 'view', async (admin) => {
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const tenantFilter = admin.tenantId ? { tenantId: admin.tenantId } : {};

    const staffUsers = await db.user.findMany({
      where: {
        OR: [
          { role: { in: ['SUPPORT', 'MANAGER', 'ADMIN', 'OWNER'] } },
          { staffRoleId: { not: null } },
        ],
        ...tenantFilter
      },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    });

    const staffIds = staffUsers.map((u) => u.id);

    const allShifts = await db.staffShift.findMany({
      where: {
        OR: [
          { userId: { in: staffIds } },
          { substituteUserId: { in: staffIds } },
        ],
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    const staffLogs = await db.adminAuditLog.findMany({
      where: {
        adminId: { in: staffIds },
        action: { in: ['REPLY_TICKET', 'CLOSE_TICKET'] },
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
      select: { adminId: true },
    });

    const ticketCountsByStaff = new Map<string, number>();
    staffLogs.forEach((l) => {
      ticketCountsByStaff.set(l.adminId, (ticketCountsByStaff.get(l.adminId) || 0) + 1);
    });

    const payrollRows: PayrollRow[] = staffUsers.map((staff) => {
      const scheduled = allShifts.filter((s) => s.userId === staff.id);
      const substitutedForOthers = allShifts.filter((s) => s.substituteUserId === staff.id);

      let plannedCount = 0;
      let vacationCount = 0;
      let sickCount = 0;
      let ownWorkedCount = 0;
      let swappedOutCount = 0;
      let basePay = 0;
      let totalBonus = 0;
      let totalPenalty = 0;

      scheduled.forEach((s) => {
        if (['PLANNED', 'COMPLETED'].includes(s.status)) {
          plannedCount++;
          if (!s.substituteUserId) {
            ownWorkedCount++;
            basePay += s.rateRubles;
            totalBonus += s.bonusRubles;
            totalPenalty += s.penaltyRubles;
          }
        }
        if (s.status === 'SWAPPED') {
          swappedOutCount++;
          if (s.substituteHours && s.substituteHours > 0) {
            const hoursCovered = Math.min(12, s.substituteHours);
            const hourlyRate = s.rateRubles / 12;
            const transferred = Math.round(hoursCovered * hourlyRate);
            const retained = s.rateRubles - transferred;
            basePay += retained;
            ownWorkedCount += Math.round(((12 - hoursCovered) / 12) * 10) / 10;
          }
        }
        if (s.status === 'VACATION') {
          vacationCount++;
        }
        if (s.status === 'SICK') {
          sickCount++;
        }
      });

      let coversCount = 0;
      substitutedForOthers.forEach((s) => {
        coversCount++;
        if (s.substituteHours && s.substituteHours > 0) {
          const hoursCovered = Math.min(12, s.substituteHours);
          const hourlyRate = s.rateRubles / 12;
          const transferred = Math.round(hoursCovered * hourlyRate);
          basePay += transferred;
        } else {
          basePay += s.rateRubles;
          totalBonus += s.bonusRubles;
        }
      });

      const actualShifts = Math.round((ownWorkedCount + (substitutedForOthers.reduce((acc, s) => acc + (s.substituteHours && s.substituteHours > 0 ? s.substituteHours / 12 : 1), 0))) * 10) / 10;
      const ticketsHandled = ticketCountsByStaff.get(staff.id) || 0;
      const kpiBonus = ticketsHandled > 200 ? (ticketsHandled - 200) * 10 : 0;
      totalBonus += kpiBonus;

      const netPayout = Math.max(0, basePay + totalBonus - totalPenalty);

      return {
        userId: staff.id,
        userEmail: staff.email,
        role: staff.role,
        plannedShifts: plannedCount,
        actualShifts,
        substitutionsGiven: coversCount,
        substitutionsTaken: swappedOutCount,
        vacationDays: vacationCount,
        sickDays: sickCount,
        ticketsHandled,
        baseSalaryRubles: basePay,
        bonusRubles: totalBonus,
        penaltyRubles: totalPenalty,
        netPayoutRubles: netPayout,
      };
    });

    const isFullAccess = admin.role === 'OWNER' || admin.role === 'ADMIN';
    const visibleRows = isFullAccess 
      ? payrollRows 
      : payrollRows.filter((r) => r.userId === admin.id);

    return {
      success: true as const,
      isFullAccess,
      year,
      month,
      rows: visibleRows,
    };
  });
}
