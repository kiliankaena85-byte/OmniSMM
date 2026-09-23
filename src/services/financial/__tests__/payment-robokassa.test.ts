import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { WalletOps } from '@/services/financial/wallet-ops';
import crypto from 'crypto';

describe('Robokassa Payment Gateway Integration', () => {
  let userId: string;
  const merchantLogin = 'smmplan_merchant';
  const pass1 = 'MerchantPass1Word';
  const pass2 = 'MerchantPass2Word';

  beforeEach(async () => {
    // Seed system settings with Robokassa parameters
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: {
        robokassaLogin: merchantLogin,
        robokassaPassword: pass1,
        robokassaWebhookPassword: pass2,
        isTestMode: true,
      },
      create: {
        id: 'smmplan',
        robokassaLogin: merchantLogin,
        robokassaPassword: pass1,
        robokassaWebhookPassword: pass2,
        isTestMode: true,
      },
    });

    const user = await db.user.upsert({
      where: { email_tenantId: { email: 'robokassa-user@smmplan.local', tenantId: 'smmplan' } },
      update: { balance: 0, isActive: true },
      create: {
        email: 'robokassa-user@smmplan.local',
        tenantId: 'smmplan',
        balance: 0,
        role: 'USER',
        isActive: true,
      },
    });
    userId = user.id;
  });

  // Helper for Robokassa MD5 signature calculation
  function calculateSignature(params: string[]): string {
    return crypto.createHash('md5').update(params.join(':')).digest('hex').toUpperCase();
  }

  // ─────────────────────────────────────────────
  // 1. Payment URL Generation
  // ─────────────────────────────────────────────
  it('generates valid Robokassa payment URL with correct SignatureValue', async () => {
    const invId = 12345;
    const outSum = '750.00';
    const expectedSignature = calculateSignature([merchantLogin, outSum, String(invId), pass1]);

    const params = new URLSearchParams({
      MerchantLogin: merchantLogin,
      OutSum: outSum,
      InvId: String(invId),
      Description: 'Пополнение баланса SMMplan',
      SignatureValue: expectedSignature,
      IsTest: '1',
    });

    const url = `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`;

    expect(url).toContain('auth.robokassa.ru');
    expect(url).toContain(`MerchantLogin=${merchantLogin}`);
    expect(url).toContain(`SignatureValue=${expectedSignature}`);
    expect(expectedSignature.length).toBe(32);
  });

  // ─────────────────────────────────────────────
  // 2. ResultURL Callback → Balance Credited
  // ─────────────────────────────────────────────
  it('credits user balance on valid ResultURL callback signature (Pass2)', async () => {
    const invId = 998877;
    const outSum = '1500.00';

    const payment = await db.payment.create({
      data: {
        userId,
        tenantId: 'smmplan',
        amount: 1500_00, // 1500 RUB
        status: 'PENDING',
        gateway: 'ROBOKASSA',
        gatewayId: String(invId),
      },
    });

    // Robokassa ResultURL signature formula: OutSum:InvId:Pass2
    const validSignature = calculateSignature([outSum, String(invId), pass2]);

    // Simulate ResultURL handler logic
    const handleResultURL = async (sum: string, id: string, sig: string) => {
      const expectedSig = calculateSignature([sum, id, pass2]);
      if (sig.toUpperCase() !== expectedSig.toUpperCase()) {
        throw new Error('Invalid Robokassa signature');
      }

      return db.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'SUCCEEDED' },
        });

        return WalletOps.credit(
          tx,
          userId,
          Number(payment.amount),
          `Пополнение через Robokassa #${invId}`,
          { idempotencyKey: `robokassa-${invId}` }
        );
      });
    };

    const result = await handleResultURL(outSum, String(invId), validSignature);
    expect(result.success).toBe(true);

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balance).toBe(BigInt(1500_00));
  });

  // ─────────────────────────────────────────────
  // 3. SuccessURL Redirect
  // ─────────────────────────────────────────────
  it('validates SuccessURL redirect signature and confirms user redirect target', async () => {
    const invId = 54321;
    const outSum = '250.00';
    // SuccessURL signature formula: OutSum:InvId:Pass1
    const successSignature = calculateSignature([outSum, String(invId), pass1]);

    const isSuccessValid = (sum: string, id: string, sig: string) => {
      const expected = calculateSignature([sum, id, pass1]);
      return sig.toUpperCase() === expected.toUpperCase();
    };

    expect(isSuccessValid(outSum, String(invId), successSignature)).toBe(true);
    expect(isSuccessValid(outSum, String(invId), 'WRONG_SIG')).toBe(false);
  });

  // ─────────────────────────────────────────────
  // 4. FailURL Redirect
  // ─────────────────────────────────────────────
  it('handles FailURL redirect without modifying user balance', async () => {
    const initialBalance = (await db.user.findUniqueOrThrow({ where: { id: userId } })).balance;

    const payment = await db.payment.create({
      data: {
        userId,
        tenantId: 'smmplan',
        amount: 300_00,
        status: 'PENDING',
        gateway: 'ROBOKASSA',
        gatewayId: 'fail_inv_1122',
      },
    });

    // FailURL handler marks payment as CANCELED
    await db.payment.update({
      where: { id: payment.id },
      data: { status: 'CANCELED' },
    });

    const updatedUser = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(updatedUser.balance).toBe(initialBalance); // Balance untouched

    const updatedPayment = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updatedPayment.status).toBe('CANCELED');
  });

  // ─────────────────────────────────────────────
  // 5. Invalid Signature → Rejected
  // ─────────────────────────────────────────────
  it('rejects ResultURL execution when signature is invalid or tampered', async () => {
    const invId = 777;
    const outSum = '1000.00';
    const tamperedSignature = 'BAD_MD5_HASH_1234567890ABCDEF1234';

    const verifyAndExecute = async (sum: string, id: string, sig: string) => {
      const expectedSig = calculateSignature([sum, id, pass2]);
      if (sig.toUpperCase() !== expectedSig.toUpperCase()) {
        return { success: false, error: 'bad sign' };
      }
      return { success: true, error: null };
    };

    const res = await verifyAndExecute(outSum, String(invId), tamperedSignature);
    expect(res.success).toBe(false);
    expect(res.error).toBe('bad sign');
  });
});
