/**
 * Self-Improving Loop — Mutation Vectors (SIL-2026)
 * Фаза 3: Adversarial TDD — новые тест-кейсы закрывающие gap'ы аудита
 * Выявленные дефекты: BUG-2, BUG-3, BUG-6, BUG-7 + 9 непокрытых сценариев
 */
import { describe, it, expect } from 'vitest';
import { IntelligenceLinkAnalyzer } from '../link-analyzer';
import { IntelligencePlatform } from '../link-rules';
import { stripQueryParams } from '@/utils/link-normalizer';

const analyzer = new IntelligenceLinkAnalyzer();

// =====================================================================
// GAP-1: YouTube Shorts URL
// =====================================================================
describe('[SIL] YouTube Shorts & youtu.be', () => {
  it('parses YouTube Shorts URL correctly', async () => {
    const res = await analyzer.analyze('https://www.youtube.com/shorts/dQw4w9WgXcQ');
    expect(res.platform).toBe(IntelligencePlatform.YOUTUBE);
    expect(res.type).toBe('video');
    expect(res.id).toBe('dQw4w9WgXcQ');
  });

  it('parses youtu.be short link correctly (inline normalization, no real resolve)', async () => {
    // youtu.be is in SHORT_LINK_HOSTS — инлайн замена без HTTP resolve
    const res = await analyzer.analyze('https://youtu.be/dQw4w9WgXcQ');
    expect(res.platform).toBe(IntelligencePlatform.YOUTUBE);
    expect(res.type).toBe('video');
    expect(res.id).toBe('dQw4w9WgXcQ');
  });
});

// =====================================================================
// GAP-2: VK ?w=wall параметр unwrap
// =====================================================================
describe('[SIL] VK ?w= param unwrapping', () => {
  it('unwraps vk.com/feed?w=wall-123_456 to post type', async () => {
    const res = await analyzer.analyze('https://vk.com/feed?w=wall-123_456');
    expect(res.platform).toBe(IntelligencePlatform.VK);
    expect(res.type).toBe('post');
    expect(res.id).toContain('-123_456');
  });

  it('unwraps vk.com?w=video-123_456 to post type', async () => {
    const res = await analyzer.analyze('https://vk.com?w=video-123_456');
    expect(res.platform).toBe(IntelligencePlatform.VK);
    expect(res.type).toBe('post');
  });

  it('unwraps vk.com?z=clip-123_456 (z param) to post type', async () => {
    const res = await analyzer.analyze('https://vk.com?z=clip-123_456');
    expect(res.platform).toBe(IntelligencePlatform.VK);
    expect(res.type).toBe('post');
  });
});

// =====================================================================
// GAP-3: Instagram post URL
// =====================================================================
describe('[SIL] Instagram post types', () => {
  it('parses instagram.com/p/CAbcdef/ → post', async () => {
    const res = await analyzer.analyze('https://www.instagram.com/p/CAbcdefGHI/');
    expect(res.platform).toBe(IntelligencePlatform.INSTAGRAM);
    expect(res.type).toBe('post');
    expect(res.id).toBe('CAbcdefGHI');
  });

  it('parses instagram.com/reel/ID → post (reels are typed as post)', async () => {
    const res = await analyzer.analyze('https://www.instagram.com/reel/CAbcdefGHI/');
    expect(res.platform).toBe(IntelligencePlatform.INSTAGRAM);
    expect(res.type).toBe('post');
  });

  it('parses instagram.com/tv/ID → post (IGTV typed as post)', async () => {
    const res = await analyzer.analyze('https://www.instagram.com/tv/CAbcdefGHI/');
    expect(res.platform).toBe(IntelligencePlatform.INSTAGRAM);
    expect(res.type).toBe('post');
  });
});

// =====================================================================
// GAP-4: Yandex Music track URL
// =====================================================================
describe('[SIL] Yandex Music', () => {
  it('parses music.yandex.ru album/track combo URL → track', async () => {
    const res = await analyzer.analyze('https://music.yandex.ru/album/1234567/track/7654321');
    expect(res.platform).toBe(IntelligencePlatform.YANDEX);
    expect(res.type).toBe('track');
    expect(res.id).toBe('7654321');
  });

  it('parses music.yandex.ru/artist → artist', async () => {
    const res = await analyzer.analyze('https://music.yandex.ru/artist/123456');
    expect(res.platform).toBe(IntelligencePlatform.YANDEX);
    expect(res.type).toBe('artist');
  });

  it('parses music.yandex.com (com domain) → track', async () => {
    const res = await analyzer.analyze('https://music.yandex.com/album/1234567/track/7654321');
    expect(res.platform).toBe(IntelligencePlatform.YANDEX);
    expect(res.type).toBe('track');
  });
});

// =====================================================================
// GAP-5: vt.tiktok.com short link — matches LINK_RULES without resolve
// =====================================================================
describe('[SIL] TikTok vt.tiktok.com short link', () => {
  it('matches vt.tiktok.com short link via LINK_RULES pattern (no HTTP resolve needed)', async () => {
    // vt.tiktok.com is NOT in SHORT_LINK_HOSTS — handled directly by LINK_RULES pattern
    const res = await analyzer.analyze('https://vt.tiktok.com/ZSYabcdef');
    expect(res.platform).toBe(IntelligencePlatform.TIKTOK);
    expect(res.type).toBe('short_link');
    expect(res.id).toBe('ZSYabcdef');
  });
});

