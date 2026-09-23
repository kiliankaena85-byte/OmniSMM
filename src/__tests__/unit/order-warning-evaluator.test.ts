import { describe, it, expect } from 'vitest';
import { evaluateOrderWarnings } from '@/utils/order-warning-evaluator';
import { OrderEngine } from '@/hooks/useOrderEngine';

describe('Order Warning Evaluator', () => {
  it('should detect telegram private post', () => {
    const mockEngine = {
      url: 'https://t.me/c/12345/678',
      platform: 'telegram',
      networkId: 'net-tg',
      categoryId: 'cat-views',
      detectedType: 'private_post',
      catalog: [],
      isLinkOverridden: false,
      selectedService: {
        id: 'svc-1',
        name: 'Views',
        targetType: 'POST',
      },
    } as unknown as OrderEngine;

    const res = evaluateOrderWarnings(mockEngine);
    expect(res.isPrivateTelegramPost).toBe(true);
    expect(res.shouldRender).toBe(true);
  });

  it('should detect swap suggestion when inserting post url in channel category', () => {
    const mockEngine = {
      url: 'https://t.me/channel/123',
      platform: 'telegram',
      networkId: 'net-tg',
      categoryId: 'cat-subscribers',
      detectedType: 'post',
      catalog: [
        {
          id: 'net-tg',
          slug: 'telegram',
          name: 'Telegram',
          categories: [
            { id: 'cat-subscribers', name: 'Подписчики' },
            { id: 'cat-views', name: 'Просмотры' },
          ],
        },
      ],
      isLinkOverridden: false,
      selectedService: {
        id: 'svc-1',
        name: 'Subscribers',
        targetType: 'CHANNEL',
      },
    } as unknown as OrderEngine;

    const res = evaluateOrderWarnings(mockEngine);
    expect(res.swapSuggestion).not.toBeNull();
    expect(res.swapSuggestion?.categoryName).toBe('Просмотры');
  });
});
