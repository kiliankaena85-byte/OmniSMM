import { describe, it, expect } from 'vitest';
import {
  TargetTypeEnum,
  normalizeTargetType,
  isTargetTypeCompatible,
  inferTargetTypeFromName,
  inferTargetTypeFromCategory,
} from '@/utils/target-type';
import { matchesSuggestedCategory } from '@/services/analyzer/category-matcher';
import { IntelligenceLinkAnalyzer } from '@/services/analyzer/link-analyzer';

describe('Order Flow Downstream Integrity & Smart Service Rules', () => {
  const analyzer = new IntelligenceLinkAnalyzer();

  describe('1. Dual Validation & URL Depth Rules (Post vs Channel)', () => {
    it('correctly distinguishes URL depth between channel and specific post in Telegram', async () => {
      const channelResult = await analyzer.analyze('https://t.me/durov');
      expect(channelResult.type).toBe('channel');

      const postResult = await analyzer.analyze('https://t.me/durov/123');
      expect(postResult.type).toBe('post');

      // Channel URL is compatible with CHANNEL and CHANNEL_POSTS
      expect(isTargetTypeCompatible(channelResult.type, TargetTypeEnum.CHANNEL)).toBe(true);
      expect(isTargetTypeCompatible(channelResult.type, TargetTypeEnum.CHANNEL_POSTS)).toBe(true);
      expect(isTargetTypeCompatible(channelResult.type, TargetTypeEnum.POST)).toBe(false);

      // Post URL is compatible ONLY with POST/VIDEO/COMMENTS, NOT CHANNEL or CHANNEL_POSTS
      expect(isTargetTypeCompatible(postResult.type, TargetTypeEnum.POST)).toBe(true);
      expect(isTargetTypeCompatible(postResult.type, TargetTypeEnum.CHANNEL)).toBe(false);
      expect(isTargetTypeCompatible(postResult.type, TargetTypeEnum.CHANNEL_POSTS)).toBe(false);
    });
  });

  describe('2. Smart Services & CHANNEL_POSTS Logic', () => {
    it('blocks CHANNEL_POSTS for single post links, but permits for channel links', () => {
      const detectedPost = 'post';
      const detectedChannel = 'channel';

      // Scenario: Auto views on next 10 posts (CHANNEL_POSTS)
      const serviceTargetType = TargetTypeEnum.CHANNEL_POSTS;

      expect(isTargetTypeCompatible(detectedPost, serviceTargetType)).toBe(false);
      expect(isTargetTypeCompatible(detectedChannel, serviceTargetType)).toBe(true);
    });
  });

  describe('3. Category Mutation & Filtering Safety', () => {
    it('strictly hides subscriber categories when analyzing a post URL', () => {
      const detectedPost = 'post';
      const suggested = ['views', 'reactions', 'comments'];

      // Category "Подписчики"
      const isSubscribersAllowed = matchesSuggestedCategory('Подписчики Telegram', suggested, 'subscribers,members', detectedPost);
      expect(isSubscribersAllowed).toBe(false);

      // Category "Просмотры"
      const isViewsAllowed = matchesSuggestedCategory('Просмотры на пост Telegram', suggested, 'views,post', detectedPost);
      expect(isViewsAllowed).toBe(true);
    });
  });

  describe('4. Multi-Platform Media Type Handling (Video & Story)', () => {
    it('validates VIDEO targetType compatibility for YouTube and TikTok video links', async () => {
      const ytResult = await analyzer.analyze('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(ytResult.type).toBe('video');
      expect(isTargetTypeCompatible(ytResult.type, TargetTypeEnum.VIDEO)).toBe(true);
      expect(isTargetTypeCompatible(ytResult.type, TargetTypeEnum.POST)).toBe(true);
      expect(isTargetTypeCompatible(ytResult.type, TargetTypeEnum.CHANNEL)).toBe(false);

      const ttResult = await analyzer.analyze('https://www.tiktok.com/@user/video/7123456789012345678');
      expect(ttResult.type).toBe('video');
      expect(isTargetTypeCompatible(ttResult.type, TargetTypeEnum.VIDEO)).toBe(true);
    });

    it('validates STORY targetType exclusivity', async () => {
      const storyType = TargetTypeEnum.STORY;
      expect(isTargetTypeCompatible('story', storyType)).toBe(true);
      expect(isTargetTypeCompatible('post', storyType)).toBe(false);
      expect(isTargetTypeCompatible('channel', storyType)).toBe(false);
    });
  });

  describe('5. Fallback & Resilience Handling', () => {
    it('safely handles unknown or generic link types via CUSTOM fallback (non-blocking)', () => {
      const genericType = 'generic_link';
      // When type is generic/unknown, system falls back to CUSTOM which is universally non-blocking
      expect(isTargetTypeCompatible(genericType, TargetTypeEnum.CUSTOM)).toBe(true);
      expect(isTargetTypeCompatible(genericType, TargetTypeEnum.POST)).toBe(true);
    });
  });
});
