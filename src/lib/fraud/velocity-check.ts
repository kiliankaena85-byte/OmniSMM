import crypto from 'crypto';
import { rateLimit } from '@/lib/security/rate-limit';
import { SecurityAlertService } from '@/services/security/security-alert.service';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'FraudVelocityChecker' });

export interface VelocityCheckInput {
  ip: string;
  email: string;
  deviceId?: string | null;
  amountRub?: number;
}

export interface VelocityCheckResult {
  allowed: boolean;
  requires3DS: boolean;
  riskScore: number; // 0 to 100
  reason?: string;
}

/**
 * PCI-DSS Anti-Fraud Velocity Engine.
 * Evaluates checkout frequency across IP, Email, and Device identifiers
 * to mitigate automated card testing, brute-forceBIN attacks, and promo abuse.
 */
export async function checkCheckoutVelocity(input: VelocityCheckInput): Promise<VelocityCheckResult> {
  const { ip, email, deviceId, amountRub = 0 } = input;
  const ipHash = crypto.createHash('sha256').update(ip || '127.0.0.1').digest('hex').slice(0, 16);
  const cleanEmail = email ? email.trim().toLowerCase() : 'unknown';

  let riskScore = 0;
  let requires3DS = false;

  // 1. IP Velocity: max 10 checkout attempts per 10 minutes (600s)
  const ipLimit = await rateLimit(`fraud:vel:ip:${ipHash}`, 10, 600);
  if (!ipLimit.ok) {
    riskScore += 60;
    requires3DS = true;
    log.warn('IP checkout velocity exceeded', { ipHash, total: ipLimit.total });

    await SecurityAlertService.record({
      event: 'FRAUD_IP_VELOCITY_EXCEEDED',
      severity: 'HIGH',
      ip,
      details: { ipHash, attempts10m: ipLimit.total, email: cleanEmail },
    });

    return {
      allowed: false,
      requires3DS: true,
      riskScore: Math.min(100, riskScore + 40),
      reason: 'Превышен лимит попыток оформления заказа с вашего IP адреса. Пожалуйста, подождите 10 минут.',
    };
  } else if (ipLimit.total > 5) {
    riskScore += 25;
    requires3DS = true;
  }

  // 2. Email Velocity: max 5 checkout attempts per 10 minutes
  if (cleanEmail !== 'unknown') {
    const emailHash = crypto.createHash('sha256').update(cleanEmail).digest('hex').slice(0, 16);
    const emailLimit = await rateLimit(`fraud:vel:email:${emailHash}`, 5, 600);
    if (!emailLimit.ok) {
      riskScore += 50;
      requires3DS = true;
      log.warn('Email checkout velocity exceeded', { cleanEmail, total: emailLimit.total });

      await SecurityAlertService.record({
        event: 'FRAUD_EMAIL_VELOCITY_EXCEEDED',
        severity: 'WARNING',
        ip,
        details: { email: cleanEmail, attempts10m: emailLimit.total },
      });

      return {
        allowed: false,
        requires3DS: true,
        riskScore: Math.min(100, riskScore + 50),
        reason: 'Слишком много попыток заказов на данный email. Подождите 10 минут.',
      };
    } else if (emailLimit.total > 3) {
      riskScore += 20;
      requires3DS = true;
    }
  }

  // 3. Device Velocity: max 8 checkout attempts per 10 minutes (if deviceId provided)
  if (deviceId) {
    const devLimit = await rateLimit(`fraud:vel:dev:${deviceId}`, 8, 600);
    if (!devLimit.ok) {
      riskScore += 40;
      requires3DS = true;
      return {
        allowed: false,
        requires3DS: true,
        riskScore: Math.min(100, riskScore + 40),
        reason: 'Превышен лимит активности на данном устройстве.',
      };
    }
  }

  // 4. High-value transaction threshold -> force 3DS
  if (amountRub >= 15000) {
    requires3DS = true;
    riskScore += 15;
  }

  return {
    allowed: true,
    requires3DS,
    riskScore,
  };
}
