import { db } from '../src/lib/db';
import { createDemoPaymentAction } from '../src/actions/order/demo-payment.action';
import { PaymentGatewayFactory } from '../src/services/financial/payment-gateway.service';

async function testBalanceTabPayments() {
  console.log('================================================================');
  console.log('🔍 AUDITING BALANCE TAB & PAYMENT BUTTONS (YOOKASSA & SBP)');
  console.log('================================================================\n');

  try {
    // 1. Test Demo Cabinet Balance Tab - YooKassa
    console.log('📌 Testing 1: Demo Cabinet Balance Tab -> YooKassa');
    const demoYoo = await createDemoPaymentAction({
      amountRub: 150,
      description: 'Пополнение баланса (SMMplan Demo)',
      gateway: 'yookassa'
    });
    console.log('   Demo YooKassa Result:', demoYoo);
    if (!demoYoo.success || !demoYoo.paymentUrl?.startsWith('http')) {
      throw new Error(`Demo YooKassa failed: ${JSON.stringify(demoYoo)}`);
    }
    console.log('   ✅ YooKassa Button OK: URL =', demoYoo.paymentUrl);

    // 2. Test Demo Cabinet Balance Tab - SBP
    console.log('\n📌 Testing 2: Demo Cabinet Balance Tab -> SBP (via YooKassa)');
    const demoSbp = await createDemoPaymentAction({
      amountRub: 250,
      description: 'Пополнение баланса СБП (SMMplan Demo)',
      gateway: 'sbp' as any
    });
    console.log('   Demo SBP Result:', demoSbp);
    if (!demoSbp.success || !demoSbp.paymentUrl?.startsWith('http')) {
      throw new Error(`Demo SBP failed: ${JSON.stringify(demoSbp)}`);
    }
    console.log('   ✅ SBP Button OK: URL =', demoSbp.paymentUrl);

    // 3. Test Demo Cabinet Balance Tab - Robokassa
    console.log('\n📌 Testing 3: Demo Cabinet Balance Tab -> Robokassa');
    const demoRobo = await createDemoPaymentAction({
      amountRub: 300,
      description: 'Пополнение баланса Robokassa (SMMplan Demo)',
      gateway: 'robokassa'
    });
    console.log('   Demo Robokassa Result:', demoRobo);
    if (!demoRobo.success || !demoRobo.paymentUrl?.startsWith('http')) {
      throw new Error(`Demo Robokassa failed: ${JSON.stringify(demoRobo)}`);
    }
    console.log('   ✅ Robokassa Button OK: URL =', demoRobo.paymentUrl);

    // 4. Test Real YooKassa Gateway creation
    console.log('\n📌 Testing 4: Real YooKassa Gateway Direct Payment Creation');
    const testUser = await db.user.create({
      data: {
        email: `balance_tester_${Date.now()}@smmplan.pro`,
        passwordHash: 'TEST_HASH',
        role: 'USER'
      }
    });

    const payment = await db.payment.create({
      data: {
        userId: testUser.id,
        amount: 50000,
        currency: 'RUB',
        status: 'PENDING',
        gateway: 'yookassa',
        consentIp: '127.0.0.1',
        consentUserAgent: 'Balance-Tab-Tester/1.0',
        consentVersion: 'terms:v1'
      }
    });

    const yooGw = PaymentGatewayFactory.getGateway('yookassa');
    const yooRes = await yooGw.createPayment({
      paymentId: payment.id,
      userId: testUser.id,
      amountRub: 500,
      email: testUser.email,
      successUrl: 'https://smmplan.pro/dashboard/add-funds?success=1',
      description: 'Пополнение баланса #test',
      isTestMode: true
    });

    console.log('   Real YooKassa Gateway Result:', yooRes);
    if (!yooRes.paymentUrl || !yooRes.paymentUrl.includes('yoomoney.ru')) {
      throw new Error(`Real YooKassa failed: ${JSON.stringify(yooRes)}`);
    }
    console.log('   ✅ Real YooKassa Gateway OK: URL =', yooRes.paymentUrl);

    // Clean up
    await db.payment.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
    await db.user.deleteMany({ where: { id: testUser.id } }).catch(() => {});

    console.log('\n================================================================');
    console.log('🎉 BALANCE TAB & YOOKASSA/SBP BUTTONS 100% OPERATIONAL!');
    console.log('================================================================\n');

  } catch (error) {
    console.error('❌ BALANCE TAB TEST FAILED:', error);
    process.exitCode = 1;
  }
}

testBalanceTabPayments();
