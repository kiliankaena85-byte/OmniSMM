import { describe, it, expect } from 'vitest';
import { analyzeUrl } from '@/actions/order/analyze-url';
import { resolveServiceTargetType } from '@/utils/target-type-mapper';
import { isLinkServiceCompatible } from '@/constants/link-service-compatibility';
import { PublicService } from '@/actions/order/catalog';

describe('Checkout Link Retention & Service Stability Invariant (CSR-2026)', () => {
  const mockSubscribersService: PublicService = {
    id: 'svc_tg_subs_1',
    numericId: 101,
    name: 'Подписчики Telegram (Быстрые)',
    categoryId: 'cat_tg_subs',
    pricePerUnitRub: 0.11,
    pricePer1kRub: 110,
    badge: '',
    minQty: 50,
    maxQty: 20000,
    speed: 'Моментально (до 15 мин)',
    description: 'Живые подписчики для открытых каналов и групп',
    isActive: true,
    isDripFeedEnabled: false,
    targetType: 'POST', // Default in schema
    linkPlaceholder: 'https://t.me/channel или @channel',
    linkHint: 'Укажите ссылку на открытый канал',
  };

  const mockSinglePostReactionsService: PublicService = {
    id: 'svc_tg_react_1',
    numericId: 102,
    name: 'Реакции на публикацию Telegram',
    categoryId: 'cat_tg_react',
    pricePerUnitRub: 0.05,
    pricePer1kRub: 50,
    badge: '',
    minQty: 10,
    maxQty: 50000,
    speed: 'Моментально',
    description: 'Быстрые реакции на выбранный пост',
    isActive: true,
    isDripFeedEnabled: false,
    targetType: 'POST',
    linkPlaceholder: 'https://t.me/channel/123',
    linkHint: 'Укажите ссылку на пост',
  };

  it('correctly resolves semantic targetType despite schema default POST', () => {
    const subTargetType = resolveServiceTargetType(mockSubscribersService);
    expect(subTargetType).toBe('CHANNEL');

    const reactTargetType = resolveServiceTargetType(mockSinglePostReactionsService);
    expect(reactTargetType).toBe('POST');
  });

  it('verifies channel link compatibility with subscriber service', async () => {
    const res = await analyzeUrl('https://t.me/durov');
    expect(res.success).toBe(true);
    expect(res.data?.type).toBe('channel');

    const svcTargetType = resolveServiceTargetType(mockSubscribersService);
    const isCompatible = isLinkServiceCompatible(res.data!.type, svcTargetType);
    expect(isCompatible).toBe(true);
  });

  it('identifies incompatibility between channel link and single post service without crashing', async () => {
    const res = await analyzeUrl('https://t.me/durov');
    expect(res.success).toBe(true);
    expect(res.data?.type).toBe('channel');

    const svcTargetType = resolveServiceTargetType(mockSinglePostReactionsService);
    const isCompatible = isLinkServiceCompatible(res.data!.type, svcTargetType);
    // Channel link is NOT compatible with single post reactions
    expect(isCompatible).toBe(false);
  });

  it('verifies post link compatibility with single post reactions service', async () => {
    const res = await analyzeUrl('https://t.me/durov/123');
    expect(res.success).toBe(true);
    expect(res.data?.type).toBe('post');

    const svcTargetType = resolveServiceTargetType(mockSinglePostReactionsService);
    const isCompatible = isLinkServiceCompatible(res.data!.type, svcTargetType);
    expect(isCompatible).toBe(true);
  });
});
