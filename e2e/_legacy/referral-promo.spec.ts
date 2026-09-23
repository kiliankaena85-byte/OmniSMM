import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

const prisma = new PrismaClient();

const TIMESTAMP = Date.now();
const REF_CODE = `E2E-REF-${TIMESTAMP}`;
const PROMO_CODE = `E2EPROMO${TIMESTAMP}`;
const PROMO_AMOUNT = 50000; // 500 RUB (in cents)

const REFERRER_EMAIL = `referrer-${TIMESTAMP}@example.com`;
const REFERRED_EMAIL = `referred-${TIMESTAMP}@example.com`;

test.describe('Referral and Promo System', () => {
  let referrerId: string;
  let referredId: string;
  let sessionToken: string;

  test.beforeAll(async () => {
    // 1. Create a Referrer
    const referrer = await prisma.user.create({
      data: {
        email: REFERRER_EMAIL,
        role: 'USER',
        referralCode: REF_CODE,
      }
    });
    referrerId = referrer.id;

    // 2. Create a Promo Code (VOUCHER)
    await prisma.promoCode.create({
      data: {
        code: PROMO_CODE,
        type: 'VOUCHER',
        amount: PROMO_AMOUNT,
        discountPercent: 0,
        maxUses: 5,
        isActive: true,
      }
    });

    // 3. Create a Referred User directly (simulating successful registration via ?ref= link)
    const referred = await prisma.user.create({
      data: {
        email: REFERRED_EMAIL,
        role: 'USER',
        referredById: referrer.id, // Linking referral!
        balance: 0,
      }
    });
    referredId = referred.id;

    // 4. Create Session for the Referred user to test Promo Code Activation
    const session = await prisma.session.create({
      data: {
        userId: referred.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    const { getEncodedKey } = await import('../src/lib/session-edge');
    const encodedKey = getEncodedKey();

    sessionToken = await new SignJWT({
      sessionId: session.id,
      userId: referred.id,
      role: 'USER',
      tenantId: 'smmplan'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(encodedKey);
  });

  test('Should track referral code in cookies via middleware', async ({ page }) => {
    // 1. Visit landing with referral code
    await page.goto(`/?ref=${REF_CODE}`);
    
    // 2. The middleware should set the 'ref' cookie
    const cookies = await page.context().cookies();
    const refCookie = cookies.find(c => c.name === 'ref');
    
    expect(refCookie).toBeDefined();
    expect(refCookie?.value).toBe(REF_CODE);
  });

  test('Should activate promo code (start bonus) in dashboard', async ({ page, context }) => {
    // 1. Inject auth session for the referred user
    const expiryUnix = Math.floor(Date.now() / 1000) + 7 * 86400;
    await context.addCookies([
      {
        name: 'session_token',
        value: sessionToken,
        domain: '127.0.0.1',
        path: '/',
        expires: expiryUnix,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
      {
        name: 'session_token',
        value: sessionToken,
        domain: 'localhost',
        path: '/',
        expires: expiryUnix,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
      {
        name: 'x_tenant',
        value: 'smmplan',
        domain: '127.0.0.1',
        path: '/',
        expires: expiryUnix,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
      {
        name: 'x_tenant',
        value: 'smmplan',
        domain: 'localhost',
        path: '/',
        expires: expiryUnix,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      }
    ]);

    // 2. Go to Add Funds page where Promo Code activation is located
    await page.goto('/dashboard/add-funds');
    
    // 3. Enter Promo Code
    await page.fill('input[placeholder="PROMOCODE"]', PROMO_CODE);
    await page.click('button:has-text("Применить")');

    // 4. Wait for success message
    await expect(page.getByText('Промокод активирован! Начислено 500.00 ₽')).toBeVisible();

    // 5. Verify balance was updated in DB
    const updatedUser = await prisma.user.findUnique({ where: { id: referredId } });
    expect(Number(updatedUser?.balance)).toBe(PROMO_AMOUNT);

    // 6. Verify LedgerEntry was created
    const ledger = await prisma.ledgerEntry.findFirst({
      where: { userId: referredId, amount: PROMO_AMOUNT, reason: { contains: PROMO_CODE } }
    });
    expect(ledger).toBeDefined();

    // 7. Try activating again to check idempotency (should fail)
    await page.fill('input[placeholder="PROMOCODE"]', PROMO_CODE);
    await page.click('button:has-text("Применить")');
    await expect(page.getByText('Вы уже активировали этот промокод')).toBeVisible();
  });
});

