import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { P0ThreatSensorService } from '@/services/telemetry/p0-threat-sensor.service';
import { verifySession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function verifyBearerToken(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret || !authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(secret);
  if (tokenBuf.length !== secretBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(tokenBuf, secretBuf);
}

async function isAuthorizedCaller(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (verifyBearerToken(authHeader, cronSecret)) {
    return true;
  }

  try {
    const session = await verifySession();
    if (session && (session.role === 'ADMIN' || session.role === 'OWNER')) {
      return true;
    }
  } catch {
    // Session verification failed or outside request context
  }

  return false;
}

export async function GET(req: Request) {
  const isAuthorized = await isAuthorizedCaller(req);
  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Unauthorized: Admin session or valid Bearer token required' },
      { status: 401 }
    );
  }

  try {
    const report = await P0ThreatSensorService.runFullP0Scan();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      report,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to run P0 scan' },
      { status: 500 }
    );
  }
}
