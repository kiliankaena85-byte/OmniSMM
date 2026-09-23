export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { handleYooKassaWebhookRequest } from '@/services/financial/yookassa-webhook.handler';

export async function POST(req: NextRequest) {
  return handleYooKassaWebhookRequest(req);
}
