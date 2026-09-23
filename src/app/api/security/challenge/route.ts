import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getClientIp } from '@/utils/ip';
import { computeHeaderFingerprint } from '@/lib/security/ddos-shield/fingerprint';
import { 
  createPowChallenge, 
  verifyPowSolution, 
  signGatekeeperToken 
} from '@/lib/security/ddos-shield/pow-engine';
import { getShieldSecret } from '@/lib/security/ddos-shield/shield-secret';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const secret = getShieldSecret();
    const challenge = createPowChallenge(secret, 3);

    return NextResponse.json({
      challengeId: challenge.challengeId,
      salt: challenge.salt,
      difficulty: challenge.difficulty,
      expiresAt: challenge.expiresAt,
      signature: challenge.signature,
    });
  } catch {
    return NextResponse.json({ error: 'DDoS Shield service unavailable' }, { status: 500 });
  }
}

const verifySchema = z.object({
  challengeId: z.string(),
  salt: z.string(),
  difficulty: z.number().int().min(1).max(6),
  expiresAt: z.number(),
  signature: z.string(),
  nonce: z.number().int().nonnegative(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid challenge payload' }, { status: 400 });
    }

    const { challengeId, salt, difficulty, expiresAt, signature, nonce } = parsed.data;
    const secret = getShieldSecret();

    const isValid = verifyPowSolution({ challengeId, salt, difficulty, expiresAt, signature }, nonce, secret);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid proof of work solution' }, { status: 403 });
    }

    const ip = await getClientIp(request.headers).catch(() => 'unknown');
    const fingerprint = computeHeaderFingerprint(request.headers);
    const validUntil = Date.now() + 1800 * 1000; // 30 minutes

    const token = signGatekeeperToken({ ip, fingerprint, expiresAt: validUntil }, secret);
    const response = NextResponse.json({ success: true });

    const cookieName = process.env.NODE_ENV === 'production' ? '__Host-gatekeeper' : 'gatekeeper';
    response.cookies.set(cookieName, token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1800,
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Challenge verification failed' }, { status: 500 });
  }
}
