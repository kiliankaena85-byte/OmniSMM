export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { handleYooKassaWebhookRequest } from '@/services/financial/yookassa-webhook.handler';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  return handleYooKassaWebhookRequest(req, tenantId);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  return NextResponse.json({
    status: 'ok',
    service: 'yookassa-webhook',
    tenantId,
  });
}
