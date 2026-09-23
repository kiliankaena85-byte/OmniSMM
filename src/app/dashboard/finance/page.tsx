export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { resolveTenantFromRequest } from '@/lib/tenant-resolver-edge';
import FinanceClientPage from './client-page';
import { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const reqHeaders = await headers();
  const tenantId = resolveTenantFromRequest(reqHeaders);
  const isFlux = tenantId === 'flux';

  return {
    title: isFlux ? 'Финансы и баланс | SMMflux' : 'Финансы и баланс | SMMplan',
    description: 'Пополнение баланса (ЮKassa, СБП, Криптовалюта), прозрачная бухгалтерия и полный журнал списаний и возвратов.',
  };
}

export default async function FinancePage() {
  const session = await verifySession();
  if (!session) redirect('/login');

  const [user, entries] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, balance: true },
    }),
    db.ledgerEntry.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        amount: true,
        reason: true,
        status: true,
        idempotencyKey: true,
        transactionType: true,
        adminId: true,
        createdAt: true,
      },
    }),
  ]);

  if (!user) redirect('/login');

  // FIX(A3/A7-restore): running balance якорится к ФАКТИЧЕСКОМУ балансу пользователя,
  // а не к нулю. Цепочку ведём назад от user.balance только по APPROVED-проводкам:
  // PENDING/QUARANTINE/REJECTED не изменяли баланс и не должны его искажать.
  // Для не-APPROVED записей runningBalance не показываем (null) — UI скрывает «Баланс стал».
  const approvedSum = entries.reduce(
    (acc, e) => (e.status === 'APPROVED' ? acc + e.amount : acc),
    BigInt(0)
  );
  let runningBalance = BigInt(user.balance ?? 0) - approvedSum;
  const enrichedEntries = entries.map(entry => {
    const isApproved = entry.status === 'APPROVED';
    if (isApproved) {
      runningBalance += entry.amount;
    }
    
    // Match numeric order ID if mentioned in reason e.g. #10429
    const orderMatch = /#(\d{3,9})/.exec(entry.reason);
    const orderNumericId = orderMatch ? Number(orderMatch[1]) : null;

    return {
      id: entry.id,
      amountCents: typeof entry.amount === 'bigint' ? Number(entry.amount) : entry.amount,
      amountRub: Number(entry.amount) / 100,
      runningBalanceCents: isApproved ? Number(runningBalance) : null,
      runningBalanceRub: isApproved ? Number(runningBalance) / 100 : null,
      reason: entry.reason,
      status: entry.status,
      idempotencyKey: entry.idempotencyKey || null,
      transactionType: entry.transactionType,
      adminId: entry.adminId || null,
      orderNumericId,
      createdAt: entry.createdAt.toISOString(),
    };
  });

  // Reverse so newest transactions are at the top
  const serializedEntries = enrichedEntries.reverse();
  const currentBalanceRub = Number(user.balance ?? 0) / 100;

  const reqHeaders = await headers();
  const tenantId = resolveTenantFromRequest(reqHeaders);

  return (
    <Suspense fallback={<div className="max-w-4xl animate-pulse text-muted-foreground">Загрузка финансов...</div>}>
      <FinanceClientPage
        userEmail={user.email}
        currentBalanceRub={currentBalanceRub}
        initialEntries={serializedEntries}
        tenantId={tenantId}
      />
    </Suspense>
  );
}
