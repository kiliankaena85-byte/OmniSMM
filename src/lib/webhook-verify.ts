import crypto from 'crypto';

/**
 * @file WebhookVerify - Canonical Golden Path Primitive for Fail-Closed Webhook Verification.
 * @module WebhookVerify
 * 
 * JSDoc / Usage Guidelines:
 * ✅ DO THIS (Fail-Closed Verification):
 *   const result = verifyWebhook({ rawBody, signatureHeader, secret, clientIp, gateway: 'yookassa' });
 *   if (!result.verified) return new Response(result.reason, { status: result.statusCode });
 * 
 * ❌ NEVER DO THIS (Fail-Open Pattern):
 *   if (secret && signatureHeader) { verify(); } // ❌ Skips check if headers/secrets omitted!
 */

export interface WebhookVerifyOptions {
  rawBody: string | Buffer;
  signatureHeader?: string | null;
  secret?: string | null;
  clientIp?: string | null;
  expectedIpWhitelist?: string[];
  gateway: 'yookassa' | 'robokassa' | 'cryptobot' | string;
}

export interface WebhookVerifyResult {
  verified: boolean;
  statusCode: number;
  reason?: string;
}

export function verifyWebhook(options: WebhookVerifyOptions): WebhookVerifyResult {
  const { rawBody, signatureHeader, secret, clientIp, expectedIpWhitelist, gateway } = options;

  // 1. FAIL-CLOSED: Missing secret is a server misconfiguration failure
  if (!secret || secret.trim() === '') {
    throw new Error(`SECURITY_WEBHOOK_SECRET_MISSING: Gateway secret for ${gateway} is not configured on server.`);
  }

  // 2. FAIL-CLOSED: Missing signature header is an immediate 403 rejection
  if (!signatureHeader || signatureHeader.trim() === '') {
    return { verified: false, statusCode: 403, reason: 'MISSING_SIGNATURE_HEADER' };
  }

  // 3. IP Whitelist check (if enabled)
  if (expectedIpWhitelist && expectedIpWhitelist.length > 0) {
    if (!clientIp || !expectedIpWhitelist.includes(clientIp)) {
      return { verified: false, statusCode: 403, reason: `UNTRUSTED_CLIENT_IP: ${clientIp}` };
    }
  }

  // 4. HMAC Verification with length guard
  try {
    const computedHmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const computedBuffer = Buffer.from(computedHmac, 'utf8');
    const signatureBuffer = Buffer.from(signatureHeader.trim(), 'utf8');

    // Length check prevents timingSafeEqual exception on mismatched buffer lengths
    if (computedBuffer.length !== signatureBuffer.length) {
      return { verified: false, statusCode: 403, reason: 'SIGNATURE_MISMATCH_LENGTH' };
    }

    const isMatch = crypto.timingSafeEqual(computedBuffer, signatureBuffer);
    if (!isMatch) {
      return { verified: false, statusCode: 403, reason: 'SIGNATURE_INVALID' };
    }

    return { verified: true, statusCode: 200 };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { verified: false, statusCode: 403, reason: `VERIFICATION_EXCEPTION: ${errMsg}` };
  }
}
