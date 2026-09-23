import { describe, it, expect } from 'vitest';
import {
  LinkType,
  ServiceTargetType,
  normalizeLinkType,
  normalizeServiceTargetType,
  isLinkServiceCompatible,
  getCompatibilityError,
} from './link-service-compatibility';

describe('Link-Service Compatibility Truth Table (100% Cell Coverage)', () => {
  describe('Normalization Layer', () => {
    it('normalizes lowercase link types to canonical LinkType enum', () => {
      expect(normalizeLinkType('channel')).toBe(LinkType.CHANNEL);
      expect(normalizeLinkType('group')).toBe(LinkType.CHANNEL);
      expect(normalizeLinkType('profile')).toBe(LinkType.PROFILE);
      expect(normalizeLinkType('user')).toBe(LinkType.PROFILE);
      expect(normalizeLinkType('post')).toBe(LinkType.POST);
      expect(normalizeLinkType('video')).toBe(LinkType.VIDEO);
      expect(normalizeLinkType('story')).toBe(LinkType.STORY);
      expect(normalizeLinkType('poll')).toBe(LinkType.POLL);
      expect(normalizeLinkType('bot')).toBe(LinkType.BOT);
      expect(normalizeLinkType('unknown_xyz')).toBe(LinkType.CUSTOM);
    });

    it('normalizes legacy and colloquial service target types to ServiceTargetType enum', () => {
      expect(normalizeServiceTargetType('CHANNEL')).toBe(ServiceTargetType.CHANNEL);
      expect(normalizeServiceTargetType('SUBSCRIBERS')).toBe(ServiceTargetType.CHANNEL);
      expect(normalizeServiceTargetType('PROFILE')).toBe(ServiceTargetType.PROFILE);
      expect(normalizeServiceTargetType('LIKES')).toBe(ServiceTargetType.POST_INTERACTION);
      expect(normalizeServiceTargetType('POST')).toBe(ServiceTargetType.POST_INTERACTION);
      expect(normalizeServiceTargetType('VIDEO')).toBe(ServiceTargetType.VIDEO_INTERACTION);
      expect(normalizeServiceTargetType('AUTO_VIEWS')).toBe(ServiceTargetType.CHANNEL_POSTS);
      expect(normalizeServiceTargetType('AUTO_POSTS')).toBe(ServiceTargetType.CHANNEL_POSTS);
      expect(normalizeServiceTargetType('POLL_VOTES')).toBe(ServiceTargetType.POLL_VOTES);
      expect(normalizeServiceTargetType('COMMENTS')).toBe(ServiceTargetType.COMMENTS);
    });
  });

  describe('Strict Compatibility Matrix', () => {
    it('CHANNEL link compatibility', () => {
      // ✅ Permitted
      expect(isLinkServiceCompatible(LinkType.CHANNEL, ServiceTargetType.CHANNEL)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.CHANNEL, ServiceTargetType.CHANNEL_POSTS)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.CHANNEL, ServiceTargetType.PROFILE)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.CHANNEL, ServiceTargetType.CUSTOM)).toBe(true);

      // ❌ Blocked
      expect(isLinkServiceCompatible(LinkType.CHANNEL, ServiceTargetType.POST_INTERACTION)).toBe(false);
      expect(isLinkServiceCompatible(LinkType.CHANNEL, ServiceTargetType.VIDEO_INTERACTION)).toBe(false);
      expect(isLinkServiceCompatible(LinkType.CHANNEL, ServiceTargetType.STORY_INTERACTION)).toBe(false);
      expect(isLinkServiceCompatible(LinkType.CHANNEL, ServiceTargetType.COMMENTS)).toBe(false);
    });

    it('PROFILE link compatibility (Critical Likes Bug Prevention)', () => {
      // ✅ Permitted
      expect(isLinkServiceCompatible(LinkType.PROFILE, ServiceTargetType.PROFILE)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.PROFILE, ServiceTargetType.CHANNEL)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.PROFILE, ServiceTargetType.CHANNEL_POSTS)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.PROFILE, ServiceTargetType.CUSTOM)).toBe(true);

      // ❌ Blocked: Likes on profile link is strictly forbidden!
      expect(isLinkServiceCompatible(LinkType.PROFILE, ServiceTargetType.POST_INTERACTION)).toBe(false);
      expect(isLinkServiceCompatible(LinkType.PROFILE, ServiceTargetType.VIDEO_INTERACTION)).toBe(false);
      expect(isLinkServiceCompatible(LinkType.PROFILE, ServiceTargetType.STORY_INTERACTION)).toBe(false);
      expect(isLinkServiceCompatible(LinkType.PROFILE, ServiceTargetType.COMMENTS)).toBe(false);
    });

    it('POST link compatibility', () => {
      // ✅ Permitted
      expect(isLinkServiceCompatible(LinkType.POST, ServiceTargetType.POST_INTERACTION)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.POST, ServiceTargetType.VIDEO_INTERACTION)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.POST, ServiceTargetType.COMMENTS)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.POST, ServiceTargetType.POLL_VOTES)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.POST, ServiceTargetType.CUSTOM)).toBe(true);

      // ❌ Blocked: Subscribers or Auto-Views on single post link
      expect(isLinkServiceCompatible(LinkType.POST, ServiceTargetType.CHANNEL)).toBe(false);
      expect(isLinkServiceCompatible(LinkType.POST, ServiceTargetType.PROFILE)).toBe(false);
      expect(isLinkServiceCompatible(LinkType.POST, ServiceTargetType.CHANNEL_POSTS)).toBe(false);
      expect(isLinkServiceCompatible(LinkType.POST, ServiceTargetType.STORY_INTERACTION)).toBe(false);
      expect(isLinkServiceCompatible(LinkType.POST, ServiceTargetType.BOT_STARTS)).toBe(false);
    });

    it('VIDEO link compatibility', () => {
      expect(isLinkServiceCompatible(LinkType.VIDEO, ServiceTargetType.VIDEO_INTERACTION)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.VIDEO, ServiceTargetType.POST_INTERACTION)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.VIDEO, ServiceTargetType.COMMENTS)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.VIDEO, ServiceTargetType.CHANNEL)).toBe(false);
      expect(isLinkServiceCompatible(LinkType.VIDEO, ServiceTargetType.PROFILE)).toBe(false);
    });

    it('STORY link compatibility', () => {
      expect(isLinkServiceCompatible(LinkType.STORY, ServiceTargetType.STORY_INTERACTION)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.STORY, ServiceTargetType.POST_INTERACTION)).toBe(false);
      expect(isLinkServiceCompatible(LinkType.STORY, ServiceTargetType.CHANNEL)).toBe(false);
      expect(isLinkServiceCompatible(LinkType.STORY, ServiceTargetType.VIDEO_INTERACTION)).toBe(false);
    });

    it('POLL link compatibility', () => {
      expect(isLinkServiceCompatible(LinkType.POLL, ServiceTargetType.POLL_VOTES)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.POLL, ServiceTargetType.POST_INTERACTION)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.POLL, ServiceTargetType.CHANNEL)).toBe(false);
    });

    it('BOT link compatibility', () => {
      expect(isLinkServiceCompatible(LinkType.BOT, ServiceTargetType.BOT_STARTS)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.BOT, ServiceTargetType.CHANNEL)).toBe(true);
      expect(isLinkServiceCompatible(LinkType.BOT, ServiceTargetType.POST_INTERACTION)).toBe(false);
    });
  });

  describe('Educational Error Messaging', () => {
    it('returns informative explanation when profile link is provided for likes', () => {
      const err = getCompatibilityError(LinkType.PROFILE, ServiceTargetType.POST_INTERACTION, 'Лайки на пост');
      expect(err).toContain('прямую ссылку на конкретный пост или фото, а не на страницу профиля');
    });

    it('returns informative explanation when channel link is provided for post likes', () => {
      const err = getCompatibilityError(LinkType.CHANNEL, ServiceTargetType.POST_INTERACTION, 'Лайки');
      expect(err).toContain('отдельный пост в канале');
    });

    it('returns informative explanation when post link is provided for subscribers', () => {
      const err = getCompatibilityError(LinkType.POST, ServiceTargetType.CHANNEL, 'Подписчики');
      expect(err).toContain('ссылку на сам канал');
    });

    it('returns informative explanation when post link is provided for channel auto-views', () => {
      const err = getCompatibilityError(LinkType.POST, ServiceTargetType.CHANNEL_POSTS, 'Автопросмотры');
      expect(err).toContain('требуется ссылка на канал целиком');
    });
  });
});
