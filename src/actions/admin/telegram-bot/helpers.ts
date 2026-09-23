import { db } from '@/lib/db';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';
import { getTelegramDispatcher } from '@/lib/telegram-agent';

export function generateCuid2(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const timestamp = Math.floor(Date.now() / 1000).toString(36);
  let random = '';
  for (let i = 0; i < 16; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${timestamp}${random}`;
}

export async function getTenantId(explicitTenantId?: string): Promise<string> {
  if (explicitTenantId) return (normalizeTenantId(explicitTenantId) as string) || 'smmplan';
  try {
    const { headers: getHeaders } = await import('next/headers');
    const reqHeaders = await getHeaders();
    const headerTenant = reqHeaders.get('x-tenant-id');
    if (headerTenant) return (normalizeTenantId(headerTenant) as string) || 'smmplan';
  } catch {
    // Expected fallback when called outside request context
  }
  return 'smmplan';
}

export async function getBotToken(targetTenantId?: string): Promise<string | null> {
  const tenantId = await getTenantId(targetTenantId);
  try {
    const { VaultService } = await import('@/lib/vault');
    const settings = await db.systemSettings.findUnique({ where: { id: tenantId } });
    if (settings?.telegramBotToken) {
      const decrypted = VaultService.decrypt(settings.telegramBotToken);
      if (decrypted && decrypted.trim().length > 10) {
        return decrypted.trim();
      }
    }
  } catch {
    // Best-effort token retrieval from vault
  }
  const envToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (envToken && /^\d{8,11}:[A-Za-z0-9_-]{35}$/.test(envToken) && !envToken.includes('YOUR_') && envToken !== 'dummy_token' && tenantId === 'smmplan') {
    return envToken;
  }
  return null;
}

export const ALLOWED_TELEGRAM_HOSTS = ['api.telegram.org'];

export async function safeTelegramFetch(url: string, init?: RequestInit): Promise<Response> {
  const parsedUrl = new URL(url);
  if (!ALLOWED_TELEGRAM_HOSTS.includes(parsedUrl.hostname)) {
    throw new Error(`SSRF blocked: hostname ${parsedUrl.hostname} not in allowlist`);
  }
  const dispatcher = getTelegramDispatcher();
  const signal = init?.signal || AbortSignal.timeout(10000);
  // @ts-expect-error Node.js undici dispatcher support
  return fetch(url, { ...init, signal, dispatcher, cache: 'no-store' });
}
