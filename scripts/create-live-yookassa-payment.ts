import { db } from '../src/lib/db';
import { PaymentGatewayFactory } from '../src/services/financial/payment-gateway.service';

async function main() {
  // 1. Get first active user
  const user = await db.user.findFirst({
    where: { isDeleted: false, isActive: true }
  });

  if (!user) {
    console.error("No active user found in DB to associate with the payment!");
    return;
  }

  console.log(`Associated test user: ID=${user.id}, Email=${user.email}`);

  // Get initial balance
  const initialBalance = Number(user.balance ?? 0) / 100;
  console.log(`Initial User Balance: ${initialBalance} RUB`);

  // 2. Create local Payment record in DB
  const amountRub = 10; // Minimum allowed amount
  const amountCents = amountRub * 100;

  const payment = await db.payment.create({
    data: {
      userId: user.id,
      amount: amountCents,
      currency: "RUB",
      status: "PENDING",
      gateway: "yookassa",
      consentIp: "127.0.0.1",
      consentUserAgent: "Mozilla/5.0 NodeJS CLI",
      consentVersion: "v1.0"
    }
  });

  console.log(`Created local payment record: ID=${payment.id}, Amount=${amountRub} RUB`);

  // 3. Request YooKassa payment URL
  const gatewaySvc = PaymentGatewayFactory.getGateway('yookassa');
  
  // Note: we set successUrl to redirect to SMMplan landing / success
  const successUrl = "http://localhost:3000/success";

  try {
    console.log("Requesting YooKassa API to generate payment session...");
    const gatewayResult = await gatewaySvc.createPayment({
      paymentId: payment.id,
      userId: user.id,
      amountRub,
      email: user.email,
      successUrl,
      description: `Пополнение баланса (Счёт: ${payment.id})`,
      isTestMode: false, // Ensure it hits the real YooKassa API (using test credentials)
      metadata: { type: "deposit" }
    });

    console.log("YooKassa Response received!");
    console.log(`Remote Payment ID: ${gatewayResult.remoteGatewayId}`);
    
    // Update local payment with YooKassa IDs
    await db.payment.update({
      where: { id: payment.id },
      data: {
        gatewayId: gatewayResult.remoteGatewayId,
        checkoutUrl: gatewayResult.paymentUrl
      }
    });

    console.log("\n==================================================================");
    console.log("ЖМИ СЮДА ДЛЯ ОПЛАТЫ (ОТКРОЙ В СВОЕМ БРАУЗЕРЕ):");
    console.log(gatewayResult.paymentUrl);
    console.log("==================================================================\n");
    console.log("Для прохождения теста на странице ЮKassa выберите способ оплаты и нажмите 'Успешный платеж'.");
    console.log("Ждем поступления вебхука на локальный сервер... Нажмите Ctrl+C для выхода.");

    // 4. Poll database to check if balance has updated
    let balanceUpdated = false;
    for (let i = 0; i < 150; i++) { // Poll for up to 5 minutes (150 * 2s)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const currentUser = await db.user.findUnique({
        where: { id: user.id }
      });
      const currentBalance = Number(currentUser?.balance ?? 0) / 100;
      
      if (currentBalance > initialBalance) {
        console.log(`\n🎉 УСПЕХ! Баланс успешно пополнен через вебхук!`);
        console.log(`Новый баланс пользователя: ${currentBalance} RUB (Было: ${initialBalance} RUB, Зачислено: +${currentBalance - initialBalance} RUB)`);
        balanceUpdated = true;
        break;
      }
    }

    if (!balanceUpdated) {
      console.log("\nТайм-аут ожидания оплаты (5 минут). Проверьте логи Next.js и туннеля, если зачисление не произошло.");
    }

  } catch (error) {
    console.error("Failed to execute YooKassa flow:", error);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
