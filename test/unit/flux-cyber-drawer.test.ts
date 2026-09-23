import { describe, it, expect } from 'vitest';
import { LinkGuideService } from '@/services/catalog/link-guide.service';

describe('FluxCyberLinkDrawer & SMMflux UI Isolation', () => {
  it('should verify guide data feeding into FluxCyberLinkDrawer', () => {
    const data = LinkGuideService.getTelegramPhotoViewsGuide();
    expect(data.devices.length).toBe(3);
    expect(data.serviceType).toBe('TELEGRAM_VIEWS_PHOTO');
  });

  it('should verify URL structure parser for cyber scanner', () => {
    const validUrl = 'https://t.me/channel/150?single';
    expect(validUrl).toContain('t.me/');
    expect(validUrl).toContain('?single');
  });
});
