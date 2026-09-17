'use server';

import { db } from "@/lib/db";
import { verifySession } from "@/lib/session";
import { WalletOps } from "@/services/financial/wallet-ops";
import crypto from "crypto";

export async function transferReferralBalanceAction() {
  const session = await verifySession();
  if (!session) throw new Error("Unauthorized");

  let transferAmount = 0;
  const transferId = crypto.randomUUID();
  
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: session.userId },
      select: { referralBalance: true, balance: true, isActive: true, isDeleted: true, tenantId: true }
    });

    if (!user) throw new Error("Учетная запись не найдена");
    if (user.isDeleted === true || user.isActive === false) throw new Error("Ваш аккаунт заблокирован или удален");
    if (!user.referralBalance || user.referralBalance <= 0) {
      throw new Error("Нет средств для перевода");
    }

    transferAmount = user.referralBalance;

    // 1. Atomic decrement of referral balance with TOCTOU optimistic guard
    const updated = await tx.user.updateMany({
      where: { 
        id: session.userId,
        referralBalance: { gte: transferAmount },
        ...(user.tenantId ? { tenantId: user.tenantId } : {})
      },
      data: {
        referralBalance: { decrement: transferAmount }
      }
    });

    if (updated.count === 0) {
      throw new Error("Недостаточно средств на реферальном балансе");
    }

    // 2. Safe main balance credit via WalletOps primitive with unique transfer ID
    await WalletOps.credit(
      tx,
      session.userId,
      transferAmount,
      `Перевод реферального баланса на основной`,
      { 
        idempotencyKey: `referral-transfer-${session.userId}-${transferId}`,
        tenantId: user.tenantId || 'smmplan'
      }
    );

    await tx.payment.create({
      data: {
        userId: session.userId,
        amount: transferAmount,
        currency: "RUB",
        status: "COMPLETED",
        gateway: "referral_transfer",
        gatewayId: transferId,
        tenantId: user.tenantId || 'smmplan'
      }
    });
  }, { isolationLevel: 'Serializable' });

  return { success: true, amount: transferAmount };
}
