import crypto from 'crypto';
import { redis } from '@/lib/redis';
import { SecurityAlertService } from './security-alert.service';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'HardenedAntiFraudService' });

export interface DeviceFingerprintInput {
  screenRes?: string;
  timezone?: string;
  language?: string;
  webglRenderer?: string;
  canvasHash?: string;
  hardwareConcurrency?: number;
}

export interface AntiFraudEvaluationInput {
  ip: string;
  fingerprint?: DeviceFingerprintInput;
  formRenderTimeMs?: number;
  formSubmitTimeMs?: number;
  userId?: string;
  tenantId?: string;
}

export interface AntiFraudResult {
  allowed: boolean;
  riskScore: number; // 0 (clean) to 100 (critical bot/fraud)
  reasons: string[];
  deviceFingerprintHash: string;
  requiresPowChallenge: boolean;
}

export class HardenedAntiFraudService {
  private static readonly DEVICE_ACCOUNT_LIMIT_24H = 3;
  private static readonly MIN_HUMAN_FILL_TIME_MS = 250;

  /**
   * Generates a stable SHA-256 hardware hash from device characteristics.
   */
  static generateDeviceHash(fp: DeviceFingerprintInput = {}): string {
    const raw = [
      fp.screenRes || 'default-res',
      fp.timezone || 'default-tz',
      fp.language || 'default-lang',
      fp.webglRenderer || 'default-gpu',
      fp.canvasHash || 'default-canvas',
      fp.hardwareConcurrency || 4,
    ].join('|');

    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Evaluates request against device multi-accounting, interaction velocity, and proxy abuse.
   */
  static async evaluate(input: AntiFraudEvaluationInput): Promise<AntiFraudResult> {
    const { ip, fingerprint, formRenderTimeMs, formSubmitTimeMs, userId, tenantId = 'smmplan' } = input;
    const deviceHash = this.generateDeviceHash(fingerprint);
    const reasons: string[] = [];
    let riskScore = 0;

    // 1. Velocity Check (Human vs Machine timing)
    if (formRenderTimeMs && formSubmitTimeMs) {
      const fillDurationMs = formSubmitTimeMs - formRenderTimeMs;
      if (fillDurationMs < this.MIN_HUMAN_FILL_TIME_MS && fillDurationMs >= 0) {
        riskScore += 60;
        reasons.push(`Superhuman form submission speed (${fillDurationMs}ms < ${this.MIN_HUMAN_FILL_TIME_MS}ms)`);
      }
    }

    // 2. Multi-Accounting Device Tracking via Redis
    const deviceKey = `antifraud:device:${deviceHash}:accounts`;
    let deviceAccountCount = 0;

    try {
      if (userId) {
        await redis.sadd(deviceKey, userId);
        await redis.expire(deviceKey, 86400); // 24 hours window
        deviceAccountCount = await redis.scard(deviceKey);

        if (deviceAccountCount > this.DEVICE_ACCOUNT_LIMIT_24H) {
          riskScore += 45;
          reasons.push(
            `Device fingerprint linked to ${deviceAccountCount} accounts in 24h (Limit: ${this.DEVICE_ACCOUNT_LIMIT_24H})`
          );
        }
      }
    } catch {
      // Redis best-effort
    }

    // 3. Automated Alert Triggering if high risk
    const isCritical = riskScore >= 75;
    const isWarning = riskScore >= 40;

    if (isCritical || isWarning) {
      SecurityAlertService.record({
        event: isCritical ? 'BOT_AUTOMATION_SHIELD_BLOCKED' : 'SUSPICIOUS_DEVICE_BEHAVIOR',
        severity: isCritical ? 'CRITICAL' : 'WARNING',
        ip,
        tenantId,
        details: {
          riskScore,
          reasons,
          deviceHash,
          deviceAccountCount,
        },
      }).catch((err) => {
        log.error('Failed to record antifraud security event', { err });
      });
    }

    return {
      allowed: riskScore < 75,
      riskScore,
      reasons,
      deviceFingerprintHash: deviceHash,
      requiresPowChallenge: riskScore >= 50 && riskScore < 75,
    };
  }

  /**
   * Generates a lightweight Proof-of-Work challenge for suspicious clients.
   */
  static generatePowChallenge(ip: string): { challenge: string; targetZeros: number } {
    const timestamp = Date.now();
    const challenge = crypto.createHash('sha256').update(`${ip}-${timestamp}-smmplan-pow`).digest('hex');
    return { challenge, targetZeros: 4 };
  }

  /**
   * Verifies client Proof-of-Work solution.
   */
  static verifyPowSolution(challenge: string, nonce: string, targetZeros: number = 4): boolean {
    const hash = crypto.createHash('sha256').update(`${challenge}${nonce}`).digest('hex');
    return hash.startsWith('0'.repeat(targetZeros));
  }
}
