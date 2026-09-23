import { describe, it, expect } from 'vitest';
import { inferTargetTypeFromName } from '../utils/target-type';

describe('Auto Map Category & Poll/Vote Recognition Tests', () => {
  it('correctly infers POLL target type from Russian and English keywords', () => {
    expect(inferTargetTypeFromName('VK Голоса в Опрос [Россия][Живые]')).toBe('POLL');
    expect(inferTargetTypeFromName('Telegram Опрос в канал')).toBe('POLL');
    expect(inferTargetTypeFromName('Instagram Story Poll Votes')).toBe('POLL');
    expect(inferTargetTypeFromName('VK Голосование в конкурсе')).toBe('POLL');
  });

  it('normalizes VK platform correctly from raw strings', () => {
    const rawPlatforms = ['vk', 'VK', 'Vkontakte', 'VKONTAKTE', 'vk.com'];
    const normalized = rawPlatforms.map(p => 
      p.trim().toUpperCase()
        .replace(/^VKONTAKTE$/, 'VK')
        .replace(/^VK\.COM$/, 'VK')
    );
    expect(normalized.every(n => n === 'VK')).toBe(true);
  });
});
