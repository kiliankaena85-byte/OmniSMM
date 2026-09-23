import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsProvider } from '../../src/lib/settings';
import { db } from '../../src/lib/db';

// Mock the Prisma DB client
vi.mock('../../src/lib/db', () => ({
  db: {
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ id: 'tenant-1', slug: 'smmplan' }),
      findFirst: vi.fn().mockResolvedValue({ id: 'tenant-1', slug: 'smmplan' }),
    },
    systemSettings: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
    }
  }
}));

describe('SettingsProvider (Dynamic Branding)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Invalidate cached settings
    // @ts-expect-error - access private/protected property for testing purposes
    SettingsProvider.cachedSettings = null;
    // @ts-expect-error: override for testing
    SettingsProvider.lastFetch = 0;
  });

  it('should fallback to defaults if DB is inaccessible', async () => {
    // Simulate DB failure
    (db.systemSettings.upsert as any).mockRejectedValue(new Error('DB Error'));

    const settings = await SettingsProvider.getContactAndLegalSettings();
    expect(settings.SITE_NAME).toBe('SMMplan');
  });

  it('should return default values from create if DB is empty but accessible', async () => {
    (db.systemSettings.upsert as any).mockResolvedValue({
      siteName: 'Smmplan Lite',
      contactSupportEmail: 'support@smmplan.pro',
      legalCompanyName: 'Smmplan Lite'
    });

    const settings = await SettingsProvider.getContactAndLegalSettings();

    expect(settings.SITE_NAME).toBe('Smmplan Lite');
    expect(settings.SUPPORT_EMAIL).toBe('support@smmplan.pro');
  });

  it('should map custom DB fields correctly to constants', async () => {
    (db.systemSettings.upsert as any).mockResolvedValue({
      siteName: 'Custom Brand',
      contactSupportEmail: 'hello@custombrand.com',
      contactPrivacyEmail: 'privacy@custombrand.com',
      contactTelegramBot: 'custom_bot',
      contactTelegramChannel: 'custom_channel',
      legalCompanyName: 'LLC Custom Brand'
    });

    const settings = await SettingsProvider.getContactAndLegalSettings();

    expect(settings.SITE_NAME).toBe('Custom Brand');
    expect(settings.SUPPORT_EMAIL).toBe('hello@custombrand.com');
    expect(settings.PRIVACY_EMAIL).toBe('privacy@custombrand.com');
    expect(settings.TELEGRAM_SUPPORT_BOT).toBe('custom_bot');
    expect(settings.TELEGRAM_SUPPORT_CHANNEL).toBe('custom_channel');
    expect(settings.COMPANY_NAME).toBe('LLC Custom Brand');
  });

});
