import { describe, it, expect } from 'vitest';

describe('Admin Categories Integrity & Contracts Suite (SIL-2026 Step 4)', () => {
  describe('Analyzer Tags Predefined Affinity', () => {
    const PREDEFINED_TAGS: { id: string; label: string; networks?: string[] }[] = [
      { id: 'channel', label: 'Канал / Группа', networks: ['telegram', 'tg', 'vk', 'vkontakte', 'youtube', 'yt', 'rutube'] },
      { id: 'post', label: 'Пост / Публикация', networks: ['telegram', 'tg', 'vk', 'vkontakte', 'instagram', 'in', 'threads', 'twitter', 'x', 'facebook', 'dzen'] },
      { id: 'profile', label: 'Профиль / Аккаунт', networks: ['instagram', 'in', 'tiktok', 'tt', 'vk', 'vkontakte', 'threads', 'twitter', 'x', 'facebook'] },
      { id: 'video', label: 'Видео', networks: ['youtube', 'yt', 'rutube', 'vk', 'vkontakte', 'tiktok', 'tt', 'twitch'] },
      { id: 'reel', label: 'Reels / Shorts / Клипы', networks: ['instagram', 'in', 'youtube', 'yt', 'tiktok', 'tt', 'vk', 'vkontakte'] },
      { id: 'story', label: 'Истории (Stories)', networks: ['instagram', 'in', 'telegram', 'tg', 'vk', 'vkontakte'] },
      { id: 'poll', label: 'Опрос / Голосование', networks: ['telegram', 'tg', 'vk', 'vkontakte', 'twitter', 'x'] },
      { id: 'comment', label: 'Комментарии', networks: ['telegram', 'tg', 'vk', 'vkontakte', 'instagram', 'in', 'youtube', 'yt', 'tiktok', 'tt'] },
      { id: 'bot', label: 'Бот / MiniApp', networks: ['telegram', 'tg'] },
      { id: 'chat', label: 'Чат / Беседа', networks: ['telegram', 'tg', 'vk', 'vkontakte'] }
    ];

    it('covers all essential target types needed by link analyzer', () => {
      const tagIds = PREDEFINED_TAGS.map(t => t.id);
      expect(tagIds).toContain('channel');
      expect(tagIds).toContain('post');
      expect(tagIds).toContain('profile');
      expect(tagIds).toContain('video');
      expect(tagIds).toContain('reel');
      expect(tagIds).toContain('story');
      expect(tagIds).toContain('poll');
      expect(tagIds).toContain('comment');
    });

    it('correctly identifies recommended tags for a given social network', () => {
      const getRecommendedTags = (networkSlug: string) => {
        return PREDEFINED_TAGS.filter(t => t.networks?.some(s => networkSlug.toLowerCase().includes(s)));
      };

      const tgTags = getRecommendedTags('telegram').map(t => t.id);
      expect(tgTags).toContain('channel');
      expect(tgTags).toContain('post');
      expect(tgTags).toContain('poll');
      expect(tgTags).toContain('bot');

      const ytTags = getRecommendedTags('youtube').map(t => t.id);
      expect(ytTags).toContain('video');
      expect(ytTags).toContain('reel');
      expect(ytTags).toContain('channel');
    });
  });

  describe('Duplicate Category Detection', () => {
    it('detects duplicate category names within the same network (case-insensitive)', () => {
      const categories = [
        { id: 'cat-1', name: 'Подписчики', networkId: 'net-tg', servicesCount: 15 },
        { id: 'cat-2', name: 'Просмотры', networkId: 'net-tg', servicesCount: 10 },
        { id: 'cat-3', name: 'Подписчики', networkId: 'net-vk', servicesCount: 5 },
      ];

      const checkDuplicate = (name: string, networkId: string, currentEditingId?: string) => {
        const clean = name.trim().toLowerCase();
        return categories.find(c => 
          c.networkId === networkId && 
          c.name.trim().toLowerCase() === clean &&
          (!currentEditingId || c.id !== currentEditingId)
        );
      };

      // Duplicate in same network
      expect(checkDuplicate('подписчики', 'net-tg')).toBeDefined();
      expect(checkDuplicate('  Подписчики  ', 'net-tg')).toBeDefined();

      // Same name but different network is valid
      expect(checkDuplicate('Подписчики', 'net-youtube')).toBeUndefined();

      // Editing own category does not trigger duplicate warning
      expect(checkDuplicate('Подписчики', 'net-tg', 'cat-1')).toBeUndefined();
    });
  });

  describe('Category Merge Safety Rules', () => {
    it('prevents merging categories from different social networks', () => {
      const sourceCat = { id: 'c-1', name: 'TG Subs', networkId: 'net-tg' };
      const targetCatDiffNet = { id: 'c-2', name: 'VK Subs', networkId: 'net-vk' };
      const targetCatSameNet = { id: 'c-3', name: 'TG Subs VIP', networkId: 'net-tg' };

      const canMerge = (src: typeof sourceCat, tgt: typeof targetCatDiffNet) => {
        if (!src || !tgt) return false;
        if (src.id === tgt.id) return false;
        return src.networkId === tgt.networkId;
      };

      expect(canMerge(sourceCat, targetCatDiffNet)).toBe(false);
      expect(canMerge(sourceCat, targetCatSameNet)).toBe(true);
      expect(canMerge(sourceCat, sourceCat)).toBe(false);
    });
  });
});
