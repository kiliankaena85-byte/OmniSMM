import { db as prisma } from '@/lib/db';
import { sendAdminAlert } from '@/lib/notifications';

export interface ReconciliationResult {
  userId: string;
  email: string;
  userBalance: bigint;
  ledgerSum: bigint;
  discrepancy: bigint;
  isDiscrepancy: boolean;
  lockedSuccessfully: boolean;
  error?: string;
}

export class BalanceVerifier {
  /**
   * Reconciles balance with ledger entries for all active and non-deleted users.
   * If a discrepancy is found, locks the account, writes to audit log, and triggers an admin alert.
   */
  static async verifyAllBalances(): Promise<ReconciliationResult[]> {
    const results: ReconciliationResult[] = [];

    try {
      // 1. Retrieve all active, non-deleted users
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          isDeleted: false,
        },
        select: {
          id: true,
          email: true,
          balance: true,
          isActive: true,
          adminNote: true,
        },
      });

      for (const user of users) {
        try {
          // Wrap verification of each user in a single Serializable transaction to prevent TOCTOU Race Condition.
          const res = await prisma.$transaction(async (tx) => {
            const freshUser = await tx.user.findUniqueOrThrow({
              where: { id: user.id },
              select: { id: true, email: true, balance: true, isActive: true, adminNote: true }
            });

            const aggregateResult = await tx.ledgerEntry.aggregate({
              _sum: {
                amount: true,
              },
              where: {
                userId: freshUser.id,
                status: 'APPROVED',
              },
            });

            const ledgerSum = aggregateResult._sum.amount ?? BigInt(0);
            const discrepancy = freshUser.balance - ledgerSum;
            const isDiscrepancy = discrepancy !== BigInt(0);

            let lockedSuccessfully = false;

            if (isDiscrepancy) {
              const adminNoteText = `[CRITICAL DISCREPANCY] Автоматическая блокировка: баланс (${freshUser.balance.toString()}) не сходится с реестром (${ledgerSum.toString()}). Разница: ${discrepancy.toString()} центов.`;

              await tx.user.update({
                where: { id: freshUser.id },
                data: {
                  isActive: false,
                  adminNote: adminNoteText,
                  adminNoteUpdatedAt: new Date(),
                  adminNoteUpdatedBy: 'SYSTEM',
                },
              });

              await tx.adminAuditLog.create({
                data: {
                  adminId: 'SYSTEM',
                  adminEmail: 'system@smmplan.pro',
                  action: 'USER_BALANCE_DISCREPANCY',
                  target: freshUser.id,
                  targetType: 'USER',
                  oldValue: JSON.stringify({
                    isActive: freshUser.isActive,
                    balance: freshUser.balance.toString(),
                    adminNote: freshUser.adminNote,
                  }),
                  newValue: adminNoteText,
                  ipAddress: '127.0.0.1',
                },
              });

              lockedSuccessfully = true;
            }

            return {
              freshUser,
              ledgerSum,
              discrepancy,
              isDiscrepancy,
              lockedSuccessfully
            };
          }, { isolationLevel: 'Serializable' });

          const { freshUser, ledgerSum, discrepancy, isDiscrepancy, lockedSuccessfully } = res;

          if (isDiscrepancy) {
            // Send a critical admin alert
            const alertMessage = `🚨 [CRITICAL BALANCE DISCREPANCY]
User: ${freshUser.email} (ID: ${freshUser.id})
User Balance: ${freshUser.balance.toString()} cents (${(Number(freshUser.balance) / 100).toFixed(2)} ₽)
Ledger Sum: ${ledgerSum.toString()} cents (${(Number(ledgerSum) / 100).toFixed(2)} ₽)
Discrepancy: ${discrepancy.toString()} cents (${(Number(discrepancy) / 100).toFixed(2)} ₽)
Action: Account LOCKED, logged in AdminAuditLog.`;

            sendAdminAlert(alertMessage, 'CRITICAL');
          }

          results.push({
            userId: freshUser.id,
            email: freshUser.email,
            userBalance: freshUser.balance,
            ledgerSum,
            discrepancy,
            isDiscrepancy,
            lockedSuccessfully,
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[BalanceVerifier] Error processing user ${user.email}:`, err);
          results.push({
            userId: user.id,
            email: user.email,
            userBalance: user.balance,
            ledgerSum: BigInt(0),
            discrepancy: BigInt(0),
            isDiscrepancy: true,
            lockedSuccessfully: false,
            error: errMsg,
          });
        }
      }
    } catch (err: unknown) {
      console.error('[BalanceVerifier] Global error in verifyAllBalances:', err);
      throw err;
    }

    return results;
  }
}

// CLI Execution Wrapper
if (process.argv[1] && (process.argv[1].endsWith('balance-verifier.ts') || process.argv[1].endsWith('balance-verifier.js'))) {
  (async () => {
    console.log('======================================================================');
    console.log('🔍 ЗАПУСК СКАНИРОВАНИЯ БАЛАНСОВ ПОЛЬЗОВАТЕЛЕЙ SMMplan');
    console.log('======================================================================');

    let results: ReconciliationResult[] = [];
    let hasError = false;

    try {
      results = await BalanceVerifier.verifyAllBalances();
    } catch (err) {
      console.error('❌ Критическая ошибка при запуске сканирования:', err);
      hasError = true;
    } finally {
      try {
        await prisma.$disconnect();
        console.log('🔌 Соединение с базой данных Prisma успешно закрыто.');
      } catch (err) {
        console.error('❌ Ошибка при закрытии соединения с Prisma:', err);
      }
    }

    if (hasError) {
      process.exit(1);
    }

    const totalScanned = results.length;
    const cleanAccounts = results.filter(r => !r.isDiscrepancy && !r.error);
    const discrepancies = results.filter(r => r.isDiscrepancy || r.error);

    console.log('\n----------------------------------------------------------------------');
    for (const res of results) {
      const balanceRub = (Number(res.userBalance) / 100).toFixed(2);
      const ledgerSumRub = (Number(res.ledgerSum) / 100).toFixed(2);

      if (res.error) {
        console.log(`🔴 [ОШИБКА] Пользователь: ${res.email} (ID: ${res.userId})`);
        console.log(`     Сбой при проверке: ${res.error}`);
      } else if (res.isDiscrepancy) {
        const diffSign = res.discrepancy > BigInt(0) ? '+' : '';
        const diffCents = `${diffSign}${res.discrepancy.toString()}`;
        console.log(`🚨 [РАСХОЖДЕНИЕ] Пользователь: ${res.email} (ID: ${res.userId})`);
        console.log(`     Баланс в User: ${balanceRub} ₽ (${res.userBalance.toString()} центов)`);
        console.log(`     Сумма в Ledger: ${ledgerSumRub} ₽ (${res.ledgerSum.toString()} центов)`);
        console.log(`     Разница: ${diffCents} центов`);
        console.log(`     Статус блокировки: ${res.lockedSuccessfully ? 'Успешно заблокирован 🔒' : 'Сбой блокировки ⚠️'}`);
      } else {
        console.log(`✅ [ОК] Пользователь: ${res.email} (ID: ${res.userId})`);
        console.log(`     Баланс: ${balanceRub} ₽ | Реестр: ${ledgerSumRub} ₽`);
      }
      console.log('----------------------------------------------------------------------');
    }

    console.log('\n======================================================================');
    console.log('📊 ИТОГИ ПРОВЕРКИ:');
    console.log(`- Всего отсканировано активных пользователей: ${totalScanned}`);
    console.log(`- Чистых аккаунтов: ${cleanAccounts.length}`);
    console.log(`- Скомпрометированных аккаунтов: ${discrepancies.length}`);
    console.log('======================================================================\n');

    if (discrepancies.length > 0) {
      console.log('❌ Обнаружены расхождения в балансах! Скрипт завершается с ошибкой.');
      process.exit(1);
    } else {
      console.log('✅ Проверка успешно завершена. Все проверенные аккаунты сбалансированы.');
      process.exit(0);
    }
  })();
}
