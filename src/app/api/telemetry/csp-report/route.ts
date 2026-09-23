export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { SecurityAlertService } from '@/services/security/security-alert.service';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { redis } from '@/lib/redis';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (!rawBody || rawBody.length > 50000) {
      return NextResponse.json({ status: 'ignored' }, { status: 400 });
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ status: 'invalid_json' }, { status: 400 });
    }

    const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 🛡️ AUTH-02: Rate Limiting (10 requests per minute per IP)
    const rateLimit = await checkRateLimit(ip, 'csp_report', { limit: 10, windowSeconds: 60 });
    if (!rateLimit.success) {
      return NextResponse.json(
        { status: 'rate_limited', error: 'Too many CSP reports. Limit is 10 requests per minute.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.resetSeconds || 60),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
          },
        }
      );
    }

    const reportData = (parsed['csp-report'] || parsed['body'] || parsed) as Record<string, unknown>;
    const blockedUri = String(reportData['blocked-uri'] || reportData['blockedURL'] || '');
    const violatedDirective = String(reportData['violated-directive'] || reportData['effectiveDirective'] || '');
    const documentUri = String(reportData['document-uri'] || reportData['documentURL'] || '');

    // 🛡️ AUTH-02: Deduplication (5-minute window for identical IP + blockedUri + directive)
    const dedupHash = crypto.createHash('sha256').update(`${blockedUri}:${violatedDirective}`).digest('hex');
    const dedupKey = `csp_dedup:${ip}:${dedupHash}`;

    if (redis && typeof redis.set === 'function') {
      try {
        const isNew = await redis.set(dedupKey, '1', 'EX', 300, 'NX');
        if (!isNew) {
          return NextResponse.json({ status: 'deduplicated' }, { status: 200 });
        }
      } catch {
        // Fall back to processing if Redis check encounters transient error
      }
    }

    // Record CSP violation as WARNING
    await SecurityAlertService.record({
      event: 'CSP_VIOLATION',
      severity: 'WARNING',
      ip,
      tenantId: 'smmplan',
      details: {
        blockedUri,
        violatedDirective,
        documentUri,
        userAgent,
      },
    });

    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
