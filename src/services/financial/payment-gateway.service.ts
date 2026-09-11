import { db } from '@/lib/db';
import { getBaseUrlAsync } from '@/utils/get-base-url';
import { SettingsProvider } from '@/lib/settings';
import { WalletOps } from './wallet-ops';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MutexManager } from '@/lib/redis-lock';
import crypto from 'crypto';
import { UniversalNetworkRouter } from '@/lib/network/network-router';

export const VAT_THRESHOLD_KOPECKS = BigInt(20_000_000) * BigInt(100); // 20,000,000 RUB in kopecks (2,000,000,000 cents)

export interface TenantPaymentContext {
  readonly tenantId: string;
  readonly currency?: 'RUB';
  readonly legalCompanyName?: string;
  readonly legalCompanyInn?: string;
  readonly legalCompanyOgrnip?: string;
  readonly legalCompanyAddress?: string;
  readonly supportEmail?: string;
  readonly privacyEmail?: string;
  readonly yookassaShopId?: string;
  readonly yookassaSecretKey?: string;
  readonly fiscalTaxSystemCode?: number;
  readonly fiscalVatCode?: number;
  readonly autoVatThreshold?: boolean;
}

const vatThresholdCache: Map<string, { result: boolean; expiresAt: number }> = new Map();

/**
 * Invalidate cached VAT threshold status (e.g. after a refund or new legal settings)
 */
export function invalidateVatThresholdCache(tenantId?: string): void {
  if (tenantId) {
    vatThresholdCache.delete(tenantId);
  } else {
    vatThresholdCache.clear();
  }
}

/**
 * ExactMath String Formatter: Formats BigInt kopecks into human-readable RUB string without Number conversion.
 * Avoids IEEE-754 precision loss on large values.
 */
