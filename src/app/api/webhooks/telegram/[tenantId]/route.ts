import { NextRequest, NextResponse } from 'next/server';
import { handleTelegramWebhookRequest } from '@/lib/telegram/webhook-handler';
import { multiBotManager } from '@/bot/manager/multi-bot-manager';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  return handleTelegramWebhookRequest(req, tenantId, multiBotManager);
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
