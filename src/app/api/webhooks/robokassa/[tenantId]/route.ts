export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { handleRobokassaWebhookRequest } from '@/services/financial/robokassa-webhook.handler';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  return handleRobokassaWebhookRequest(req, tenantId);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  return NextResponse.json({
    status: 'ok',
    service: 'robokassa-webhook',
    tenantId,
  });
}