export function formatKopecksAsRubString(kopecks: bigint): string {
  if (kopecks < BigInt(0)) {
    throw new Error('Денежная сумма в копейках не может быть отрицательной');
  }
  const rubles = kopecks / BigInt(100);
  const remainingCents = kopecks % BigInt(100);
  const centsFormatted = remainingCents < BigInt(10) ? `0${remainingCents}` : `${remainingCents}`;
  
  const rublesStr = rubles.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${rublesStr}.${centsFormatted} ₽`;
}

/**
 * PCI DSS Secret Masking Helper: Returns a copy of the payment context with sensitive keys redacted for logging.
 */
export function toSafePaymentContextLog(ctx: TenantPaymentContext): Record<string, unknown> {
  return {
    ...ctx,
    yookassaSecretKey: ctx.yookassaSecretKey ? '[REDACTED_SECRET]' : undefined,
  };
}

/**
 * 54-ФЗ / 176-ФЗ / 425-ФЗ Fiscalization: Checks whether annual revenue exceeded 20M RUB 
 * for a specific tenant / legal entity (tax exempt threshold under ст. 145 НК РФ).
 * Net Revenue Accounting: Gross SUCCEEDED payments minus REFUND transactions in BigInt kopecks.
 * Cached for 1 hour per tenant to reduce database aggregate load.
 */
export async function checkVatThreshold(tenantId: string = 'smmplan'): Promise<boolean> {
  const cleanTenant = tenantId || 'smmplan';
  const now = Date.now();
  const cached = vatThresholdCache.get(cleanTenant);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);

  // 1. Gross revenue
  const grossResult = await db.payment.aggregate({
    _sum: { amount: true },
    where: {
      tenantId: cleanTenant,
      status: 'SUCCEEDED',
      createdAt: { gte: startOfYear }
    }
  });
  const grossKopecks = BigInt(grossResult._sum?.amount || 0);

  // 2. Deduct refunds from net taxable turnover
  const refundResult = await db.ledgerEntry.aggregate({
    _sum: { amount: true },
    where: {
      tenantId: cleanTenant,
      transactionType: 'REFUND',
      createdAt: { gte: startOfYear }
    }
  }).catch(() => ({ _sum: { amount: BigInt(0) } }));
  const refundKopecks = BigInt(refundResult._sum?.amount || 0);

  const netAnnualRevenueKopecks = grossKopecks > refundKopecks ? (grossKopecks - refundKopecks) : BigInt(0);

  const isExceeded = netAnnualRevenueKopecks >= VAT_THRESHOLD_KOPECKS;
  vatThresholdCache.set(cleanTenant, { result: isExceeded, expiresAt: now + 3600 * 1000 });
  return isExceeded;
}


export interface PaymentGatewayResult {
  paymentUrl: string;
  remoteGatewayId: string;
}

export interface RefundGatewayParams {
  paymentGatewayId: string;
  tenantId?: string;
  amountRub: number;
  email: string | null;
  reason?: string;
  idempotencyKey: string;
}

export interface RefundGatewayResult {
  refundId: string;
  status: string;
  amountRub: number;
  receiptRegistration?: string;
}

export interface PaymentGatewayParams {
  paymentId: string;
  orderId?: string;
  userId: string;
  tenantId?: string;
  amountRub: number;
  email: string | null;
  successUrl: string;
  description: string;
  metadata?: Record<string, unknown>;
  isTestMode?: boolean;
}

export abstract class BasePaymentGateway {
  abstract createPayment(params: PaymentGatewayParams): Promise<PaymentGatewayResult>;
  
  // Optional method for synchronous status checking
  async checkStatusSync?(gatewayId: string, tenantId?: string): Promise<boolean>;

  // Optional method for automated refunds
  async executeRefund?(params: RefundGatewayParams): Promise<RefundGatewayResult>;
}

class YooKassaGateway extends BasePaymentGateway {
  async createPayment(params: PaymentGatewayParams): Promise<PaymentGatewayResult> {
    if (params.amountRub <= 0 || Math.round(params.amountRub * 100) <= 0) {
      throw new Error('Сумма платежа должна быть больше 0');
    }

    const tenantId = params.tenantId || (params.metadata?.tenantId as string) || 'smmplan';
    const secrets = await SettingsProvider.getPaymentSecrets(tenantId);
    const shopId = secrets.yookassaShopId;
    const secretKey = secrets.yookassaSecretKey;
    const isTestMode = (await SettingsProvider.isTestMode(tenantId)) || Boolean(params.isTestMode) || SettingsProvider.isTestEnvironment();

    const isDummyKeys = !shopId || !secretKey || shopId.trim().length === 0 || secretKey.trim().length === 0;

    if (isDummyKeys) {
      throw new Error(
        isTestMode 
          ? 'Платёжный шлюз ЮKassa не настроен для тестового режима. Укажите Test Shop ID и Test Secret Key в настройках.' 
          : 'Платёжный шлюз ЮKassa не настроен. Пожалуйста, укажите Shop ID и Secret Key в панели управления.'
      );
    }

    const authHeader = 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');
    
    const supportDomain = await SettingsProvider.getSupportEmailDomain(tenantId);

    const payload: {
      amount: { value: string; currency: string };
      capture: boolean;
      confirmation: { type: string; return_url: string };
      description: string;
      metadata: Record<string, unknown>;
      receipt?: {
        customer: { email: string };
        items: Array<{
          description: string;
          quantity: string;
          amount: { value: string; currency: string };
          vat_code: number;
          payment_mode: string;
          payment_subject: string;
        }>;
      };
    } = {
      amount: { value: params.amountRub.toFixed(2), currency: 'RUB' },
      capture: true,
      confirmation: { type: 'redirect', return_url: params.successUrl },
      description: (params.description || "Оплата заказа").slice(0, 128),
      metadata: { 
        paymentId: params.paymentId, 
        userId: params.userId, 
        orderId: params.orderId, 
        tenantId,
        ...params.metadata 
      }
    };

    // 54-ФЗ Fiscalization Receipt (Included in both live & test mode for universal YooKassa compatibility)
    const isVatThresholdExceeded = await checkVatThreshold(tenantId);
    
    // ФФД 1.2 (54-ФЗ): дифференциация аванса (пополнение баланса) и прямой оплаты услуги
    const isDeposit = params.metadata?.type === 'deposit';

    // Для аванса при превышении 20 млн ₽ по ФФД 1.2 применяется расчетная ставка 22/122 (vat_code: 4 в ЮKassa)
    // Для прямой оплаты услуги при превышении порога — ставка 22% (vat_code: 10 в ЮKassa)
    // До 20 млн ₽ — Без НДС (vat_code: 1 в ЮKassa)
    const vatCode = isVatThresholdExceeded 
      ? (isDeposit ? 4 : 10) 
      : 1;

    const paymentMode = isDeposit ? "advance" : "full_payment";
    const paymentSubject = isDeposit ? "payment" : "service";
    const itemDescription = isDeposit
      ? (params.description || "Пополнение баланса (Аванс за информационные услуги)").slice(0, 128)
      : (params.description || "Информационные услуги").slice(0, 128);

    payload.receipt = {
      customer: { email: (params.email?.trim() || `no-reply@${supportDomain}`).slice(0, 64) },
      items: [{
        description: itemDescription,
        quantity: "1.00",
        amount: { value: params.amountRub.toFixed(2), currency: 'RUB' },
        vat_code: vatCode,
        payment_mode: paymentMode,
        payment_subject: paymentSubject
      }]
    };

    const idempString = `yookassa_${params.userId}_${params.paymentId}_${Math.floor(Date.now() / 60000)}`;
    const idempKey = crypto.createHash('sha256').update(idempString).digest('hex').substring(0, 36);

    let resp: Response;
    try {
      resp = await UniversalNetworkRouter.fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          'Idempotence-Key': idempKey
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      }, { service: 'PAYMENTS_RU' });
    } catch (netErr: unknown) {
      console.error('[YooKassaGateway] Connection failed:', netErr);
      throw new Error('Ошибка соединения со шлюзом ЮKassa. Сервер оплаты временно недоступен — попробуйте СБП или CryptoBot.');
    }

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('[YooKassaGateway] API Error:', resp.status, errBody);
      let descriptiveError = 'Ошибка шлюза YooKassa';
      try {
        const parsed = JSON.parse(errBody);
        if (parsed.description) {
          descriptiveError = `YooKassa: ${parsed.description}`;
        } else if (parsed.code) {
          descriptiveError = `YooKassa (${parsed.code})`;
        }
      } catch {
        descriptiveError = `YooKassa HTTP ${resp.status}`;
      }
      throw new Error(descriptiveError);
    }

    const data = await resp.json();
    return {
      paymentUrl: data.confirmation.confirmation_url,
      remoteGatewayId: data.id
    };
  }

  async checkStatusSync(gatewayId: string, tenantId?: string): Promise<boolean> {
    if (gatewayId.startsWith('yoo_test_mock_') || gatewayId.startsWith('mock_')) {
      return true;
    }
    try {
      let resolvedTenantId = tenantId;
      if (tenantId) {
        // Strict IDOR prevention (PCI DSS Req 6.4.2): verify payment belongs to tenant
        const p = await db.payment.findFirst({
          where: { gatewayId, tenantId },
          select: { tenantId: true }
        });
        if (!p) {
          console.error(`[YooKassaGateway] IDOR blocked: payment ${gatewayId} does not belong to tenant ${tenantId}`);
          return false;
        }
        resolvedTenantId = tenantId;
      } else {
        // tenant-isolation-ignore: Fallback lookup to resolve tenantId from payment.gatewayId when tenantId is not passed
        const p = await db.payment.findFirst({
          where: { gatewayId },
          select: { tenantId: true }
        });
        resolvedTenantId = p?.tenantId || 'smmplan';
      }
      const secrets = await SettingsProvider.getPaymentSecrets(resolvedTenantId);
      const shopId = secrets.yookassaShopId;
      const secretKey = secrets.yookassaSecretKey;
      if (!shopId || !secretKey) return false;

      const authHeader = 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');
      const resp = await fetch(`https://api.yookassa.ru/v3/payments/${gatewayId}`, {
        method: 'GET',
        headers: { 'Authorization': authHeader },
        signal: AbortSignal.timeout(15000)
      });

      if (!resp.ok) return false;
      const data = await resp.json();
      return data.status === 'succeeded' || data.status === 'waiting_for_capture';
    } catch (e) {
      console.error('[YooKassaGateway] Error checking status', e);
      return false;
    }
  }

  async executeRefund(params: RefundGatewayParams): Promise<RefundGatewayResult> {
    if (params.amountRub <= 0 || Math.round(params.amountRub * 100) <= 0) {
      throw new Error('Сумма возврата должна быть больше 0');
    }

    let resolvedTenantId = params.tenantId;
    if (!resolvedTenantId) {
      // tenant-isolation-ignore: Fallback lookup to resolve tenantId from payment.gatewayId when tenantId is not passed
      const p = await db.payment.findFirst({
        where: { gatewayId: params.paymentGatewayId },
        select: { tenantId: true }
      });
      resolvedTenantId = p?.tenantId || 'smmplan';
    }

    const secrets = await SettingsProvider.getPaymentSecrets(resolvedTenantId);
    const shopId = secrets.yookassaShopId;
    const secretKey = secrets.yookassaSecretKey;
    const isTestMode = (await SettingsProvider.isTestMode(resolvedTenantId)) || SettingsProvider.isTestEnvironment();

    const isDummyKeys = !shopId || !secretKey || shopId.trim().length === 0 || secretKey.trim().length === 0;

    if (params.paymentGatewayId.startsWith('yoo_test_mock_') || params.paymentGatewayId.startsWith('mock_') || (isDummyKeys && isTestMode)) {
      invalidateVatThresholdCache(resolvedTenantId);
      return {
        refundId: `mock_refund_${Date.now()}`,
        status: 'succeeded',
        amountRub: params.amountRub,
      };
    }

    if (isDummyKeys) {
      throw new Error('Платёжный шлюз ЮKassa не настроен для проведения возвратов.');
    }

    const authHeader = 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');
    const supportDomain = await SettingsProvider.getSupportEmailDomain(resolvedTenantId);
    const isVatThresholdExceeded = await checkVatThreshold(resolvedTenantId);
    const vatCode = isVatThresholdExceeded ? 10 : 1; // 10 = НДС 22% (п. 3 ст. 164 НК РФ), 1 = Без НДС

    const payload = {
      payment_id: params.paymentGatewayId,
      amount: {
        value: params.amountRub.toFixed(2),
        currency: 'RUB',
      },
      receipt: {
        customer: {
          email: (params.email?.trim() || `no-reply@${supportDomain}`).slice(0, 64),
        },
        items: [
          {
            description: (params.reason || 'Возврат средств по услуге').slice(0, 128),
            quantity: '1.00',
            amount: {
              value: params.amountRub.toFixed(2),
              currency: 'RUB',
            },
            vat_code: vatCode,
            payment_mode: 'full_payment',
            payment_subject: 'service',
          },
        ],
      },
    };

    let resp: Response;
    try {
      resp = await UniversalNetworkRouter.fetch('https://api.yookassa.ru/v3/refunds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          'Idempotence-Key': (params.idempotencyKey || `refund_${Date.now()}`).slice(0, 64),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      }, { service: 'PAYMENTS_RU' });
    } catch (netErr: unknown) {
      console.error('[YooKassaGateway] Refund connection failed:', netErr);
      throw new Error('Ошибка соединения с сервером ЮKassa при возврате средств.');
    }

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('[YooKassaGateway] Refund API Error:', resp.status, errBody);
      let descriptiveError = 'Ошибка проведения возврата в ЮKassa';
      try {
        const parsed = JSON.parse(errBody);
        if (parsed.description) {
          descriptiveError = `ЮKassa: ${parsed.description}`;
        } else if (parsed.code) {
          descriptiveError = `ЮKassa (${parsed.code})`;
        }
      } catch {
        descriptiveError = `ЮKassa HTTP ${resp.status}`;
      }
      throw new Error(descriptiveError);
    }

    const data = await resp.json();
    invalidateVatThresholdCache(resolvedTenantId);
    return {
      refundId: data.id,
      status: data.status,
      amountRub: parseFloat(data.amount?.value || String(params.amountRub)),
    };
  }
}

