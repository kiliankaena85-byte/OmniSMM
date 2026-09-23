// Mock server-only before any other imports
import Module from "module";
const origReq = (Module as any).prototype.require;
(Module as any).prototype.require = function (id: string) {
  if (id === "server-only") return {};
  return origReq.apply(this, arguments);
};

import 'dotenv/config';

async function main() {
  const { db } = await import('../src/lib/db');
  const { UnifiedPaymentService } = await import('../src/services/financial/unified-payment.service');
  const user = await db.user.findFirst();
  if (!user) {
    console.log('No user found');
    return;
  }
  console.log('Testing YooKassa with user:', user.id, user.email);
  try {
    const res = await UnifiedPaymentService.createPayment(
      undefined,
      user.id,
      100, // 100 rub
      'Пополнение тестовое',
      { source: 'BOT', type: 'deposit' },
      'yookassa'
    );
    console.log('Payment result:', res);
  } catch (err: any) {
    console.error('Payment failed with error:', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await db.$disconnect();
  }
}

main().catch(console.error);
