import { describe, it, expect } from 'vitest';
import { isAllowedPaymentUrl, executePaymentRedirect, ALLOWED_PAYMENT_DOMAINS } from '@/utils/payment-redirect';

describe('Payment Redirect & Gateway Whitelist Guard', () => {
  it('1. MUST allow all legitimate YooMoney and YooKassa acquiring URLs', () => {
    const validYooKassaUrls = [
      'https://yoomoney.ru/checkout/payments/v2/contract?orderId=3223a552-000f-5001-9000-14d83a312dfa',
      'https://yookassa.ru/checkout/payments/v2/contract?orderId=12345',
      'https://test.yookassa.ru/checkout/payments/v2',
      'https://pay.yoomoney.ru/bill',
    ];

    for (const url of validYooKassaUrls) {
      expect(isAllowedPaymentUrl(url)).toBe(true);
    }
  });

  it('2. MUST allow CryptoBot and RoboKassa URLs', () => {
    const validGatewayUrls = [
      'https://pay.crypto.bot/i/123456',
      'https://pay.crypt.bot/i/654321',
      'https://crypto.bot/app?startapp=invoice_123',
      'https://t.me/CryptoBot?start=invoice_123',
      'https://auth.robokassa.ru/Merchant/Index.aspx?MerchantLogin=smmplan&OutSum=515.00',
      'https://robokassa.ru/pay',
    ];

    for (const url of validGatewayUrls) {
      expect(isAllowedPaymentUrl(url)).toBe(true);
    }
  });

  it('3. MUST allow relative and local internal paths', () => {
    const internalPaths = [
      '/success?orderId=123',
      '/payment-redirect?id=pay_456',
      '/dashboard?paymentId=pay_789',
      'https://smmplan.pro/success',
      'https://smmflux.ru/success',
      'http://localhost:3000/success',
    ];

    for (const path of internalPaths) {
      expect(isAllowedPaymentUrl(path)).toBe(true);
    }
  });

  it('4. MUST strictly reject malicious domains and Open Redirect attacks', () => {
    const maliciousUrls = [
      'https://evil.com/phishing',
      'https://yookassa.ru.evil.com/fake-login',
      'https://fake-yoomoney.ru/steal-card',
      'javascript:alert(document.cookie)',
      'data:text/html,<script>alert(1)</script>',
      '//attacker.com/evil',
      'ftp://yookassa.ru/malware',
    ];

    for (const url of maliciousUrls) {
      expect(isAllowedPaymentUrl(url)).toBe(false);
    }
  });

  it('5. MUST contain exactly expected trusted payment domains', () => {
    expect(ALLOWED_PAYMENT_DOMAINS).toContain('yookassa.ru');
    expect(ALLOWED_PAYMENT_DOMAINS).toContain('yoomoney.ru');
    expect(ALLOWED_PAYMENT_DOMAINS).toContain('crypto.bot');
    expect(ALLOWED_PAYMENT_DOMAINS).toContain('t.me');
    expect(ALLOWED_PAYMENT_DOMAINS).toContain('robokassa.ru');
  });
});
