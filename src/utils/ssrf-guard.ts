import { assertSafeOutboundUrl, safeFetch, isPublicIp } from '@/lib/security/ssrf-guard';

export { safeFetch, isPublicIp, assertSafeOutboundUrl };

export async function assertSafeUrl(url: string): Promise<void> {
  const res = await assertSafeOutboundUrl(url);
  if (!res.ok) {
    if (res.reason.includes('private')) {
      throw new Error('Private IP blocked');
    }
    if (res.reason.includes('scheme')) {
      throw new Error('Only HTTP/HTTPS allowed');
    }
    if (res.reason.includes('dns-failed')) {
      throw new Error(`Failed to resolve target hostname`);
    }
    throw new Error('Blocked URL');
  }
}
