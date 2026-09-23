// SC04 Negative Fixture: Fail-Closed Webhook Guard
import { verifyWebhook } from '@/lib/webhook-verify';

export function handleWebhook(rawBody: string, signatureHeader: string, secret: string) {
  const res = verifyWebhook({ rawBody, signatureHeader, secret, gateway: 'yookassa' });
  if (!res.verified) throw new Error('Forbidden');
}
