import { describe, it, expect } from 'vitest';
import { sanitizeSvg, normalizeIconDescriptor, isSvgMarkup } from '../safe-svg';
import { searchIconRegistry, suggestIconsFromName, BRAND_ICONS, METRIC_ICONS, FEATURE_ICONS } from '../icon-registry';

describe('Safe SVG Sanitizer & Validator (OWASP A03/A07 Pentest Immunity)', () => {
  it('should accept valid clean SVG markup', () => {
    const validSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
    const res = sanitizeSvg(validSvg);
    expect(res.success).toBe(true);
    expect(res.sanitized).toContain('<svg');
    expect(res.sanitized).toContain('</svg>');
  });

  it('should reject SVG with <script> tag (Stored XSS Protection)', () => {
    const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("XSS")</script><circle cx="10" cy="10" r="5"/></svg>';
    const res = sanitizeSvg(maliciousSvg);
    expect(res.success).toBe(false);
    expect(res.error).toContain('запрещенные исполняемые теги');
  });

  it('should reject SVG with onload event handler', () => {
    const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg" onload="fetch(\'http://attacker.com\')"><rect width="10" height="10"/></svg>';
    const res = sanitizeSvg(maliciousSvg);
    expect(res.success).toBe(false);
    expect(res.error).toContain('обработчики событий');
  });

  it('should reject SVG with javascript: pseudo-protocol in links', () => {
    const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:stealData()"><text>Click</text></a></svg>';
    const res = sanitizeSvg(maliciousSvg);
    expect(res.success).toBe(false);
    expect(res.error).toContain('псевдопротоколы javascript:');
  });

  it('should reject SVG with XXE entity injection', () => {
    const xxeSvg = '<!DOCTYPE svg [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]><svg>&xxe;</svg>';
    const res = sanitizeSvg(xxeSvg);
    expect(res.success).toBe(false);
    expect(res.error).toContain('XXE защита');
  });

  it('should reject SVG with foreignObject embedding', () => {
    const foreignObjSvg = '<svg><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><iframe src="evil.html"></iframe></body></foreignObject></svg>';
    const res = sanitizeSvg(foreignObjSvg);
    expect(res.success).toBe(false);
    expect(res.error).toContain('запрещенные исполняемые теги');
  });

  it('should reject SVG exceeding size limits (32KB)', () => {
    const hugePath = 'd="M0 0 ' + 'L1 1 '.repeat(8000) + 'Z"';
    const hugeSvg = `<svg xmlns="http://www.w3.org/2000/svg"><path ${hugePath}/></svg>`;
    const res = sanitizeSvg(hugeSvg);
    expect(res.success).toBe(false);
    expect(res.error).toContain('превышает допустимый лимит');
  });
});

describe('Icon Descriptor Normalizer', () => {
  it('should normalize canonical Lucide descriptors', () => {
    expect(normalizeIconDescriptor('lucide:heart').normalized).toBe('lucide:heart');
    expect(normalizeIconDescriptor('lucide:shield-check').normalized).toBe('lucide:shield-check');
    expect(normalizeIconDescriptor('heart').normalized).toBe('lucide:heart');
  });

  it('should normalize canonical Brand descriptors', () => {
    expect(normalizeIconDescriptor('brand:telegram').normalized).toBe('brand:telegram');
    expect(normalizeIconDescriptor('telegram').normalized).toBe('brand:telegram');
    expect(normalizeIconDescriptor('vk').normalized).toBe('brand:vk');
  });

  it('should normalize and sanitize inline SVG to custom prefix', () => {
    const cleanSvg = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';
    const res = normalizeIconDescriptor(cleanSvg);
    expect(res.success).toBe(true);
    expect(res.normalized?.startsWith('custom:<svg')).toBe(true);
  });

  it('should return null for empty values', () => {
    expect(normalizeIconDescriptor(null).normalized).toBe(null);
    expect(normalizeIconDescriptor('').normalized).toBe(null);
    expect(normalizeIconDescriptor('   ').normalized).toBe(null);
  });
});

describe('Icon Registry & Smart Suggestion Engine', () => {
  it('should find icons by Russian keyword search', () => {
    const likeResults = searchIconRegistry('лайк');
    expect(likeResults.some(i => i.id === 'lucide:heart')).toBe(true);

    const followerResults = searchIconRegistry('подписчики');
    expect(followerResults.some(i => i.id === 'lucide:users')).toBe(true);

    const warrantyResults = searchIconRegistry('гарантия');
    expect(warrantyResults.some(i => i.id === 'lucide:shield-check')).toBe(true);
  });

  it('should find icons by English keyword search', () => {
    const boostResults = searchIconRegistry('boost');
    expect(boostResults.some(i => i.id === 'lucide:rocket')).toBe(true);

    const viewsResults = searchIconRegistry('views');
    expect(viewsResults.some(i => i.id === 'lucide:eye')).toBe(true);
  });

  it('should filter by category', () => {
    const brandsOnly = searchIconRegistry('', 'social');
    expect(brandsOnly.every(i => i.category === 'social')).toBe(true);
    expect(brandsOnly.length).toBe(BRAND_ICONS.length);

    const metricsOnly = searchIconRegistry('', 'metric');
    expect(metricsOnly.every(i => i.category === 'metric')).toBe(true);
    expect(metricsOnly.length).toBe(METRIC_ICONS.length);
  });

  it('should auto-suggest appropriate icons based on entity name', () => {
    const tgSuggestions = suggestIconsFromName('Telegram Подписчики на канал', 'category');
    expect(tgSuggestions.some(i => i.id === 'brand:telegram' || i.id === 'lucide:users')).toBe(true);

    const speedSuggestions = suggestIconsFromName('Быстрые просмотры Reels', 'service');
    expect(speedSuggestions.some(i => i.id === 'lucide:zap' || i.id === 'lucide:eye' || i.id === 'lucide:play')).toBe(true);

    const guaranteeSuggestions = suggestIconsFromName('Живые лайки с гарантией 30 дней', 'service');
    expect(guaranteeSuggestions.some(i => i.id === 'lucide:shield-check' || i.id === 'lucide:heart')).toBe(true);
  });
});
