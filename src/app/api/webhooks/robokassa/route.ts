export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { handleRobokassaWebhookRequest } from '@/services/financial/robokassa-webhook.handler';

export async function POST(req: NextRequest) {
  return handleRobokassaWebhookRequest(req);
}
