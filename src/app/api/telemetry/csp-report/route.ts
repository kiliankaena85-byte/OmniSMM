export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { SecurityAlertService } from '@/services/security/security-alert.service';

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
    const reportData = (parsed['csp-report'] || parsed['body'] || parsed) as Record<string, unknown>;

    // Record CSP violation as WARNING
    await SecurityAlertService.record({
      event: 'CSP_VIOLATION',
      severity: 'WARNING',
      ip,
      tenantId: 'smmplan',
      details: {
        blockedUri: reportData['blocked-uri'] || reportData['blockedURL'],
        violatedDirective: reportData['violated-directive'] || reportData['effectiveDirective'],
        documentUri: reportData['document-uri'] || reportData['documentURL'],
        userAgent,
      },
    });

    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
