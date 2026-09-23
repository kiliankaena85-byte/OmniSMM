import { NextRequest, NextResponse } from 'next/server';
import { handleTelegramWebhookRequest } from '@/lib/telegram/webhook-handler';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const targetTenant = url.searchParams.get('tenant') || 'smmplan';
  return handleTelegramWebhookRequest(req, targetTenant);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const targetTenant = url.searchParams.get('tenant') || 'smmplan';
  return NextResponse.json({ status: 'ok', service: 'telegram-webhook', tenantId: targetTenant });
}

