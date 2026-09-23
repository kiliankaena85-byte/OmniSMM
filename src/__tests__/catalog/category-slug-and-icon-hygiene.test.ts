import { describe, it, expect } from 'vitest';
import { cleanCategoryName } from '@/components/ui/CategoryIcon';
import { cyrillicToSlug } from '@/utils/slugify';

describe('Category Icon Hygiene & Unicode Clean Text (Zero-Duplicate Icons)', () => {
  it('cleanCategoryName strips leading emojis and preserves 100% of Cyrillic text', () => {
    expect(cleanCategoryName('👥 Подписчики')).toBe('Подписчики');
    expect(cleanCategoryName('❤️ Лайки')).toBe('Лайки');
    expect(cleanCategoryName('🔥 Бусты')).toBe('Бусты');
    expect(cleanCategoryName('👁️ Просмотры')).toBe('Просмотры');
    expect(cleanCategoryName('✨ Премиум подписчики')).toBe('Премиум подписчики');
    expect(cleanCategoryName('🚀 Быстрые просмотры')).toBe('Быстрые просмотры');
  });

  it('cleanCategoryName preserves Cyrillic letters with diacritics and rare letters', () => {
    expect(cleanCategoryName('💬 Сообщения и отзывы')).toBe('Сообщения и отзывы');
    expect(cleanCategoryName('⭐ Звёзды Telegram')).toBe('Звёзды Telegram');
    expect(cleanCategoryName('🇷🇺 Русские подписчики')).toBe('Русские подписчики');
  });

  it('cleanCategoryName preserves inline reaction emojis and emoji sets', () => {
    expect(cleanCategoryName('🔥 Реакции (👍, ❤️, 🔥, 🎉)')).toBe('Реакции (👍, ❤️, 🔥, 🎉)');
    expect(cleanCategoryName('Позитивные реакции 👍❤️')).toBe('Позитивные реакции 👍❤️');
    expect(cleanCategoryName('Негативные реакции (👎, 💩)')).toBe('Негативные реакции (👎, 💩)');
    expect(cleanCategoryName('👍')).toBe('👍');
  });

  it('cleanCategoryName handles empty and clean strings without mutation', () => {
    expect(cleanCategoryName('')).toBe('');
    expect(cleanCategoryName('Подписчики')).toBe('Подписчики');
    expect(cleanCategoryName('   Лайки   ')).toBe('Лайки');
  });
});

describe('Category Cyrillic Transliteration & Slug Generator', () => {
  it('cyrillicToSlug converts Russian names to clean SEO-friendly slugs', () => {
    expect(cyrillicToSlug('Подписчики')).toBe('podpischiki');
    expect(cyrillicToSlug('Лайки')).toBe('layki');
    expect(cyrillicToSlug('Бусты')).toBe('busty');
    expect(cyrillicToSlug('Просмотры историй')).toBe('prosmotry-istoriy');
    expect(cyrillicToSlug('Звёзды & Реакции')).toBe('zvezdy-reaktsii');
  });

  it('cyrillicToSlug handles special characters and trims dashes', () => {
    expect(cyrillicToSlug('---Telegram---')).toBe('telegram');
    expect(cyrillicToSlug('VK / ВКонтакте')).toBe('vk-vkontakte');
    expect(cyrillicToSlug('100% Реальные подписчики!')).toBe('100-realnye-podpischiki');
  });
});