class CryptoBotGateway extends BasePaymentGateway {
  async createPayment(params: PaymentGatewayParams): Promise<PaymentGatewayResult> {
    if (params.amountRub <= 0 || Math.round(params.amountRub * 100) <= 0) {
      throw new Error('Сумма платежа должна быть больше 0');
    }

    const tenantId = params.tenantId || (params.metadata?.tenantId as string) || 'smmplan';
    const secrets = await SettingsProvider.getPaymentSecrets(tenantId);
    const cryptoToken = secrets.cryptoBotToken;
    const isTestMode = (await SettingsProvider.isTestMode(tenantId)) || Boolean(params.isTestMode) || SettingsProvider.isTestEnvironment();

    const isDummyKeys = !cryptoToken || cryptoToken === 'test_token' || cryptoToken === 'test_bot_token' || cryptoToken === 'test_shop_id' || cryptoToken === 'test_login' || cryptoToken.startsWith('test_') || cryptoToken.trim().length === 0;

    if (isDummyKeys) {
      if (isTestMode) {
        console.warn('[CryptoBotGateway] Test Mode: Dummy keys detected, returning sandbox payment URL.');
        return {
          paymentUrl: params.successUrl || `${await getBaseUrlAsync()}/dashboard/add-funds?success=1`,
          remoteGatewayId: `crypto_test_mock_${Date.now()}`
        };
      }
      throw new Error('Платёжный шлюз CryptoBot не настроен. Пожалуйста, укажите действующий API токен в панели управления.');
    }

    const legalSettings = await SettingsProvider.getContactAndLegalSettings(tenantId);
    const brandName = legalSettings.COMPANY_NAME || (tenantId === 'flux' ? 'SMMflux' : 'SMMplan');
    const cleanDesc = params.description.startsWith('Test ') 
      ? params.description.substring(5) 
      : params.description;
    const hiddenMessage = `${brandName} ${cleanDesc}`;

    let resp: Response;
    try {
      resp = await UniversalNetworkRouter.fetch('https://pay.crypt.bot/api/createInvoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Crypto-Pay-API-Token': cryptoToken
        },
        body: JSON.stringify({
          currency_type: 'fiat', // Allow paying in TON but amount specified in RUB
          fiat: 'RUB',
          amount: params.amountRub.toFixed(2),
          description: params.description,
          hidden_message: hiddenMessage,
          payload: params.paymentId
        }),
        signal: AbortSignal.timeout(15000)
      }, { service: 'PAYMENTS_CRYPTO' });
    } catch (netErr: unknown) {
      console.error('[CryptoBotGateway] Network Error:', netErr);
      if (isTestMode) {
        console.warn('[CryptoBotGateway] Test Mode: CryptoBot API unreachable, falling back to simulated sandbox payment URL.');
        return {
          paymentUrl: params.successUrl || `${await getBaseUrlAsync()}/dashboard/add-funds?success=1`,
          remoteGatewayId: `crypto_test_mock_${Date.now()}`
        };
      }
      throw new Error('Ошибка соединения со шлюзом CryptoBot');
    }

    if (!resp.ok) {
      console.error('[CryptoBotGateway] API Error:', await resp.text());
      if (isTestMode) {
        console.warn('[CryptoBotGateway] Test Mode: API error, falling back to simulated sandbox payment URL.');
        return {
          paymentUrl: params.successUrl || `${await getBaseUrlAsync()}/dashboard/add-funds?success=1`,
          remoteGatewayId: `crypto_test_mock_${Date.now()}`
        };
      }
      throw new Error('Ошибка шлюза CryptoBot');
    }

    const data = await resp.json();
    if (!data.ok) {
      if (isTestMode) {
        return {
          paymentUrl: params.successUrl || `${await getBaseUrlAsync()}/dashboard/add-funds?success=1`,
          remoteGatewayId: `crypto_test_mock_${Date.now()}`
        };
      }
      throw new Error('CryptoBot returned error: ' + JSON.stringify(data.error));
    }
    
    return {
      paymentUrl: data.result.pay_url,
      remoteGatewayId: data.result.invoice_id.toString()
    };
  }

  async checkStatusSync(gatewayId: string, tenantId?: string): Promise<boolean> {
    if (gatewayId.startsWith('crypto_test_mock_') || gatewayId.startsWith('mock_')) {
      return true;
    }
    try {
      let resolvedTenantId = tenantId;
      if (!resolvedTenantId) {
        // tenant-isolation-ignore: Fallback lookup to resolve tenantId from payment.gatewayId when tenantId is not passed
        const p = await db.payment.findFirst({
          where: { gatewayId },
          select: { tenantId: true }
        });
        resolvedTenantId = p?.tenantId || 'smmplan';
      }
      const secrets = await SettingsProvider.getPaymentSecrets(resolvedTenantId);
      const cryptoToken = secrets.cryptoBotToken;
      if (!cryptoToken) return false;

      const resp = await UniversalNetworkRouter.fetch(`https://pay.crypt.bot/api/getInvoices?invoice_ids=${gatewayId}`, {
        method: 'GET',
        headers: {
          'Crypto-Pay-API-Token': cryptoToken
        },
        signal: AbortSignal.timeout(15000)
      }, { service: 'PAYMENTS_CRYPTO' });

      if (!resp.ok) return false;
      const data = await resp.json();
      if (!data.ok || !data.result || data.result.items.length === 0) return false;

      const invoice = data.result.items[0];
      return invoice.status === 'paid';
    } catch (e) {
      console.error('[CryptoBotGateway] Error checking status:', e);
      return false;
    }
  }
}

