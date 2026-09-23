/**
 * Whitelisted Domains and Protocol Validator for Safe Payment Redirects
 * Guards against Open Redirect vulnerabilities while seamlessly supporting
 * all acquiring partners (YooKassa, YooMoney, CryptoBot, RoboKassa, etc.).
 */

export const PROD_ALLOWED_PAYMENT_DOMAINS = [
  'yookassa.ru',
  'yoomoney.ru',
  'crypto.bot',
  'crypt.bot',
  't.me',
  'telegram.me',
  'robokassa.ru',
  'robokassa.com',
  'smmplan.pro',
  'smmflux.ru',
  'ts.net',
] as const;

export const ALLOWED_PAYMENT_DOMAINS: string[] = [
  ...PROD_ALLOWED_PAYMENT_DOMAINS
];

export const ALLOWED_RELATIVE_PATHS = [
  '/success',
  '/payment-redirect',
  '/dashboard',
  '/support/payment-error',
] as const;

export function isAllowedPaymentUrl(rawUrl: string, currentOrigin?: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  // 1. Explicitly allow safe internal relative paths (excluding protocol-relative //)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }

  try {
    const origin = currentOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://smmplan.pro');
    const parsed = new URL(trimmed, origin);

    // 2. Protocols must be strictly http or https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    // 3. Same-origin is always safe
    if (parsed.origin === origin) {
      return true;
    }

    const hostname = parsed.hostname.toLowerCase();

    // 4. Same hostname as current browser window (e.g. cloudflare tunnels, test domains)
    if (typeof window !== 'undefined' && window.location.hostname) {
      const windowHost = window.location.hostname.toLowerCase();
      if (hostname === windowHost || hostname.endsWith('.' + windowHost)) {
        return true;
      }
    }

    // 5. Localhost & Loopback addresses
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      return true;
    }

    // 6. Domain whitelist matching (exact or subdomain)
    return ALLOWED_PAYMENT_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

export function executePaymentRedirect(paymentUrl: string): boolean {
  if (typeof window === 'undefined') return false;

  if (isAllowedPaymentUrl(paymentUrl, window.location.origin)) {
    window.location.href = paymentUrl.trim();
    return true;
  }

  console.error('[PaymentRedirect] Blocked unauthorized or malformed payment URL:', paymentUrl, {
    currentOrigin: window.location.origin,
    currentHost: window.location.hostname
  });
  return false;
}
