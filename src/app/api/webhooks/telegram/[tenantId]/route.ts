import { NextRequest, NextResponse } from 'next/server';
import { handleTelegramWebhookRequest } from '@/app/api/webhooks/telegram/_lib/webhook-handler';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  return handleTelegramWebhookRequest(req, tenantId);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  return NextResponse.json({
    status: 'ok',
    service: 'telegram-webhook',
    tenantId,
  });
}