class BalanceGateway extends BasePaymentGateway {
  async createPayment(params: PaymentGatewayParams): Promise<PaymentGatewayResult> {
    const amountCents = Math.round(params.amountRub * 100);
    const remoteId = `internal_${Date.now()}`;
    const { ordersQueue } = await import('@/lib/queue-manager');

    // Perform atomic deduction inside the transaction to prevent race condition double-spending
    const updatedOrderIds: string[] = await db.$transaction(async (tx) => {
      // Atomic WalletOps deduction (already handles totalSpent increment securely)
      await WalletOps.charge(tx, params.userId, amountCents, params.description);

      await tx.payment.update({
          where: { id: params.paymentId },
          data: { status: 'SUCCEEDED', gatewayId: remoteId }
        });

        // Update any specific order if passed
        const ids = [];
        if (params.orderId) {
          const order = await tx.order.findUnique({
            where: { id: params.orderId }
          });
          if (order) {
            await tx.order.update({
              where: { id: params.orderId },
              data: { status: 'PENDING' }
            });
            if (order.promoCodeId) {
              const promo = await tx.promoCode.findUnique({
                where: { id: order.promoCodeId },
                select: { isSuspicious: true }
              });
              const isSuspicious = promo?.isSuspicious ?? false;
              
              const existingUsage = await tx.promoCodeUsage.findUnique({
                where: { orderId: order.id }
              });
              
              if (!existingUsage) {
                await tx.promoCodeUsage.create({
                  data: {
                    promoCodeId: order.promoCodeId,
                    userId: params.userId,
                    orderId: order.id,
                    discountCents: order.discountCents,
                    revenueCents: BigInt(Number(order.charge)),
                    profitCents: BigInt(Number(order.charge - order.providerCost)),
                    isSuspicious,
                  }
                });
              }
            }
            ids.push(params.orderId);
          }
        }

        // Also update any orders linked to this paymentId (Mass Orders / Basket)
        const basketOrders = await tx.order.findMany({ 
          where: { paymentId: params.paymentId, status: 'AWAITING_PAYMENT', ...(params.tenantId ? { tenantId: params.tenantId } : {}) } 
        });
        if (basketOrders.length > 0) {
          await tx.order.updateMany({
            where: { paymentId: params.paymentId, status: 'AWAITING_PAYMENT', ...(params.tenantId ? { tenantId: params.tenantId } : {}) },
            data: { status: 'PENDING' }
          });
          for (const order of basketOrders) {
            if (order.promoCodeId) {
              const promo = await tx.promoCode.findUnique({
                where: { id: order.promoCodeId },
                select: { isSuspicious: true }
              });
              const isSuspicious = promo?.isSuspicious ?? false;
              
              const existingUsage = await tx.promoCodeUsage.findUnique({
                where: { orderId: order.id }
              });
              
              if (!existingUsage) {
                await tx.promoCodeUsage.create({
                  data: {
                    promoCodeId: order.promoCodeId,
                    userId: params.userId,
                    orderId: order.id,
                    discountCents: order.discountCents,
                    revenueCents: BigInt(Number(order.charge)),
                    profitCents: BigInt(Number(order.charge - order.providerCost)),
                    isSuspicious,
                  }
                });
              }
            }
          }
          ids.push(...basketOrders.map(o => o.id));
        }
        
        return ids;
    }, { isolationLevel: 'Serializable', timeout: 15000 });

    for (const id of updatedOrderIds) {
      await ordersQueue.add('order-dispatch', { orderId: id }, { jobId: `dispatch-${id}`, delay: 3 * 60 * 1000 });
    }

    return {
      paymentUrl: params.successUrl,
      remoteGatewayId: remoteId
    };
  }
}

