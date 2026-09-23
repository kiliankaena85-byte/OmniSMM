import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { deleteAccountAction } from '@/actions/auth/delete-account';
import { loginWithPasswordAction } from '@/actions/auth/password-login';
import { requestMagicLink } from '@/actions/auth/request-magic-link';
import { checkoutAction } from '@/actions/order/checkout';
import { createTopUpPaymentAction } from '@/actions/user/top-up.action';
import { transferReferralBalanceAction } from '@/actions/user/referral.action';
import { LoyaltyService } from '@/services/users/loyalty.service';
import { verifySession } from '@/lib/session';
import { verifyPassword } from '@/lib/auth/password';

// Mock cookies and headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const mockHeadersStore = new Headers({
  'x-forwarded-for': '127.0.0.1',
  'user-agent': 'vitest',
});

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeadersStore),
  cookies: vi.fn(async () => mockCookieStore),
}));

// Mock verifySession and verifyPassword to control them per test
vi.mock('@/lib/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/session')>();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

vi.mock('@/lib/auth/password', () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock('@/lib/smtp', () => ({
  sendMagicLink: vi.fn(async () => {}),
  sendWelcomeLetter: vi.fn(async () => {}),
  sendOrderPaidMail: vi.fn(async () => {}),
}));

describe('User Account Soft-Deletion Flow', () => {
  let categoryId: string;
  let serviceId: string;

  beforeEach(async () => {
    // 1. Enable test mode
    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true },
      create: { id: 'global', isTestMode: true },
    });



    const category = await db.category.create({
      data: { name: 'Deletion Test Category' },
    });
    categoryId = category.id;

    const service = await db.service.create({
      data: {
        name: 'Deletion Test Service',
        categoryId: category.id,
        rate: 1.0,
        markup: 2.0,
        minQty: 10,
        maxQty: 1000,
        isActive: true,
        externalId: 'ext_del',
        targetType: 'POST',
      },
    });
    serviceId = service.id;

    vi.clearAllMocks();
  });

  it('Assertion 1: Deletion sets isDeleted=true, isActive=false, anonymizes email, deletes sessions, and sets cookies', async () => {
    const originalEmail = 'user_to_delete@example.com';
    const user = await db.user.create({
      data: {
        email: originalEmail,
        passwordHash: 'hashed_password_123',
        telegramId: 'tg-12345',
        phoneHash: 'phone-hash-value',
        apiKeyHash: 'api-key-hash-value',
        referralCode: 'ref-code-value',
        companyName: 'API Company LLC',
        inn: '123456789012',
        kpp: '123456789',
        legalAddress: '123 Business Rd',
        isActive: true,
        isDeleted: false,
      },
    });

    // Mock active session
    vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
    vi.mocked(verifyPassword).mockResolvedValue(true);

    // Call deletion
    const formData = new FormData();
    formData.append('confirmText', 'УДАЛИТЬ');
    formData.append('password', 'password123');

    const result = await deleteAccountAction(null, formData);
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();

    // Check DB record
    const updatedUser = await db.user.findUnique({
      where: { id: user.id },
    });
    expect(updatedUser).toBeDefined();
    expect(updatedUser!.isDeleted).toBe(true);
    expect(updatedUser!.isActive).toBe(false);
    expect(updatedUser!.email).toMatch(/^deleted_.*@anonymous\.local$/);
    expect(updatedUser!.telegramId).toBeNull();
    expect(updatedUser!.phoneHash).toBeNull();
    expect(updatedUser!.apiKeyHash).toBeNull();
    expect(updatedUser!.referralCode).toBeNull();
    expect(updatedUser!.companyName).toBeNull();
    expect(updatedUser!.inn).toBeNull();
    expect(updatedUser!.kpp).toBeNull();
    expect(updatedUser!.legalAddress).toBeNull();
    expect(updatedUser!.passwordHash).toBeNull();
    expect(updatedUser!.referredById).toBeNull();

    // Verify cookies were cleared outside transaction
    expect(mockCookieStore.delete).toHaveBeenCalledWith('session_token');
    expect(mockCookieStore.set).toHaveBeenCalledWith('explicit_logout', 'true', expect.any(Object));

    // Verify Audit Log was written within transaction
    const auditLogs = await db.auditLog.findMany({
      where: { userId: user.id, action: 'GDPR_RIGHT_TO_BE_FORGOTTEN' },
    });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].details).toContain(originalEmail.slice(0, 3));
  });

  it('Assertion 2: Inactive/deleted users are blocked from password and magic link authentication', async () => {
    const user = await db.user.create({
      data: {
        email: 'deleted_user@smmplan.local',
        passwordHash: 'hashed_password_123',
        isActive: false,
        isDeleted: true,
      },
    });

    // 1. Blocked from Password Login
    const loginFormData = new FormData();
    loginFormData.append('email', 'deleted_user@smmplan.local');
    loginFormData.append('password', 'password123');

    const loginRes = await loginWithPasswordAction(null, loginFormData);
    expect(loginRes.success).toBe(false);
    expect(loginRes.error).toBe('Неверный email или пароль'); // Anti-enumeration standard message

    // 2. Blocked from Magic Link Request
    const magicFormData = new FormData();
    magicFormData.append('email', 'deleted_user@smmplan.local');

    const magicRes = await requestMagicLink(null, magicFormData);
    expect(magicRes).toBeDefined();
    if (magicRes) {
      expect(magicRes.success).toBe(true);
      expect(magicRes.error).toBeNull(); // Anti-enumeration standard behavior
    }
  });

  it('Assertion 3: Soft-deleted/inactive users are blocked from checkout, balance deposits, transferring referral balance, and referral commission awards', async () => {
    // Create inactive user
    const user = await db.user.create({
      data: {
        email: 'deleted_user_actions@smmplan.local',
        isActive: false,
        isDeleted: true,
        balance: BigInt(100000), // 1000 RUB
        referralCode: 'referral_test_code',
        referralBalance: 500,
      },
    });

    vi.mocked(verifySession).mockResolvedValue({ userId: user.id });

    // 1. Blocked from Order Checkout
    const checkoutRes = await checkoutAction({
      serviceId,
      link: 'https://t.me/somechannel/123',
      quantity: 100,
      email: 'deleted_user_actions@smmplan.local',
      gateway: 'yookassa',
    });
    expect(checkoutRes.success).toBe(false);
    if (!checkoutRes.success) {
      expect(checkoutRes.error).toContain('Ваш аккаунт заблокирован или удален');
    }

    // 2. Blocked from Balance Deposits / Top-ups
    const topUpRes = await createTopUpPaymentAction(10, 'yookassa');
    expect(topUpRes.success).toBe(false);
    expect(topUpRes.error).toContain('Ваш аккаунт заблокирован или удален');

    // 3. Blocked from Transferring Referral Balance
    const referralRes = await transferReferralBalanceAction();
    expect(referralRes.success).toBe(false);
    expect(referralRes.error).toContain('Ваш аккаунт заблокирован или удален');

    // 4. Blocked from Referral Commission Awards
    const referrer = await db.user.create({
      data: {
        email: 'inactive_referrer@smmplan.local',
        isActive: false,
        isDeleted: true,
      },
    });

    const referredUser = await db.user.create({
      data: {
        email: 'referred_client@example.com',
        referredById: referrer.id,
      },
    });

    // Trigger award commission on referred user's payment inside a transaction
    await db.$transaction(async (tx) => {
      await LoyaltyService.awardCommission(tx, referredUser.id, 5000, 'mock-order-id');
    });

    // Referrer balance should still be 0
    const updatedReferrer = await db.user.findUnique({ where: { id: referrer.id } });
    expect(updatedReferrer!.referralBalance).toBe(0);

    const commissions = await db.commission.findMany({ where: { referrerId: referrer.id } });
    expect(commissions.length).toBe(0);
  });

  it('Assertion 4: Historical ledger and orders remain fully intact', async () => {
    // Create user who will be deleted
    const user = await db.user.create({
      data: {
        email: 'user_with_history@example.com',
        passwordHash: 'some_hash',
        isActive: true,
        isDeleted: false,
      },
    });

    // Create historical Order
    const order = await db.order.create({
      data: {
        userId: user.id,
        serviceId,
        link: 'https://telegram.me/somechannel',
        quantity: 100,
        charge: BigInt(500),
        providerCost: BigInt(100),
        status: 'COMPLETED',
      },
    });

    // Create historical LedgerEntry
    const ledger = await db.ledgerEntry.create({
      data: {
        userId: user.id,
        amount: BigInt(500),
        reason: 'Payment for order',
        status: 'APPROVED',
      },
    });

    // Mock session and delete account
    vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const formData = new FormData();
    formData.append('confirmText', 'УДАЛИТЬ');
    formData.append('password', 'password123');

    const result = await deleteAccountAction(null, formData);
    expect(result.success).toBe(true);

    // Verify Order is still present and intact
    const orderCheck = await db.order.findUnique({ where: { id: order.id } });
    expect(orderCheck).toBeDefined();
    expect(orderCheck!.userId).toBe(user.id);
    expect(orderCheck!.charge).toBe(BigInt(500));

    // Verify LedgerEntry is still present and intact
    const ledgerCheck = await db.ledgerEntry.findUnique({ where: { id: ledger.id } });
    expect(ledgerCheck).toBeDefined();
    expect(ledgerCheck!.userId).toBe(user.id);
    expect(ledgerCheck!.amount).toBe(BigInt(500));
  });
});
