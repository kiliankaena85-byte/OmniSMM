import { describe, it, expect } from 'vitest';
import { suggestCorrectEmail } from '../email-typo-detector';

describe('suggestCorrectEmail', () => {
  it('should detect common typos like gmail.ru, gmai.com, yandx.ru', () => {
    expect(suggestCorrectEmail('user@gmail.ru')).toBe('user@gmail.com');
    expect(suggestCorrectEmail('alex@gmai.com')).toBe('alex@gmail.com');
    expect(suggestCorrectEmail('ivan@yandx.ru')).toBe('ivan@yandex.ru');
    expect(suggestCorrectEmail('test@mail.com')).toBe('test@mail.ru');
    expect(suggestCorrectEmail('boss@icloud.ru')).toBe('boss@icloud.com');
  });

  it('should return null for valid popular domains', () => {
    expect(suggestCorrectEmail('valid@gmail.com')).toBeNull();
    expect(suggestCorrectEmail('valid@yandex.ru')).toBeNull();
    expect(suggestCorrectEmail('valid@mail.ru')).toBeNull();
    expect(suggestCorrectEmail('valid@icloud.com')).toBeNull();
  });

  it('should return null for non-typo custom domains', () => {
    expect(suggestCorrectEmail('admin@smmplan.pro')).toBeNull();
    expect(suggestCorrectEmail('support@smmflux.ru')).toBeNull();
  });
});