class RobokassaGateway extends BasePaymentGateway {
  async createPayment(params: PaymentGatewayParams): Promise<PaymentGatewayResult> {
    if (params.amountRub <= 0 || Math.round(params.amountRub * 100) <= 0) {
      throw new Error('Сумма платежа должна быть больше 0');
    }

    const tenantId = params.tenantId || (params.metadata?.tenantId as string) || 'smmplan';
    const secrets = await SettingsProvider.getPaymentSecrets(tenantId);
    const login = secrets.robokassaLogin;
    const password = secrets.robokassaPassword;
    const isTestMode = (await SettingsProvider.isTestMode(tenantId)) || Boolean(params.isTestMode) || SettingsProvider.isTestEnvironment();

    const isDummyKeys = !login || !password || login === 'test_login' || login.trim().length === 0 || password.trim().length === 0;

    if (isDummyKeys) {
      if (isTestMode) {
        console.warn('[RobokassaGateway] Test Mode: Dummy keys detected, returning sandbox payment URL.');
        return {
          paymentUrl: params.successUrl || `${await getBaseUrlAsync()}/dashboard/add-funds?success=1`,
          remoteGatewayId: `robo_test_mock_${Date.now()}`
        };
      }
      throw new Error('Платёжный шлюз Робокасса не настроен. Пожалуйста, укажите Merchant Login и Пароль в панели управления.');
    }

    const outSum = params.amountRub.toFixed(2);
    const invId = 0; // Passed CUID in shp_paymentId

    // Robokassa signature formula: MerchantLogin:OutSum:InvId:MerchantPassword1:shp_paymentId=paymentId
    const sigStr = `${login}:${outSum}:${invId}:${password}:shp_paymentId=${params.paymentId}`;
    const signature = crypto.createHash('sha256').update(sigStr).digest('hex');

    // Подсчитываем оборот за год для переключения НДС 22% (ФЗ № 425-ФЗ, ФЗ № 176-ФЗ, ст. 145, 164 НК РФ)
    const isVatThresholdExceeded = await checkVatThreshold(tenantId);
    const taxRate = isVatThresholdExceeded ? "vat22" : "none"; // vat22 = 22% (п. 3 ст. 164 НК РФ), none = без НДС

    const receipt = {
      items: [{
        name: "Информационные услуги",
        quantity: 1,
        sum: params.amountRub.toFixed(2),
        tax: taxRate,
        payment_method: "full_prepayment",
        payment_subject: "service"
      }]
    };

    const queryParams = new URLSearchParams({
      MerchantLogin: login,
      OutSum: outSum,
      InvId: invId.toString(),
      Description: params.description,
      SignatureValue: signature,
      shp_paymentId: params.paymentId,
      Receipt: JSON.stringify(receipt)
    });

    const robokassaUrl = `https://auth.robokassa.ru/Merchant/Index.aspx?${queryParams.toString()}`;

    return {
      paymentUrl: robokassaUrl,
      remoteGatewayId: `robo_${params.paymentId}`
    };
  }

