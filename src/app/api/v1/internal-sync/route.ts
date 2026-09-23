import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/utils/ip';
import { computeHeaderFingerprint } from '@/lib/security/ddos-shield/fingerprint';
import { recordHoneypotViolation } from '@/lib/security/ddos-shield/honeypot-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleTrap(request);
}

export async function POST(request: NextRequest) {
  return handleTrap(request);
}

async function handleTrap(request: NextRequest) {
  const ip = await getClientIp(request.headers).catch(() => 'unknown');
  const fingerprint = computeHeaderFingerprint(request.headers);

  // 1. Immediately blacklist in Redis for 24h
  await recordHoneypotViolation(ip, fingerprint);

  // 2. Return 403 Forbidden with honeypot trap header
  return new NextResponse('Access Denied', {
    status: 403,
    headers: {
      'Content-Type': 'text/plain',
      'X-Robots-Tag': 'noindex, nofollow',
      'Retry-After': '86400',
    },
  });
}
