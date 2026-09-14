import { describe, it, expect } from 'vitest';
import { IntelligenceLinkAnalyzer } from '../link-analyzer';
import { IntelligencePlatform } from '../link-rules';

describe('Strict Domain Requirement (Option B - INV-1)', () => {
  const analyzer = new IntelligenceLinkAnalyzer();

  it('rejects @handle without domain with MISSING_DOMAIN and does NOT guess Telegram', async () => {
    const result = await analyzer.analyze('@durov');
    expect(result.platform).toBe(IntelligencePlatform.OTHER);
    expect(result.errorCode).toBe('MISSING_DOMAIN');
    expect(result.userHint).toBeDefined();
    expect(result.userHint).toContain('t.me/durov');
  });

  it('rejects bare words without domain or dots with MISSING_DOMAIN', async () => {
    const result = await analyzer.analyze('durov');
    expect(result.platform).toBe(IntelligencePlatform.OTHER);
    expect(result.errorCode).toBe('MISSING_DOMAIN');
    expect(result.userHint).toBeDefined();
  });

  it('correctly identifies full telegram url with domain t.me', async () => {
    const result = await analyzer.analyze('https://t.me/durov');
    expect(result.platform).toBe(IntelligencePlatform.TELEGRAM);
    expect(result.id).toBe('durov');
    expect(result.errorCode).toBeUndefined();
  });

  it('correctly normalizes t.me/durov without https:// scheme to TELEGRAM', async () => {
    const result = await analyzer.analyze('t.me/durov');
    expect(result.platform).toBe(IntelligencePlatform.TELEGRAM);
    expect(result.id).toBe('durov');
    expect(result.errorCode).toBeUndefined();
  });

  it('correctly identifies VK profile with vk.com domain', async () => {
    const result = await analyzer.analyze('https://vk.com/durov');
    expect(result.platform).toBe(IntelligencePlatform.VK);
    expect(result.errorCode).toBeUndefined();
  });

  it('correctly identifies Instagram profile with instagram.com domain', async () => {
    const result = await analyzer.analyze('https://instagram.com/durov');
    expect(result.platform).toBe(IntelligencePlatform.INSTAGRAM);
    expect(result.errorCode).toBeUndefined();
  });

  it('correctly identifies TikTok profile with tiktok.com domain', async () => {
    const result = await analyzer.analyze('https://tiktok.com/@durov');
    expect(result.platform).toBe(IntelligencePlatform.TIKTOK);
    expect(result.errorCode).toBeUndefined();
  });
});