  async checkStatusSync(gatewayId: string, _tenantId?: string): Promise<boolean> {
    if (gatewayId.startsWith('robo_test_mock_') || gatewayId.startsWith('mock_')) {
      return true;
    }
    try {
      const paymentId = gatewayId.replace(/^robo_/i, '');
      const payment = await db.payment.findUnique({
        where: { id: paymentId }
      });
      return payment?.status === 'SUCCEEDED';
    } catch (e) {
      console.error('[RobokassaGateway] Error checking status:', e);
      return false;
    }
  }
}

class MockGateway extends BasePaymentGateway {
  async createPayment(params: PaymentGatewayParams): Promise<PaymentGatewayResult> {
    return {
      paymentUrl: params.successUrl || `${await getBaseUrlAsync()}/dashboard/add-funds?success=1`,
      remoteGatewayId: `mock_${Date.now()}`
    };
  }
}

export class PaymentGatewayFactory {
  static getGateway(gatewayName: string): BasePaymentGateway {
    switch (gatewayName.toLowerCase()) {
      case 'yookassa':
      case 'sbp':
      case 'card':
      case 'mir':
      case 'yoomoney':
        return new YooKassaGateway();
      case 'robokassa':
      case 'robo':
        return new RobokassaGateway();
      case 'cryptobot':
      case 'crypto':
      case 'usdt':
      case 'ton':
        return new CryptoBotGateway();
      case 'balance':
        return new BalanceGateway();
      case 'mock':
        return new MockGateway();
      default:
        // Fallback to YooKassa if unknown card/payment method passed
        return new YooKassaGateway();
    }
  }
}
