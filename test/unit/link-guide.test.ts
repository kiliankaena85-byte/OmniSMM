import { describe, it, expect } from 'vitest';
import { LinkGuideService } from '@/services/catalog/link-guide.service';
import { getServiceLinkGuideAction } from '@/actions/order/link-guide';

describe('LinkGuideService & Multi-Device Instructions', () => {
  it('should identify Telegram views services accurately', () => {
    expect(LinkGuideService.isTelegramViewsService('telegram', 'views', 'Просмотры постов')).toBe(true);
    expect(LinkGuideService.isTelegramViewsService('telegram', 'просмотры', 'Быстрые просмотры')).toBe(true);
    expect(LinkGuideService.isTelegramViewsService('telegram', 'subscribers', 'Подписчики Telegram')).toBe(false);
    expect(LinkGuideService.isTelegramViewsService('instagram', 'views', 'Instagram Views')).toBe(false);
  });

  it('should generate valid multi-device guides for iOS, Android and Desktop', () => {
    const guide = LinkGuideService.getTelegramPhotoViewsGuide();
    expect(guide.hasGuide).toBe(true);
    expect(guide.devices.length).toBe(3);

    const ios = guide.devices.find(d => d.device === 'ios');
    expect(ios).toBeDefined();
    expect(ios?.steps.length).toBe(3);
    expect(ios?.steps[1].instruction).toContain('•••');

    const android = guide.devices.find(d => d.device === 'android');
    expect(android).toBeDefined();
    expect(android?.steps[1].instruction).toContain('⋮');

    const desktop = guide.devices.find(d => d.device === 'desktop');
    expect(desktop).toBeDefined();
    expect(desktop?.steps[1].buttonHighlight).toContain('Правая кнопка');
  });

  it('should return correct payload from Server Action', async () => {
    const resTg = await getServiceLinkGuideAction('telegram', 'views', 'Просмотры фото');
    expect(resTg.success).toBe(true);
    expect(resTg.data?.hasGuide).toBe(true);
    expect(resTg.data?.devices.length).toBe(3);

    const resOther = await getServiceLinkGuideAction('vk', 'followers', 'Подписчики');
    expect(resOther.success).toBe(true);
    expect(resOther.data?.hasGuide).toBe(false);
  });
});
