import { isPublicIp, isPublicHost } from './ssrf-guard';

export { isPublicIp, isPublicHost };

/**
 * Validates that a given URL or hostname is safe from Server-Side Request Forgery (SSRF).
 * Blocks loopback (127.0.0.0/8, ::1), private RFC1918 networks, and cloud metadata (169.254.169.254).
 */
export async function validateUrlNoSSRF(urlString: string): Promise<boolean> {
  if (!urlString || typeof urlString !== 'string') return false;
  const cleanInput = urlString.trim();

  let hostname = cleanInput;
  if (cleanInput.includes('://')) {
    try {
      const parsed = new URL(cleanInput);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }
      hostname = parsed.hostname;
    } catch {
      return false;
    }
  } else if (hostname.includes(':')) {
    hostname = hostname.split(':')[0];
  }

  return isPublicHost(hostname);
}
