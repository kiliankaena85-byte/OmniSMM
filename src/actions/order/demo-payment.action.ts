'use server';

import { db } from "@/lib/db";
import { getBaseUrlAsync } from "@/utils/get-base-url";
import { getClientIp } from "@/utils/ip";
import { headers } from "next/headers";
import { PaymentGatewayFactory } from "@/services/financial/payment-gateway.service";

export async function createDemoPaymentAction({
  amountRub,
  description = "Оплата заказа в SMMplan",
  gateway = "yookassa",
  email = "demo@smmplan.pro",
  targetLink = "https://t.me/smmplan",
  serviceName = "Telegram Подписчики"
}: {
  amountRub: number;
  description?: string;
  gateway?: 'yookassa' | 'cryptobot' | 'robokassa';
  email?: string;
  targetLink?: string;
  serviceName?: string;
}) {
  if (!amountRub || amountRub < 10) {
    throw new Error("Минимальная сумма к оплате — 10 ₽");
  }

  // CHK-03: demo payments are only permitted in SANDBOX or HYBRID modes (where mock payment is enabled)
  const reqHeaders = await headers();
  const tenantId = reqHeaders.get('x-tenant-id') || 'smmplan';

  let isMockPayment = false;
  try {
    const { SettingsManager } = await import('@/lib/settings');
    isMockPayment = await SettingsManager.isMockPaymentEnabled(tenantId);
  } catch {
    // settings unavailable — fail-closed
  }
  if (!isMockPayment) {
    throw new Error('Демо-платежи доступны только в режимах тестирования без реального эквайринга (Песочница / Гибридный)');
  }

  // Find or create demo user
  let demoUser = await db.user.findFirst({
    where: {
      email: email.trim().toLowerCase(),
      tenantId
    }
  });

  if (!demoUser) {
    demoUser = await db.user.create({
      data: {
        email: email.trim().toLowerCase(),
        balance: BigInt(0),
        role: "USER",
        tenantId
      }
    });
  }

  let consentUserAgent = "Unknown";
  let consentIp = "127.0.0.1";
  try {
    const reqHeaders = await headers();
    consentUserAgent = reqHeaders.get("user-agent") || "Unknown";
    consentIp = await getClientIp();
  } catch {
    // fallback if called in non-request scope
  }

  const amountCents = Math.round(amountRub * 100);

  const payment = await db.payment.create({
    data: {
      userId: demoUser.id,
      amount: amountCents,
      currency: "RUB",
      status: "PENDING",
      gateway: gateway,
      consentIp,
      consentUserAgent,
      consentVersion: "demo:1.0"
    }
  });

  const gatewaySvc = PaymentGatewayFactory.getGateway(gateway);
  const successUrl = `${await getBaseUrlAsync()}/dashboard/orders?success=1`;

  const gatewayResult = await gatewaySvc.createPayment({
    paymentId: payment.id,
    userId: demoUser.id,
    amountRub,
    email: demoUser.email,
    successUrl,
    description: `${description} (${payment.id})`,
    isTestMode: true,
    metadata: {
      isDemo: true,
      serviceName,
      targetLink
    }
  });

  if (gatewayResult.remoteGatewayId || gatewayResult.paymentUrl) {
    await db.payment.update({
      where: { id: payment.id },
      data: {
        gatewayId: gatewayResult.remoteGatewayId || undefined,
        checkoutUrl: gatewayResult.paymentUrl || undefined
      }
    });
  }

  return {
    success: true,
    paymentUrl: gatewayResult.paymentUrl || `${await getBaseUrlAsync()}/payment-redirect?id=${payment.id}`
  };
}
