import { describe, it, expect } from 'vitest';
import { LinkGuideService } from '@/services/catalog/link-guide.service';

describe('TelegramLinkGuideModal & Theming Integration', () => {
  it('should verify guide data structure for all 3 devices', () => {
    const data = LinkGuideService.getTelegramPhotoViewsGuide();
    expect(data.devices.map(d => d.device)).toEqual(['ios', 'android', 'desktop']);
    
    // Check iOS specifics
    const ios = data.devices.find(d => d.device === 'ios')!;
    expect(ios.steps[0].title).toContain('фото');
    expect(ios.steps[1].title).toContain('меню');
    expect(ios.steps[2].title).toContain('Копировать');
    
    // Check Android specifics
    const android = data.devices.find(d => d.device === 'android')!;
    expect(android.steps[1].instruction).toContain('⋮');

    // Check Desktop specifics
    const desktop = data.devices.find(d => d.device === 'desktop')!;
    expect(desktop.steps[1].instruction).toContain('правую кнопку');
  });

  it('should validate album media group instructions', () => {
    const data = LinkGuideService.getTelegramPhotoViewsGuide();
    data.devices.forEach(dev => {
      expect(dev.mediaGroupAlbumNote).toBeDefined();
      expect(dev.mediaGroupAlbumNote.length).toBeGreaterThan(10);
    });
  });
});
