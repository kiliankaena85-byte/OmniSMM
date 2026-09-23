import { paymentService } from '../src/services/financial/payment.service';
import { db } from '../src/lib/db';

export {};

async function main() {
  const gatewayId = "31dae550-000f-5000-b000-1d634f40f08a";
  const internalPaymentId = "cmr65pvtr00015yytm1bvcdt4";
  const amountCents = 1000; // 10 RUB
  const userId = "cmr5t0aig000aaoz13bjytiyr";

  console.log(`Manually triggering verification for YooKassa Payment: ${gatewayId}`);
  
  try {
    const success = await paymentService.confirmPayment(
      gatewayId,
      amountCents,
      userId,
      false,
      'yookassa',
      internalPaymentId
    );

    if (success) {
      console.log("PAYMENT CONFIRMATION SUCCESSFUL!");
      // Check user balance now
      const user = await db.user.findUnique({
        where: { id: userId }
      });
      const balanceNum = typeof user?.balance === 'bigint' ? Number(user.balance) : (user?.balance || 0);
      console.log(`New balance for user ${user?.email}: ${user?.balance?.toString()} Cents (${balanceNum / 100} RUB)`);
    } else {
      console.error("PAYMENT CONFIRMATION FAILED (check logs/gateway status)");
    }
  } catch (err) {
    console.error("Error during manual confirmation:", err);
  }
}

main().catch(console.error);