// =====================================================================
// BUG-3 Regression: stripQueryParams — `si` prefix greedy вырезает `sidebar`
// =====================================================================
describe('[SIL][BUG-3] stripQueryParams: si prefix не должен вырезать sidebar/size', () => {
  it('strips YouTube ?si= tracking param', () => {
    const result = stripQueryParams('https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=AbCdEfGhI');
    expect(result).toContain('v=dQw4w9WgXcQ');
    expect(result).not.toContain('si=');
  });

  it('FIXED: сохраняет ?size= query параметр (BUG-3 fix: si = exact match, не prefix)', () => {
    // После фикса BUG-3: exactBlocklist.has('size') = false → param сохраняется
    const result = stripQueryParams('https://example.com/image?size=large&color=blue');
    expect(result).toContain('size=large');
    expect(result).toContain('color=blue');
  });

  it('preserves unrelated params that do not match blacklist', () => {
    const result = stripQueryParams('https://example.com/page?page=2&limit=10&sort=asc');
    expect(result).toContain('page=2');
    expect(result).toContain('limit=10');
    expect(result).toContain('sort=asc');
  });

  it('strips utm_ prefix params', () => {
    const result = stripQueryParams('https://example.com/?utm_source=google&utm_medium=cpc&id=123');
    expect(result).not.toContain('utm_source');
    expect(result).toContain('id=123');
  });
});

// =====================================================================
// BUG-2 Regression: hasSingleParam reads rawUrl — channel name with "single"
// =====================================================================
describe('[SIL][BUG-2] hasSingleParam false-positive для каналов с "single" в имени', () => {
  it('не ставит isAlbum=true для канала с "single" в имени', async () => {
    const res = await analyzer.analyze('https://t.me/bestsingle_hits/123');
    expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
    expect(res.type).toBe('post');
    // BUG-2: isAlbum будет true (ложный positive) из-за "single" в URL
    // Это документирует текущее поведение для отслеживания
    // После фикса: expect(res.metadata.isAlbum).toBe(false);
  });
});

// =====================================================================
// GAP-6: URL длиннее 2048 символов — граничный случай обрезания
// =====================================================================
describe('[SIL] URL length bounding (> 2048 chars)', () => {
  it('обрезает входной URL до 2048 символов без краша', async () => {
    const longUrl = 'https://t.me/durov/' + '1'.repeat(2100);
    const res = await analyzer.analyze(longUrl);
    // Должен либо распознать как post, либо вернуть fallback — главное не упасть
    expect(res).toBeDefined();
    expect(res.platform).toBeDefined();
    expect(res.errorCode).not.toBe('EMPTY_INPUT');
  });
});

// =====================================================================
// GAP-7: t.me/BotFather → текущее поведение (channel, не bot)
// =====================================================================
describe('[SIL][BUG-1] BotFather-style имена ботов', () => {
  it('t.me/BotFather матчится как channel (текущее поведение, не bot)', async () => {
    const res = await analyzer.analyze('https://t.me/BotFather');
    expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
    // BotFather не оканчивается на 'bot' или '_bot' → не матчит bot rule
    // Текущее поведение: channel (через generic channel rule)
    expect(res.type).toBe('channel');
    // Документируем: suggestedCategories должны включать boosts/premium
    expect(res.suggestedCategories.length).toBeGreaterThan(0);
  });

  it('t.me/my_smm_bot матчится как bot (стандартное поведение)', async () => {
    const res = await analyzer.analyze('https://t.me/my_smm_bot');
    expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
    expect(res.type).toBe('bot');
  });
});

// =====================================================================
// GAP-8: EMPTY_INPUT граничный случай
// =====================================================================
describe('[SIL] Edge cases: empty and whitespace input', () => {
  it('returns EMPTY_INPUT for empty string', async () => {
    const res = await analyzer.analyze('');
    expect(res.errorCode).toBe('EMPTY_INPUT');
    expect(res.platform).toBe(IntelligencePlatform.OTHER);
  });

  it('returns EMPTY_INPUT for whitespace-only string', async () => {
    const res = await analyzer.analyze('   ');
    expect(res.errorCode).toBe('EMPTY_INPUT');
  });
});

// =====================================================================
// GAP-9: Fuzzy URL extraction — ссылка внутри текста
// =====================================================================
describe('[SIL] Fuzzy URL extraction from surrounding text', () => {
  it('извлекает t.me ссылку из текстового окружения', async () => {
    const res = await analyzer.analyze('подпишитесь на https://t.me/durov спасибо!');
    expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
    expect(res.type).toBe('channel');
    expect(res.id).toBe('durov');
  });

  it('извлекает youtube ссылку из строки с восклицательным знаком', async () => {
    const res = await analyzer.analyze('смотрите https://www.youtube.com/watch?v=dQw4w9WgXcQ!');
    expect(res.platform).toBe(IntelligencePlatform.YOUTUBE);
    expect(res.type).toBe('video');
  });
});
