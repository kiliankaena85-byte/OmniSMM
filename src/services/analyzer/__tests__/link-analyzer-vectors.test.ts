import { describe, it, expect } from 'vitest';
import { IntelligenceLinkAnalyzer } from '../link-analyzer';
import { IntelligencePlatform } from '../link-rules';
import { CATEGORY_LABELS } from '@/services/providers/smart-analyzer.logic';
import { resolveServiceTargetType, isTargetTypeCompatible, TargetTypeEnum } from '@/utils/target-type';

describe('Failure Vectors: Stories, Topics, Private Invites & TargetType Resolution', () => {
  const analyzer = new IntelligenceLinkAnalyzer();

  describe('Telegram Stories', () => {
    it('accurately identifies Telegram stories with /s/ID as type story', async () => {
      const res = await analyzer.analyze('https://t.me/durov/s/1');
      expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(res.type).toBe('story');
      expect(res.suggestedCategories).toContain(CATEGORY_LABELS.STORIES);
      expect(res.suggestedCategories).toContain(CATEGORY_LABELS.VIEWS);
    });

    it('accurately identifies Telegram stories for custom channel handles', async () => {
      const res = await analyzer.analyze('https://t.me/some_channel-name/s/42');
      expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(res.type).toBe('story');
    });
  });

  describe('Telegram Forum Topics & Web Preview Posts', () => {
    it('correctly matches forum topic message links as type post with message ID', async () => {
      const res = await analyzer.analyze('https://t.me/groupname/100/250');
      expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(res.type).toBe('post');
      expect(res.id).toBe('250');
    });

    it('correctly matches topic links with /topic/ prefix', async () => {
      const res = await analyzer.analyze('https://t.me/groupname/topic/105');
      expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(res.type).toBe('post');
      expect(res.id).toBe('105');
    });

    it('correctly matches web preview post links with /s/channel/post', async () => {
      const res = await analyzer.analyze('https://t.me/s/durov/123');
      expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(res.type).toBe('post');
      expect(res.id).toBe('123');
    });
  });

  describe('Telegram Private Invites (+ and joinchat)', () => {
    it('flags t.me/+ links as private invite with subscribers only', async () => {
      const res = await analyzer.analyze('https://t.me/+AbCdEfGh123');
      expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(res.type).toBe('channel');
      expect(res.metadata.isPrivateInvite).toBe(true);
      expect(res.suggestedCategories).toEqual([CATEGORY_LABELS.SUBSCRIBERS]);
    });

    it('flags t.me/joinchat links as private invite with subscribers only', async () => {
      const res = await analyzer.analyze('https://t.me/joinchat/AbCdEfGh123');
      expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(res.type).toBe('channel');
      expect(res.metadata.isPrivateInvite).toBe(true);
      expect(res.suggestedCategories).toEqual([CATEGORY_LABELS.SUBSCRIBERS]);
    });
  });

  describe('TargetType Resolution in Checkout', () => {
    it('resolves default POST to CHANNEL for subscriber services based on name', () => {
      const service = {
        name: 'Telegram Подписчики (Быстрые)',
        targetType: 'POST'
      };
      const resolved = resolveServiceTargetType(service);
      expect(resolved).toBe(TargetTypeEnum.CHANNEL);
      expect(isTargetTypeCompatible('channel', resolved)).toBe(true);
    });

    it('resolves default POST to CHANNEL_POSTS for auto-views services based on name', () => {
      const service = {
        name: 'Telegram Автопросмотры на 10 постов',
        targetType: 'POST'
      };
      const resolved = resolveServiceTargetType(service);
      expect(resolved).toBe(TargetTypeEnum.CHANNEL_POSTS);
      expect(isTargetTypeCompatible('channel', resolved)).toBe(true);
    });

    it('resolves default POST to STORY for Telegram Story services based on name', () => {
      const service = {
        name: 'Telegram Просмотры историй (Сториз)',
        targetType: 'POST'
      };
      const resolved = resolveServiceTargetType(service);
      expect(resolved).toBe(TargetTypeEnum.STORY);
      expect(isTargetTypeCompatible('story', resolved)).toBe(true);
    });
  });
});
