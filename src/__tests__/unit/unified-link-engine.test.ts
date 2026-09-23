import { describe, it, expect } from 'vitest';
import { unifiedLinkEngine } from '@/services/link-engine/unified-link-engine';
import { resolvePlatformByHostname, isSupportedSocialHost } from '@/services/link-engine/link-domain-router';
import { canonicalizeUrl } from '@/services/link-engine/link-canonicalizer';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';

describe('UnifiedLinkEngine Architecture & Integration Suite', () => {
  describe('1. Fast-Path Domain Router (O(1) Resolution)', () => {
    it('accurately resolves primary domains', () => {
      expect(resolvePlatformByHostname('t.me')).toBe(IntelligencePlatform.TELEGRAM);
      expect(resolvePlatformByHostname('vk.com')).toBe(IntelligencePlatform.VK);
      expect(resolvePlatformByHostname('instagram.com')).toBe(IntelligencePlatform.INSTAGRAM);
      expect(resolvePlatformByHostname('youtube.com')).toBe(IntelligencePlatform.YOUTUBE);
      expect(resolvePlatformByHostname('tiktok.com')).toBe(IntelligencePlatform.TIKTOK);
      expect(resolvePlatformByHostname('rutube.ru')).toBe(IntelligencePlatform.RUTUBE);
    });

    it('resolves mobile and short subdomains', () => {
      expect(resolvePlatformByHostname('m.vk.com')).toBe(IntelligencePlatform.VK);
      expect(resolvePlatformByHostname('m.instagram.com')).toBe(IntelligencePlatform.INSTAGRAM);
      expect(resolvePlatformByHostname('vm.tiktok.com')).toBe(IntelligencePlatform.TIKTOK);
      expect(resolvePlatformByHostname('youtu.be')).toBe(IntelligencePlatform.YOUTUBE);
    });

    it('identifies unsupported/unknown domains as null', () => {
      expect(resolvePlatformByHostname('unknown-site-123.com')).toBeNull();
      expect(isSupportedSocialHost('evil-hacker.org')).toBe(false);
    });
  });

  describe('2. Link Canonicalizer & Tracking Stripper', () => {
    it('strips tracking params while keeping core URL clean', () => {
      const dirtyUrl = 'https://instagram.com/p/Cxyz123/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==';
      const clean = canonicalizeUrl(dirtyUrl, IntelligencePlatform.INSTAGRAM, 'POST');
      expect(clean).toBe('https://instagram.com/p/Cxyz123/');
      expect(clean).not.toContain('utm_source');
      expect(clean).not.toContain('igsh');
    });

    it('preserves functional reply parameter in VK comments', () => {
      const commentUrl = 'https://vk.com/wall-123_456?reply=789&utm_campaign=spam';
      const clean = canonicalizeUrl(commentUrl, IntelligencePlatform.VK, 'COMMENT');
      expect(clean).toContain('reply=789');
      expect(clean).not.toContain('utm_campaign');
    });

    it('normalizes mobile hostnames to canonical versions', () => {
      expect(canonicalizeUrl('http://m.vk.com/durov')).toBe('https://vk.com/durov');
      expect(canonicalizeUrl('http://twitter.com/elonmusk')).toBe('https://x.com/elonmusk');
    });
  });

  describe('3. Strict Domain Requirement (Variant B Invariant)', () => {
    it('rejects bare @handle without domain with MISSING_DOMAIN', async () => {
      const res = await unifiedLinkEngine.analyze('@durov');
      expect(res.errorCode).toBe('MISSING_DOMAIN');
      expect(res.userHint).toContain('t.me/durov');
    });

    it('rejects bare single words without dots with MISSING_DOMAIN', async () => {
      const res = await unifiedLinkEngine.analyze('durov');
      expect(res.errorCode).toBe('MISSING_DOMAIN');
    });

    it('successfully processes full Telegram links with domain', async () => {
      const res = await unifiedLinkEngine.analyze('https://t.me/durov');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(res.type).toBe('channel');
    });

    it('auto-normalizes domain-valid links without https:// scheme', async () => {
      const res = await unifiedLinkEngine.analyze('t.me/durov');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
    });
  });

  describe('4. End-to-End Service Validation (Zero False-Incompatibility Rule 4.1)', () => {
    const subscriberService = {
      id: 'srv-tg-subs',
      name: 'Подписчики Telegram (Канал/Группа)',
      targetType: 'POST', // Prisma schema default trap!
      category: {
        name: 'Подписчики / Участники',
        network: { slug: 'telegram' }
      }
    };

    const postViewService = {
      id: 'srv-tg-views',
      name: 'Просмотры на пост Telegram',
      targetType: 'POST',
      category: {
        name: 'Просмотры публикаций',
        network: { slug: 'telegram' }
      }
    };

    const storyService = {
      id: 'srv-tg-stories',
      name: 'Просмотры историй Telegram',
      targetType: 'STORY',
      category: {
        name: 'Сториз / Истории',
        network: { slug: 'telegram' }
      }
    };

    it('correctly validates channel link for subscriber service despite DB default targetType=POST', async () => {
      const res = await unifiedLinkEngine.validateForService('https://t.me/durov', subscriberService);
      expect(res.isValid).toBe(true);
      expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(res.error).toBeUndefined();
    });

    it('rejects post link for subscriber service with clear semantic compatibility error', async () => {
      const res = await unifiedLinkEngine.validateForService('https://t.me/durov/123', subscriberService);
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('INCOMPATIBLE_TARGET_TYPE');
      expect(res.error).toContain('канал');
    });

    it('accepts post link for view service', async () => {
      const res = await unifiedLinkEngine.validateForService('https://t.me/durov/123', postViewService);
      expect(res.isValid).toBe(true);
      expect(res.canonicalUrl).toBe('https://t.me/durov/123');
    });

    it('accepts Telegram Stories link for story service', async () => {
      const res = await unifiedLinkEngine.validateForService('https://t.me/durov/s/1', storyService);
      expect(res.isValid).toBe(true);
      expect(res.linkType).toBe('story');
    });

    it('blocks SSRF loopback and private IP links', async () => {
      const resLoopback = await unifiedLinkEngine.validateForService('http://127.0.0.1:3000', subscriberService);
      expect(resLoopback.isValid).toBe(false);
      expect(resLoopback.errorCode).toBe('SECURITY_BLOCKED');

      const resIpv6 = await unifiedLinkEngine.validateForService('http://[::1]/secret', subscriberService);
      expect(resIpv6.isValid).toBe(false);
      expect(resIpv6.errorCode).toBe('SECURITY_BLOCKED');
    });
  });

  describe('5. High-Throughput Batch Processing', () => {
    it('processes batch inputs deterministically', async () => {
      const mockService = {
        id: 'srv-1',
        name: 'Лайки ВКонтакте',
        targetType: 'POST',
        category: {
          name: 'Лайки на стену',
          network: { slug: 'vk' }
        }
      };

      const batchItems = [
        { link: 'https://vk.com/wall-1_2', service: mockService },
        { link: 'https://vk.com/video-1_2', service: mockService },
        { link: 'https://vk.com/clip-1_2', service: mockService },
        { link: 'https://t.me/durov', service: mockService }, // mismatch network
      ];

      const results = await unifiedLinkEngine.validateBatch(batchItems);
      expect(results).toHaveLength(4);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(true);
      expect(results[3].isValid).toBe(false); // platform mismatch
      expect(results[3].error).toContain('VK');
    });
  });
});
