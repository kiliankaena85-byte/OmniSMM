import { describe, it, expect } from 'vitest';
import {
  TargetTypeEnum,
  LinkType,
  normalizeTargetType,
  isTargetTypeCompatible,
  isLinkServiceCompatible,
  getCompatibilityError,
  resolveServiceTargetType,
} from '@/utils/target-type';

describe('Unified Link Engine (Tier 1 Architecture Tests - SPEC-2026-09-14)', () => {
  describe('1. WP-1: Unified Enum & Backward-Compatible Aliases', () => {
    it('provides identical values for canonical flat types and legacy aliases', () => {
      // Flat types
      expect(TargetTypeEnum.CHANNEL).toBe('CHANNEL');
      expect(TargetTypeEnum.PROFILE).toBe('PROFILE');
      expect(TargetTypeEnum.POST).toBe('POST');
      expect(TargetTypeEnum.VIDEO).toBe('VIDEO');
      expect(TargetTypeEnum.STORY).toBe('STORY');
      expect(TargetTypeEnum.POLL).toBe('POLL');
      expect(TargetTypeEnum.BOT).toBe('BOT');
      expect(TargetTypeEnum.COMMENTS).toBe('COMMENTS');
      expect(TargetTypeEnum.CHANNEL_POSTS).toBe('CHANNEL_POSTS');
      expect(TargetTypeEnum.CUSTOM).toBe('CUSTOM');

      // Legacy Aliases (Engine 1 compatibility)
      expect(TargetTypeEnum.POST_INTERACTION).toBe(TargetTypeEnum.POST);
      expect(TargetTypeEnum.VIDEO_INTERACTION).toBe(TargetTypeEnum.VIDEO);
      expect(TargetTypeEnum.STORY_INTERACTION).toBe(TargetTypeEnum.STORY);
      expect(TargetTypeEnum.POLL_VOTES).toBe(TargetTypeEnum.POLL);
      expect(TargetTypeEnum.BOT_STARTS).toBe(TargetTypeEnum.BOT);

      // LinkType mirror
      expect(LinkType).toBe(TargetTypeEnum);
    });

    it('correctly normalizes previously unhandled strings without falling into CUSTOM', () => {
      // AUTO_VIEWS was previously dropped to CUSTOM in target-type-mapper
      expect(normalizeTargetType('AUTO_VIEWS')).toBe(TargetTypeEnum.CHANNEL_POSTS);
      expect(normalizeTargetType('auto_views')).toBe(TargetTypeEnum.CHANNEL_POSTS);
      expect(normalizeTargetType('AUTO_POSTS')).toBe(TargetTypeEnum.CHANNEL_POSTS);

      // POLL_VOTES was previously dropped to CUSTOM in target-type-mapper
      expect(normalizeTargetType('POLL_VOTES')).toBe(TargetTypeEnum.POLL);
      expect(normalizeTargetType('poll_votes')).toBe(TargetTypeEnum.POLL);
      expect(normalizeTargetType('VOTES')).toBe(TargetTypeEnum.POLL);

      // BOT_STARTS was previously dropped to CUSTOM in target-type-mapper
      expect(normalizeTargetType('BOT_STARTS')).toBe(TargetTypeEnum.BOT);
      expect(normalizeTargetType('bot_starts')).toBe(TargetTypeEnum.BOT);
      expect(normalizeTargetType('REFERRAL')).toBe(TargetTypeEnum.BOT);

      // REVIEWS was previously dropped to CUSTOM in target-type-mapper
      expect(normalizeTargetType('REVIEWS')).toBe(TargetTypeEnum.COMMENTS);
      expect(normalizeTargetType('reviews')).toBe(TargetTypeEnum.COMMENTS);
      expect(normalizeTargetType('COMMENT')).toBe(TargetTypeEnum.COMMENTS);

      // Legacy aliases
      expect(normalizeTargetType('POST_INTERACTION')).toBe(TargetTypeEnum.POST);
      expect(normalizeTargetType('VIDEO_INTERACTION')).toBe(TargetTypeEnum.VIDEO);
      expect(normalizeTargetType('STORY_INTERACTION')).toBe(TargetTypeEnum.STORY);
    });
  });

  describe('2. WP-2: Harmonized 10x10 Compatibility Truth Table & Anomaly Resolution', () => {
    it('resolves Anomaly 1.1: VIDEO links accept COMMENTS services', () => {
      // Ordering comments on a YouTube/VK video or TikTok clip
      expect(isTargetTypeCompatible('video', TargetTypeEnum.COMMENTS)).toBe(true);
      expect(isLinkServiceCompatible('video', 'COMMENTS')).toBe(true);
      expect(isLinkServiceCompatible('video', TargetTypeEnum.COMMENTS)).toBe(true);
    });

    it('resolves Anomaly 1.2: POST links accept POLL services (polls embedded in Telegram/VK posts)', () => {
      expect(isTargetTypeCompatible('post', TargetTypeEnum.POLL)).toBe(true);
      expect(isLinkServiceCompatible('post', 'POLL')).toBe(true);
      expect(isLinkServiceCompatible('post', 'POLL_VOTES')).toBe(true);
    });

    it('resolves Anomaly 1.3: PROFILE links accept CHANNEL_POSTS services (profile post auto-monitoring)', () => {
      expect(isTargetTypeCompatible('profile', TargetTypeEnum.CHANNEL_POSTS)).toBe(true);
      expect(isLinkServiceCompatible('profile', 'CHANNEL_POSTS')).toBe(true);
      expect(isLinkServiceCompatible('profile', 'AUTO_VIEWS')).toBe(true);
    });

    it('strictly preserves defensive boundaries (disallowed combinations)', () => {
      // A post link CANNOT be used for channel subscribers
      expect(isTargetTypeCompatible('post', TargetTypeEnum.CHANNEL)).toBe(false);
      expect(isLinkServiceCompatible('post', 'CHANNEL')).toBe(false);

      // A channel link CANNOT be used for single post likes/views
      expect(isTargetTypeCompatible('channel', TargetTypeEnum.POST)).toBe(false);
      expect(isLinkServiceCompatible('channel', 'POST')).toBe(false);
      expect(isLinkServiceCompatible('channel', 'POST_INTERACTION')).toBe(false);

      // A single post link CANNOT be used for auto-post channel monitoring
      expect(isTargetTypeCompatible('post', TargetTypeEnum.CHANNEL_POSTS)).toBe(false);
      expect(isLinkServiceCompatible('post', 'CHANNEL_POSTS')).toBe(false);

      // A story link CANNOT be used for post likes or channel followers
      expect(isTargetTypeCompatible('story', TargetTypeEnum.POST)).toBe(false);
      expect(isTargetTypeCompatible('story', TargetTypeEnum.CHANNEL)).toBe(false);
      expect(isLinkServiceCompatible('story', 'CHANNEL')).toBe(false);

      // A non-story link CANNOT be used for story interactions
      expect(isTargetTypeCompatible('post', TargetTypeEnum.STORY)).toBe(false);
      expect(isTargetTypeCompatible('channel', TargetTypeEnum.STORY)).toBe(false);
      expect(isLinkServiceCompatible('channel', 'STORY')).toBe(false);
    });

    it('handles universal CUSTOM fallbacks as non-blocking', () => {
      expect(isTargetTypeCompatible('custom', TargetTypeEnum.POST)).toBe(true);
      expect(isTargetTypeCompatible('post', TargetTypeEnum.CUSTOM)).toBe(true);
      expect(isLinkServiceCompatible('unknown_link', 'CHANNEL')).toBe(true);
      expect(isLinkServiceCompatible('post', 'unknown_target')).toBe(true);
    });
  });

  describe('3. Educational Compatibility Error Messages', () => {
    it('returns educational Russian messages with actionable instructions', () => {
      const errChannelForPost = getCompatibilityError('channel', 'POST', 'Лайки на пост');
      expect(errChannelForPost).toContain('Лайки на пост');
      expect(errChannelForPost).toContain('отдельный пост');

      const errPostForChannel = getCompatibilityError('post', 'CHANNEL', 'Подписчики');
      expect(errPostForChannel).toContain('Подписчики');
      expect(errPostForChannel).toContain('ссылку на сам канал');

      const errPostForStory = getCompatibilityError('post', 'STORY', 'Просмотры сторис');
      expect(errPostForStory).toContain('Истории');
    });
  });

  describe('4. Semantic Service Resolution (Prisma Default POST Override)', () => {
    it('overrides default POST with name-inferred type when service targetType is default POST', () => {
      const service = {
        name: 'Telegram Подписчики на канал [Быстрый старт]',
        targetType: 'POST', // Default from DB schema
      };

      const resolved = resolveServiceTargetType(service);
      expect(resolved).toBe(TargetTypeEnum.CHANNEL);
      expect(isLinkServiceCompatible('channel', resolved)).toBe(true);
      expect(isLinkServiceCompatible('post', resolved)).toBe(false);
    });
  });
});
