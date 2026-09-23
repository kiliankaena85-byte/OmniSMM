import { describe, it, expect } from 'vitest';
import { LinkGuideService } from '../link-guide.service';
import { IntelligenceLinkAnalyzer } from '../../analyzer/link-analyzer';

describe('Telegram MediaGroup & Album Link Guide Invariant', () => {
  const analyzer = new IntelligenceLinkAnalyzer();

  it('generates full albumSyncGuidance payload in LinkGuideService', () => {
    const payload = LinkGuideService.getTelegramPhotoViewsGuide();
    expect(payload.hasGuide).toBe(true);
    expect(payload.serviceType).toBe('TELEGRAM_VIEWS_PHOTO');
    expect(payload.albumSyncGuidance).toBeDefined();
    expect(payload.albumSyncGuidance?.title).toContain('Синхронизация просмотров');
    expect(payload.albumSyncGuidance?.recommendation).toContain('2 заказа');
    expect(payload.albumSyncGuidance?.firstStepExample).toContain('101');
    expect(payload.albumSyncGuidance?.lastStepExample).toContain('105');
  });

  it('correctly identifies Telegram album candidate URLs', () => {
    expect(LinkGuideService.isTelegramAlbumCandidate('https://t.me/durov/150')).toBe(true);
    expect(LinkGuideService.isTelegramAlbumCandidate('https://t.me/durov/150?single')).toBe(true);
    expect(LinkGuideService.isTelegramAlbumCandidate('https://t.me/c/1234567890/100')).toBe(true);
    expect(LinkGuideService.isTelegramAlbumCandidate('https://t.me/durov')).toBe(false);
    expect(LinkGuideService.isTelegramAlbumCandidate('https://vk.com/wall-123_456')).toBe(false);
    expect(LinkGuideService.isTelegramAlbumCandidate('')).toBe(false);
  });

  it('returns specific advice for single photo URLs and general album posts', () => {
    const singleAdvice = LinkGuideService.getTelegramAlbumAdvice('https://t.me/durov/150?single');
    expect(singleAdvice).toContain('отдельное медиа');
    expect(singleAdvice).toContain('второй заказ на последнее фото');

    const generalAdvice = LinkGuideService.getTelegramAlbumAdvice('https://t.me/durov/150');
    expect(generalAdvice).toContain('альбом');
    expect(generalAdvice).toContain('2 заказа');
  });

  it('enriches IntelligenceLinkAnalyzer results with media group metadata and tips', async () => {
    const res = await analyzer.analyze('https://t.me/durov/150');
    expect(res.platform).toBe('TELEGRAM');
    expect(res.type).toBe('post');
    expect(res.metadata.isMediaGroupCandidate).toBe(true);
    expect(res.tips).toContain('telegram_mediagroup_dual_order_recommended');
    expect(res.metadata.advice).toContain('первое и последнее фото');
  });

  it('identifies single photo in IntelligenceLinkAnalyzer', async () => {
    const res = await analyzer.analyze('https://t.me/durov/150?single');
    expect(res.platform).toBe('TELEGRAM');
    expect(res.type).toBe('post');
    expect(res.metadata.isAlbum).toBe(true);
    expect(res.metadata.isMediaGroupCandidate).toBe(true);
    expect(res.metadata.advice).toContain('отдельное медиа');
  });
});
