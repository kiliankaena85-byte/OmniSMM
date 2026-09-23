import { describe, it, expect } from 'vitest';
import { validateProhibitedContent, PROHIBITED_GOVERNMENT_DOMAINS } from '../prohibited-content';
import { orderFormSchema } from '../order.validators';

describe('Content Guard & Political / Government Prohibition Validator', () => {
  it('allows safe, legitimate commercial links', () => {
    const safeLinks = [
      'https://t.me/my_fashion_shop',
      'https://vk.com/club12345678',
      'https://www.youtube.com/@tech_reviewer_2026',
      'https://instagram.com/coffee_bakery_moscow',
    ];

    for (const link of safeLinks) {
      const result = validateProhibitedContent(link);
      expect(result.isAllowed).toBe(true);
      expect(result.error).toBeUndefined();
    }
  });

  it('blocks all official government and state voting domains', () => {
    const govLinks = [
      'https://gosuslugi.ru/services/election',
      'https://roi.ru/123456',
      'https://kremlin.ru/acts/news',
      'https://mvd.gov.ru/news/item/999',
      'http://council.gov.ru/events/news/',
      'https://cikrf.ru/results/2026',
      'https://change.org/p/political-petition',
    ];

    for (const link of govLinks) {
      const result = validateProhibitedContent(link);
      expect(result.isAllowed).toBe(false);
      expect(result.code).toBe('GOVERNMENT_SERVICE_PROHIBITED');
      expect(result.error).toContain('государственных служб');
    }
  });

  it('blocks political, election, and state keyword slugs in links', () => {
    const politicalLinks = [
      'https://t.me/vybory_2026_rf',
      'https://t.me/fsb_official_channel',
      'https://vk.com/gosuslugi_poll',
    ];

    for (const link of politicalLinks) {
      const result = validateProhibitedContent(link);
      expect(result.isAllowed).toBe(false);
      expect(result.code).toBeDefined();
    }
  });

  it('blocks dangerous political / agitation text in custom comments', () => {
    const prohibitedComments = [
      'Голосуйте за кандидата Иванова на выборах в Госдуму!',
      'Все на митинг против власти!',
      'Подпишите петицию на РОИ против закона',
      'Дискредитация ВС РФ и распространение фейков об армии',
    ];

    for (const text of prohibitedComments) {
      const result = validateProhibitedContent('https://t.me/some_channel', text);
      expect(result.isAllowed).toBe(false);
      expect(result.code).toBe('POLITICAL_CONTENT_PROHIBITED');
      expect(result.error).toContain('политическую');
    }
  });

  it('integrates with orderFormSchema and fails validation for prohibited content', () => {
    const parseResult = orderFormSchema.safeParse({
      link: 'https://gosuslugi.ru/poll/123',
      quantity: 100,
      email: 'test@example.com',
      serviceId: 'srv-101',
    });

    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      expect(parseResult.error.errors[0]?.message).toContain('государственных служб');
    }
  });
});
