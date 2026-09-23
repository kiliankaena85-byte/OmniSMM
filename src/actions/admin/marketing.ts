'use server';

import { db } from '@/lib/db';
import { adminMarketingService } from '@/services/admin/marketing.service';
import { auditAdmin, auditAdminAwaitable } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffPermission } from '@/lib/server/rbac';

const promoCodeSchema = z.object({
  code: z.string().min(1).max(12).toUpperCase().regex(/^[A-Z0-9_-]+$/, "Разрешены только буквы, цифры, дефис и подчеркивание"),
  type: z.enum(['DISCOUNT', 'VOUCHER']),
  discountPercent: z.coerce.number().min(0, "Процент скидки не может быть отрицательным").max(90, "Максимальная скидка 90%").optional().default(0),
  amount: z.coerce.number().min(0, "Сумма не может быть отрицательной").max(5000, "Максимальная сумма ваучера 5,000 ₽").optional().default(0),
  maxUses: z.coerce.number().int().min(1, "Максимальное количество использований должно быть не менее 1").max(1000000, "Превышен лимит использований (1 млн)").optional().default(1),
  expiresAt: z.string().optional().transform(v => v ? new Date(v) : null),
  description: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  budget: z.coerce.number().min(0, "Бюджет не может быть отрицательным").max(20000000, "Максимальный бюджет 20 000 000 ₽").optional().default(0),
  isSuspicious: z.coerce.boolean().optional().default(false)
}).refine((data) => {
  if (data.expiresAt) {
    return data.expiresAt.getTime() > Date.now();
  }
  return true;
}, {
  message: "Срок действия промокода должен быть в будущем",
  path: ["expiresAt"]
});

export async function createPromoCode(formData: FormData) {
  return requireStaffPermission('marketing', 'edit', async (admin) => {
    const payload = Object.fromEntries(formData.entries());
    
    // Convert isSuspicious checkbox/select value safely if passed
    const rawSuspicious = payload.isSuspicious;
    const isSuspiciousBool = rawSuspicious === 'true' || rawSuspicious === 'on';

    const parsed = promoCodeSchema.safeParse({
      ...payload,
      isSuspicious: isSuspiciousBool,
    });
    
    if (!parsed.success) {
      return { 
        success: false as const, 
        error: 'Некорректные данные: ' + parsed.error.errors.map(e => e.message).join(', ') 
      };
    }

    const { 
      code, 
      type, 
      discountPercent, 
      amount, 
      maxUses, 
      expiresAt,
      description,
      utmSource,
      utmMedium,
      utmCampaign,
      budget,
      isSuspicious
    } = parsed.data;

    const budgetCents = Math.round(budget * 100);
    const amountCents = Math.round(amount * 100);

    await adminMarketingService.createPromoCode({
      code,
      type,
      discountPercent,
      amount: amountCents,
      maxUses,
      expiresAt,
      description,
      utmSource,
      utmMedium,
      utmCampaign,
      budgetCents,
      isSuspicious
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'PROMOCODE_CREATE',
      target: code.toUpperCase(),
      targetType: 'SETTINGS', // Promo codes are system settings
      newValue: { 
        type, 
        discountPercent, 
        amount, 
        maxUses, 
        expiresAt,
        description,
        utmSource,
        utmMedium,
        utmCampaign,
        budgetCents,
        isSuspicious
      }
    });

    revalidatePath('/admin/marketing');
    return { success: true as const };
  });
}

export async function togglePromoCode(id: string, isActive: boolean) {
  return requireStaffPermission('marketing', 'edit', async (admin) => {
    const promo = await db.promoCode.findUnique({ where: { id } });
    if (!promo) return { success: false as const, error: 'Промокод не найден' };

    await adminMarketingService.togglePromoCode(id, isActive);
    
    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: isActive ? 'PROMOCODE_ENABLE' : 'PROMOCODE_DISABLE',
      target: promo.code,
      targetType: 'SETTINGS',
    });

    revalidatePath('/admin/marketing');
    return { success: true as const };
  });
}

export async function deletePromoCode(id: string) {
  return requireStaffPermission('marketing', 'edit', async (admin) => {
    const promo = await db.promoCode.findUnique({ where: { id } });
    if (!promo) return { success: false as const, error: 'Промокод не найден' };

    await adminMarketingService.deletePromoCode(id);
    
    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'PROMOCODE_DELETE',
      target: promo.code,
      targetType: 'SETTINGS',
    });

    revalidatePath('/admin/marketing');
    return { success: true as const };
  });
}

const referralPayoutSchema = z.object({
  userId: z.string().min(1),
  amount: z.coerce.number().int().min(10000, "Минимальная сумма выплаты 10 000 копеек (100 ₽)").max(5000000, "Максимальная сумма выплаты 5,000,000 копеек (50,000 ₽)"),
});

export async function processReferralPayout(userId: string, amount: number) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const parsed = referralPayoutSchema.safeParse({ userId, amount });
    if (!parsed.success) {
      return { 
        success: false as const, 
        error: 'Некорректная сумма выплаты: ' + parsed.error.errors.map(e => e.message).join(', ') 
      };
    }
    const { userId: parsedUserId, amount: parsedAmount } = parsed.data;

    await adminMarketingService.processPayout(parsedUserId, admin.id, parsedAmount);
    
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'REFERRAL_PAYOUT',
      target: parsedUserId,
      targetType: 'USER',
      newValue: { amountCents: parsedAmount },
    });

    revalidatePath('/admin/marketing');
    return { success: true as const };
  });
}
