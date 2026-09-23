import { db } from '../src/lib/db';

async function main() {
  console.log('--- RUNNING SUPPORT & LEDGER INTEGRITY AUDIT ---');

  // Query 1: Discrepancies between user balance and ledger entries sum
  const userBalanceDiscrepancies: any[] = await db.$queryRaw`
    SELECT 
      u.id AS "userId",
      u.email,
      u.role,
      u.balance AS "userBalanceCents",
      COALESCE(SUM(l.amount), 0) AS "ledgerSumCents",
      (u.balance - COALESCE(SUM(l.amount), 0)) AS "discrepancyCents"
    FROM "User" u
    LEFT JOIN "LedgerEntry" l ON l."userId" = u.id AND l.status = 'COMPLETED'
    GROUP BY u.id, u.email, u.role, u.balance
    HAVING u.balance <> COALESCE(SUM(l.amount), 0);
  `;

  console.log(`[1] User balance vs Ledger sum discrepancies: ${userBalanceDiscrepancies.length}`);
  if (userBalanceDiscrepancies.length > 0) {
    console.table(userBalanceDiscrepancies);
  }

  // Query 2: Support financial actions without valid legal consent
  const actionsWithoutConsent: any[] = await db.$queryRaw`
    SELECT 
      sfa.id,
      sfa."staffUserId",
      sfa."targetUserId",
      sfa."amountCents",
      sfa."reasonNote",
      sfa."createdAt"
    FROM "SupportFinancialAction" sfa
    LEFT JOIN "EmployeeResponsibilityConsent" erc 
      ON erc."userId" = sfa."staffUserId"
    WHERE erc.id IS NULL;
  `;

  console.log(`[2] Support financial actions without active legal consent: ${actionsWithoutConsent.length}`);
  if (actionsWithoutConsent.length > 0) {
    console.table(actionsWithoutConsent);
  }

  // Query 3: Support financial actions without ticket reference
  const actionsWithoutTicket: any[] = await db.$queryRaw`
    SELECT 
      id,
      "staffUserId",
      "targetUserId",
      "amountCents",
      "reasonNote",
      "createdAt"
    FROM "SupportFinancialAction"
    WHERE "ticketId" IS NULL;
  `;

  console.log(`[3] Support financial actions without ticket ID: ${actionsWithoutTicket.length}`);
  if (actionsWithoutTicket.length > 0) {
    console.table(actionsWithoutTicket);
  }

  console.log('--- INTEGRITY CHECK COMPLETED ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
