import { describe, it, expect } from 'vitest';
import { stripQueryParams, inferPlatformFromInput, normalizeUsername } from '@/utils/link-normalizer';

describe('link-normalizer — Smart Link Normalizer & Parameter Stripper', () => {

  describe('stripQueryParams', () => {
    it('returns empty string for empty input', () => {
      expect(stripQueryParams('')).toBe('');
      expect(stripQueryParams('   ')).toBe('');
    });

    it('strips tracking query parameters from valid URLs', () => {
      const url = 'https://instagram.com/p/C7Xy123/?igsh=MW12M20zd21h&utm_source=qr';
      expect(stripQueryParams(url)).toBe('https://instagram.com/p/C7Xy123');
    });

    it('strips multiple different trackers while keeping whitelisted path structure', () => {
      const url = 'https://t.me/durov/156?utm_medium=android_app&utm_campaign=main&fbclid=ab12cd34';
      expect(stripQueryParams(url)).toBe('https://t.me/durov/156');
    });

    it('removes trailing slash after query string removal', () => {
      const url = 'https://vk.com/my_group/?utm_source=vk_ads';
      expect(stripQueryParams(url)).toBe('https://vk.com/my_group');
    });

    it('does not touch clean URLs', () => {
      const url = 'https://instagram.com/durov';
      expect(stripQueryParams(url)).toBe('https://instagram.com/durov');
    });

    it('handles non-url inputs safely by using regex replace', () => {
      const text = 'instagram.com/p/C7Xy123?igsh=MW12M2&utm_source=qr';
      expect(stripQueryParams(text)).toBe('instagram.com/p/C7Xy123');
    });
  });

  describe('inferPlatformFromInput', () => {
    it('detects Instagram platform correctly', () => {
      expect(inferPlatformFromInput('https://instagram.com/p/123')).toBe('instagram');
      expect(inferPlatformFromInput('https://www.instagr.am/p/123')).toBe('instagram');
    });

    it('detects Telegram platform correctly', () => {
      expect(inferPlatformFromInput('https://t.me/durov')).toBe('telegram');
      expect(inferPlatformFromInput('http://telegram.me/durov')).toBe('telegram');
    });

    it('detects VK platform correctly', () => {
      expect(inferPlatformFromInput('https://vk.com/wall-123_456')).toBe('vk');
      expect(inferPlatformFromInput('http://vkontakte.ru/id1')).toBe('vk');
    });

    it('returns null for unknown inputs', () => {
      expect(inferPlatformFromInput('https://google.com')).toBeNull();
      expect(inferPlatformFromInput('some_random_text')).toBeNull();
    });
  });

  describe('normalizeUsername', () => {
    it('returns empty string for empty input', () => {
      expect(normalizeUsername('', 'telegram')).toBe('');
    });

    it('returns clean URL directly if input is already a URL', () => {
      expect(normalizeUsername('https://t.me/durov?utm_source=1', 'telegram')).toBe('https://t.me/durov');
    });

    it('converts @username handle to valid Instagram URL', () => {
      expect(normalizeUsername('@katya_smm', 'instagram')).toBe('https://instagram.com/katya_smm');
    });

    it('converts simple username handle without @ to valid Instagram URL', () => {
      expect(normalizeUsername('katya_smm', 'instagram')).toBe('https://instagram.com/katya_smm');
    });

    it('converts @username to valid Telegram URL', () => {
      expect(normalizeUsername('@durov', 'telegram')).toBe('https://t.me/durov');
    });

    it('converts @username to valid VK URL', () => {
      expect(normalizeUsername('@vk_group', 'vk')).toBe('https://vk.com/vk_group');
    });

    it('returns input unchanged if it has invalid handle characters', () => {
      expect(normalizeUsername('my-invalid-name!', 'instagram')).toBe('my-invalid-name!');
    });
  });
});
