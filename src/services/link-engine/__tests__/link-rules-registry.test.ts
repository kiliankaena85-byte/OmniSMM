/**
 * Tests for Link Rules Registry & Declarative Link Specifications (SIL-2026)
 * Verifies that getUnifiedLinkSpecification produces accurate, safe regexes and user hints
 * across platforms and targetTypes for catalog service import and storefront checkout.
 */
import { describe, it, expect } from 'vitest';
import { getUnifiedLinkSpecification, getUnifiedLinkValidator } from '../link-rules-registry';

describe('Unified Link Rules Registry & Specification Engine', () => {
  describe('Telegram Link Specifications', () => {
    it('generates correct specs for Telegram channel / subscribers', () => {
      const spec = getUnifiedLinkSpecification('telegram', 'CHANNEL', 'SUBSCRIBERS');
      expect(spec.targetType).toBe('CHANNEL');
      expect(spec.placeholder).toContain('t.me');
      expect(spec.hint).toContain('Telegram');
      expect(spec.regex).toBeDefined();
      expect(spec.customDataType).toBe('NONE');
      expect(spec.isMediaGroupAware).toBe(false);
    });

    it('generates correct specs for Telegram post / views', () => {
      const spec = getUnifiedLinkSpecification('telegram', 'POST', 'VIEWS');
      expect(spec.targetType).toBe('POST');
      expect(spec.placeholder).toContain('t.me');
      expect(spec.isMediaGroupAware).toBe(true);
      expect(spec.customDataType).toBe('NONE');
    });

    it('generates correct specs for Telegram poll votes with NUMBER customData', () => {
      const spec = getUnifiedLinkSpecification('telegram', 'POLL', 'POLLS');
      expect(spec.targetType).toBe('POLL');
      expect(spec.customDataType).toBe('NUMBER');
      expect(spec.customDataLabel).toContain('Номер варианта');
    });

    it('generates correct specs for Telegram comments with TEXTAREA customData', () => {
      const spec = getUnifiedLinkSpecification('telegram', 'COMMENTS', 'COMMENTS');
      expect(spec.targetType).toBe('COMMENTS');
      expect(spec.customDataType).toBe('TEXTAREA');
      expect(spec.customDataLabel).toContain('комментар');
    });

    it('generates correct specs for Telegram bot starts', () => {
      const spec = getUnifiedLinkSpecification('telegram', 'BOT', 'BOTS');
      expect(spec.targetType).toBe('BOT');
      expect(spec.placeholder).toContain('_bot');
    });

    it('generates correct specs for Telegram story', () => {
      const spec = getUnifiedLinkSpecification('telegram', 'STORY', 'STORIES');
      expect(spec.targetType).toBe('STORY');
      expect(spec.placeholder).toContain('/s/');
    });
  });

  describe('VKontakte Link Specifications', () => {
    it('generates correct specs for VK community / profile', () => {
      const spec = getUnifiedLinkSpecification('vk', 'CHANNEL', 'SUBSCRIBERS');
      expect(spec.targetType).toBe('CHANNEL');
      expect(spec.placeholder).toContain('vk.com');
      expect(spec.regex).toBeDefined();
    });

    it('generates correct specs for VK wall post', () => {
      const spec = getUnifiedLinkSpecification('vk', 'POST', 'LIKES');
      expect(spec.targetType).toBe('POST');
      expect(spec.placeholder).toContain('wall');
    });
  });

  describe('YouTube Link Specifications', () => {
    it('generates correct specs for YouTube channel', () => {
      const spec = getUnifiedLinkSpecification('youtube', 'CHANNEL', 'SUBSCRIBERS');
      expect(spec.targetType).toBe('CHANNEL');
      expect(spec.placeholder).toContain('@channel_name');
    });

    it('generates correct specs for YouTube video', () => {
      const spec = getUnifiedLinkSpecification('youtube', 'VIDEO', 'VIEWS');
      expect(spec.targetType).toBe('VIDEO');
      expect(spec.placeholder).toContain('watch?v=');
    });
  });

  describe('Instagram Link Specifications', () => {
    it('generates correct specs for Instagram profile', () => {
      const spec = getUnifiedLinkSpecification('instagram', 'PROFILE', 'SUBSCRIBERS');
      expect(spec.targetType).toBe('PROFILE');
      expect(spec.placeholder).toContain('instagram.com/username');
      expect(spec.clientRequirement).toContain('открыт');
    });

    it('generates correct specs for Instagram post/reel', () => {
      const spec = getUnifiedLinkSpecification('instagram', 'POST', 'LIKES');
      expect(spec.targetType).toBe('POST');
      expect(spec.placeholder).toContain('/p/');
    });
  });

  describe('TikTok Link Specifications', () => {
    it('generates correct specs for TikTok profile', () => {
      const spec = getUnifiedLinkSpecification('tiktok', 'PROFILE', 'SUBSCRIBERS');
      expect(spec.targetType).toBe('PROFILE');
      expect(spec.placeholder).toContain('tiktok.com/@');
    });

    it('generates correct specs for TikTok video', () => {
      const spec = getUnifiedLinkSpecification('tiktok', 'VIDEO', 'VIEWS');
      expect(spec.targetType).toBe('VIDEO');
      expect(spec.placeholder).toContain('/video/');
    });
  });

  describe('Rutube, Dzen, Likee, Discord Link Specifications', () => {
    it('generates correct specs for Rutube channel and video', () => {
      const ch = getUnifiedLinkSpecification('rutube', 'CHANNEL', 'SUBSCRIBERS');
      expect(ch.targetType).toBe('CHANNEL');
      expect(ch.placeholder).toContain('rutube.ru/channel');

      const vid = getUnifiedLinkSpecification('rutube', 'VIDEO', 'VIEWS');
      expect(vid.targetType).toBe('VIDEO');
      expect(vid.placeholder).toContain('rutube.ru/video');
    });

    it('generates correct specs for Dzen channel and publication', () => {
      const ch = getUnifiedLinkSpecification('dzen', 'CHANNEL', 'SUBSCRIBERS');
      expect(ch.targetType).toBe('CHANNEL');
      expect(ch.placeholder).toContain('dzen.ru');

      const post = getUnifiedLinkSpecification('dzen', 'POST', 'VIEWS');
      expect(post.targetType).toBe('POST');
      expect(post.placeholder).toContain('dzen.ru/a/');
    });

    it('generates correct specs for Likee profile and video', () => {
      const prof = getUnifiedLinkSpecification('likee', 'PROFILE', 'SUBSCRIBERS');
      expect(prof.targetType).toBe('PROFILE');
      expect(prof.placeholder).toContain('likee.video/@');

      const vid = getUnifiedLinkSpecification('likee', 'VIDEO', 'VIEWS');
      expect(vid.targetType).toBe('VIDEO');
      expect(vid.placeholder).toContain('likee.video/@user/video');
    });

    it('generates correct specs for Discord invite', () => {
      const spec = getUnifiedLinkSpecification('discord', 'CHANNEL', 'SUBSCRIBERS');
      expect(spec.targetType).toBe('CHANNEL');
      expect(spec.placeholder).toContain('discord.gg');
    });
  });

  describe('Fallback Link Specifications', () => {
    it('provides safe fallback for unknown platforms', () => {
      const spec = getUnifiedLinkSpecification('unknown_metaverse', 'POST', 'VIEWS');
      expect(spec.targetType).toBe('POST');
      expect(spec.placeholder).toBe('https://...');
      expect(spec.regex).toBeDefined();
    });
  });

  describe('Manual Provider Service Creation Link Specs Resolution', () => {
    it('resolves Telegram channel subscriber specs for manual creation', () => {
      const spec = getUnifiedLinkSpecification('telegram', 'CHANNEL', 'SUBSCRIBERS');
      expect(spec.placeholder).toContain('t.me/');
      expect(spec.hint).toContain('канал');
      expect(spec.clientRequirement).toContain('доступны');
      expect(spec.regex).toBeDefined();
    });

    it('resolves VK wall post like specs for manual creation', () => {
      const spec = getUnifiedLinkSpecification('vk', 'POST', 'LIKES');
      expect(spec.placeholder).toContain('vk.com/wall');
      expect(spec.hint).toContain('запись');
      expect(spec.clientRequirement).toContain('публичной');
      expect(spec.regex).toBeDefined();
    });

    it('resolves YouTube video view specs for manual creation', () => {
      const spec = getUnifiedLinkSpecification('youtube', 'VIDEO', 'VIEWS');
      expect(spec.placeholder).toContain('youtube.com/watch?v=');
      expect(spec.hint).toContain('видео');
      expect(spec.regex).toBeDefined();
    });
  });
});
