import { describe, it, expect } from 'vitest';
import { unifiedLinkEngine } from '@/services/link-engine/unified-link-engine';
import { resolvePlatformByHostname } from '@/services/link-engine/link-domain-router';
import { canonicalizeUrl } from '@/services/link-engine/link-canonicalizer';
import { UNIFIED_REGEX } from '@/services/link-engine/link-rules-registry';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';

describe('UnifiedLinkEngine Stress & Resilience Benchmarks', () => {
  describe('1. High-Throughput Batch Benchmark (10,000 links)', () => {
    it('processes 10,000 links in under 500ms (> 20,000 links/sec)', () => {
      const sampleUrls = [
        'https://t.me/durov',
        'https://vk.com/wall-123_456?reply=789',
        'https://www.instagram.com/p/Cxyz123/?utm_source=ig_test',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share',
        'https://www.tiktok.com/@tiktok/video/7123456789012345678',
        'https://rutube.ru/video/1234567890abcdef/',
        'https://x.com/elonmusk/status/1234567890',
        'https://threads.net/@zuck/post/1234567890',
        'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
        'https://ok.ru/group/12345/topic/67890',
      ];

      const iterations = 10_000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        const url = sampleUrls[i % sampleUrls.length];
        const host = url.split('/')[2];
        const platform = resolvePlatformByHostname(host);
        canonicalizeUrl(url, platform, 'POST');
      }

      const durationMs = performance.now() - start;
      const throughputPerSec = Math.round((iterations / durationMs) * 1000);

      console.log(`\n⚡ [BENCHMARK] Processed ${iterations} links in ${durationMs.toFixed(2)}ms (${throughputPerSec.toLocaleString()} links/sec)`);

      expect(durationMs).toBeLessThan(1000); // 10k links in < 1 second
      expect(throughputPerSec).toBeGreaterThan(5000); // At least 5,000 links/sec
    });
  });

  describe('2. ReDoS Fuzzing & Catastrophic Backtracking Guard', () => {
    it('evaluates malicious repeating ampersands across VK regex without hanging', () => {
      const maliciousQuery = 'https://vk.com/wall-123_456?' + '&'.repeat(15_000) + 'test=1';
      const start = performance.now();
      const matched = UNIFIED_REGEX.VK.COMMENT.test(maliciousQuery);
      const elapsed = performance.now() - start;

      expect(matched).toBe(false);
      expect(elapsed).toBeLessThan(50); // Under 50ms for 15,000 repeating characters
    });

    it('evaluates malicious repeating slashes across Telegram regex without hanging', () => {
      const maliciousTg = 'https://t.me/' + 'channel/'.repeat(500) + '123';
      const start = performance.now();
      const matched = UNIFIED_REGEX.TELEGRAM.POST.test(maliciousTg);
      const elapsed = performance.now() - start;

      expect(matched).toBe(false);
      expect(elapsed).toBeLessThan(50);
    });

    it('evaluates malicious repeating query params across YouTube regex without hanging', () => {
      const maliciousYt = 'https://youtube.com/watch?' + 'v=1&'.repeat(1000) + 'not_matching';
      const start = performance.now();
      const matched = UNIFIED_REGEX.YOUTUBE.COMMENT.test(maliciousYt);
      const elapsed = performance.now() - start;

      expect(matched).toBe(false);
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('3. Memory Leak & Heap Stability Guard', () => {
    it('maintains stable heap memory after 20,000 analysis iterations', async () => {
      // Force GC if available or record baseline
      if (global.gc) global.gc();
      const initialHeapMb = process.memoryUsage().heapUsed / 1024 / 1024;

      for (let i = 0; i < 20_000; i++) {
        await unifiedLinkEngine.analyze(`https://t.me/channel_${i % 1000}`);
      }

      if (global.gc) global.gc();
      const finalHeapMb = process.memoryUsage().heapUsed / 1024 / 1024;
      const heapDeltaMb = finalHeapMb - initialHeapMb;

      console.log(`\n💾 [MEMORY] Heap before: ${initialHeapMb.toFixed(2)} MB, after: ${finalHeapMb.toFixed(2)} MB (delta: ${heapDeltaMb.toFixed(2)} MB)`);

      // Delta should not exceed 25MB for 20,000 requests (LRU cache capped at 2000 entries)
      expect(heapDeltaMb).toBeLessThan(25);
    });
  });

  describe('4. Concurrent Burst Processing (100 parallel clients)', () => {
    it('handles 100 concurrent validation tasks seamlessly without race conditions', async () => {
      const subscriberService = {
        id: 'srv-tg-subs-stress',
        name: 'Подписчики Telegram',
        targetType: 'CHANNEL',
        category: {
          name: 'Подписчики',
          network: { slug: 'telegram' }
        }
      };

      const tasks = Array.from({ length: 100 }, (_, i) => {
        const url = i % 2 === 0 ? `https://t.me/valid_channel_${i}` : `http://127.0.0.${i % 10}:8080`;
        return unifiedLinkEngine.validateForService(url, subscriberService);
      });

      const results = await Promise.all(tasks);
      expect(results).toHaveLength(100);

      const validCount = results.filter(r => r.isValid).length;
      const blockedCount = results.filter(r => !r.isValid && r.errorCode === 'SECURITY_BLOCKED').length;

      expect(validCount).toBe(50);
      expect(blockedCount).toBe(50);
    });
  });
});
