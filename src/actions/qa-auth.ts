'use server';

import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { createSession } from '@/lib/session';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';

export interface QALoginResult {
  success: boolean;
  error?: string;
  redirectUrl?: string;
}

export type QARole = 'admin' | 'owner' | 'manager' | 'support' | 'cashier' | 'client';

export async function qaDirectLoginAction(formData: {
  role: QARole;
  secretKey: string;
  tenantId?: string;
  targetEmail?: string;
}): Promise<QALoginResult> {
  const isAllowed = process.env.NODE_ENV === 'development' || process.env.ENABLE_QA_TOOLS === 'true';
  if (!isAllowed) {
    return {
      success: false,
      error: 'QA вход отключен в производственной среде.'
    };
  }

  const expectedSecret = process.env.QA_DEV_SECRET || process.env.QA_SECRET_KEY;
  if (!expectedSecret) {
    return { 
      success: false, 
      error: 'Секретный QA ключ не настроен на сервере в переменных окружения.' 
    };
  }

  const providedSecret = formData.secretKey?.trim() || '';
  const userSecretBuf = Buffer.from(providedSecret);
  const expectedSecretBuf = Buffer.from(expectedSecret);

  if (
    userSecretBuf.length !== expectedSecretBuf.length ||
    !crypto.timingSafeEqual(userSecretBuf, expectedSecretBuf)
  ) {
    return { 
      success: false, 
      error: 'Неверный секретный ключ QA доступа. Проверьте правильность ключа.' 
    };
  }

  const tenant = normalizeTenantId(formData.tenantId || 'smmplan');
  
  const defaultRoleEmailMap: Record<QARole, string> = {
    admin: 'admin@smmplan.pro',
    owner: 'admin@smmplan.pro',
    manager: 'manager@smmplan.pro',
    support: 'support@smmplan.pro',
    cashier: 'cashier@smmplan.pro',
    client: 'client@smmplan.pro',
  };

  const targetEmail = (
    formData.targetEmail || 
    defaultRoleEmailMap[formData.role] || 
    'admin@smmplan.pro'
  ).toLowerCase();

  let user = await db.user.findFirst({
    where: {
      email: targetEmail,
      tenantId: tenant,
    },
  });

  if (!user) {
    user = await db.user.findFirst({
      where: { email: targetEmail, tenantId: tenant },
    });
  }

  if (!user) {
    return { 
      success: false, 
      error: `Тестовый пользователь (${targetEmail}) не найден в базе данных.` 
    };
  }

  await createSession(user.id);

  let redirectUrl = '/dashboard';
  if (formData.role === 'admin' || formData.role === 'owner') {
    redirectUrl = '/admin';
  } else if (formData.role === 'manager' || formData.role === 'support' || formData.role === 'cashier') {
    redirectUrl = '/operator';
  }

  return {
    success: true,
    redirectUrl,
  };
}
