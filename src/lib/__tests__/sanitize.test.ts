import { describe, it, expect } from 'vitest';
import { sanitizeServiceDescription } from '../sanitize';

describe('sanitizeServiceDescription', () => {
  it('discards script tags along with content', () => {
    expect(sanitizeServiceDescription('<script>alert(1)</script>Текст')).toBe('Текст');
  });

  it('discards img tags with onerror handlers', () => {
    expect(sanitizeServiceDescription('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('discards iframe tags', () => {
    expect(sanitizeServiceDescription('<iframe src="evil.com"></iframe>Ок')).toBe('Ок');
  });

  it('preserves whitelisted formatting tags (b, br, p, etc.)', () => {
    expect(sanitizeServiceDescription('<b>жирный</b><br>строка')).toBe('<b>жирный</b><br />строка');
  });

  it('strips inline attributes like onclick', () => {
    expect(sanitizeServiceDescription('<p onclick="x()">абзац</p>')).toBe('<p>абзац</p>');
  });

  it('discards anchor tags while keeping inner text', () => {
    expect(sanitizeServiceDescription('<a href="http://konkurent.ru">ссылка</a>')).toBe('ссылка');
  });

  it('returns empty string for null or undefined input', () => {
    expect(sanitizeServiceDescription(null)).toBe('');
    expect(sanitizeServiceDescription(undefined)).toBe('');
  });
});
