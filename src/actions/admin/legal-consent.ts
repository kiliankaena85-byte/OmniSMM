'use server';

import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { z } from 'zod';

const LEGAL_DOCUMENT_VERSION = '2026.1-RU';
const LEGAL_DOCUMENT_TEXT = `Регламент финансовой ответственности сотрудников службы поддержки SMM-панели (Версия ${LEGAL_DOCUMENT_VERSION}):
1. Настоящий документ устанавливает персональную материальную и дисциплинарную ответственность сотрудника за все финансовые операции (компенсации, докруты, возвраты и корректировки баланса пользователей).
2. Каждый сотрудник обязан использовать функции начисления и списания исключительно в целях решения обращений клиентов в рамках установленных персональных и суточных лимитов.
3. Категорически запрещается изменять собственный баланс, а также баланс любых других сотрудников компании.
4. Все действия в системе фиксируются в электронном журнале аудита с сохранением цифрового отпечатка, IP-адреса, временных меток в часовом поясе Europe/Moscow и связки с тикетами/заказами.
5. Нарушение порядка компенсаций является основанием для применения мер дисциплинарного взыскания и взыскания материального ущерба согласно ТК РФ.`;

const LEGAL_DOCUMENT_HASH = crypto.createHash('sha256').update(LEGAL_DOCUMENT_TEXT).digest('hex');

export async function getEmployeeConsentStatusAction() {
  return requireStaffPermission('tickets', 'view', async (user) => {
    const consent = await db.employeeResponsibilityConsent.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        documentVersionText: LEGAL_DOCUMENT_VERSION
      }
    });

    return {
      success: true as const,
      hasConsented: Boolean(consent),
      consent,
      documentVersion: LEGAL_DOCUMENT_VERSION,
      documentText: LEGAL_DOCUMENT_TEXT,
      documentHash: LEGAL_DOCUMENT_HASH
    };
  });
}

export async function acceptEmployeeResponsibilityConsentAction() {
  return requireStaffPermission('tickets', 'view', async (user) => {
    const reqHeaders = await headers();
    const userAgent = reqHeaders.get('user-agent') || 'Unknown';
    const ipAddress = await getClientIp('unknown');

    // Supersede any old consents
    await db.employeeResponsibilityConsent.updateMany({
      where: { userId: user.id, status: 'ACTIVE' },
      data: { status: 'SUPERSEDED' }
    });

    const consent = await db.employeeResponsibilityConsent.create({
      data: {
        userId: user.id,
        documentVersionText: LEGAL_DOCUMENT_VERSION,
        documentHash: LEGAL_DOCUMENT_HASH,
        acceptedIp: ipAddress,
        acceptedUserAgent: userAgent,
        status: 'ACTIVE'
      }
    });

    await auditAdminAwaitable({
      adminId: user.id,
      adminEmail: user.email,
      action: 'ACCEPT_LEGAL_CONSENT',
      target: consent.id,
      targetType: 'LEGAL_CONSENT',
      oldValue: null,
      newValue: JSON.stringify({ documentVersion: LEGAL_DOCUMENT_VERSION, documentHash: LEGAL_DOCUMENT_HASH }),
      ipAddress
    });

    revalidatePath('/admin');
    return { success: true as const, consentId: consent.id };
  });
}

const revokeConsentSchema = z.object({
  userId: z.string().min(1, 'Пользователь не указан')
});

export async function revokeEmployeeConsentAction(formData: FormData) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const parsed = revokeConsentSchema.safeParse({ userId: formData.get('userId') });
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.errors[0]?.message || 'Пользователь не указан' };
    }
    const targetUserId = parsed.data.userId;

    await db.employeeResponsibilityConsent.updateMany({
      where: { userId: targetUserId, status: 'ACTIVE' },
      data: { status: 'REVOKED' }
    });

    const ipAddress = await getClientIp('unknown');
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'REVOKE_LEGAL_CONSENT',
      target: targetUserId,
      targetType: 'LEGAL_CONSENT',
      oldValue: JSON.stringify({ status: 'ACTIVE' }),
      newValue: JSON.stringify({ status: 'REVOKED' }),
      ipAddress
    });

    revalidatePath('/admin');
    return { success: true as const };
  });
}
