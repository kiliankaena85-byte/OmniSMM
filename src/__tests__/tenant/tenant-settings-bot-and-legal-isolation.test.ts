import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { settingsService } from '@/services/admin/settings.service';
import { SettingsProvider } from '@/lib/settings';

describe('Multi-Tenant Settings, Bot Disconnect & Legal Isolation', () => {
  beforeEach(async () => {
    // 1. Ensure Tenant rows exist in DB
    await db.tenant.upsert({
      where: { id: 'smmplan' },
      update: { name: 'SMMplan', slug: 'smmplan', domain: 'smmplan.pro' },
      create: { id: 'smmplan', name: 'SMMplan', slug: 'smmplan', domain: 'smmplan.pro' }
    });

    await db.tenant.upsert({
      where: { id: 'flux' },
      update: { name: 'SMMflux', slug: 'flux', domain: 'smmflux.ru' },
      create: { id: 'flux', name: 'SMMflux', slug: 'flux', domain: 'smmflux.ru' }
    });

    // 2. Reset settings for both tenants before each test
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: {
        siteName: 'SMMplan Pro',
        contactTelegramBot: 'smmplan_main_bot',
        contactTelegramChannel: '@smmplan_news',
        contactSupportEmail: 'support@smmplan.pro',
        contactPrivacyEmail: 'privacy@smmplan.pro',
        legalCompanyName: 'ООО СММ ПЛАН',
        legalCompanyInn: '7701234567',
        legalCompanyOgrnip: '1237700000000',
        legalCompanyAddress: 'г. Москва, ул. Ленина, д. 1',
      },
      create: {
        id: 'smmplan',
        siteName: 'SMMplan Pro',
        contactTelegramBot: 'smmplan_main_bot',
        contactTelegramChannel: '@smmplan_news',
        contactSupportEmail: 'support@smmplan.pro',
        contactPrivacyEmail: 'privacy@smmplan.pro',
        legalCompanyName: 'ООО СММ ПЛАН',
        legalCompanyInn: '7701234567',
        legalCompanyOgrnip: '1237700000000',
        legalCompanyAddress: 'г. Москва, ул. Ленина, д. 1',
      }
    });

    await db.systemSettings.upsert({
      where: { id: 'flux' },
      update: {
        siteName: 'SMMflux Aurora',
        contactTelegramBot: 'smmflux_aurora_bot',
        contactTelegramChannel: '@smmflux_news',
        contactSupportEmail: 'support@smmflux.ru',
        contactPrivacyEmail: 'privacy@smmflux.ru',
        legalCompanyName: 'ИП Новиков Н. Н.',
        legalCompanyInn: '770123456789',
        legalCompanyOgrnip: '320774600000025',
        legalCompanyAddress: 'г. Казань, ул. Мира, д. 5',
      },
      create: {
        id: 'flux',
        siteName: 'SMMflux Aurora',
        contactTelegramBot: 'smmflux_aurora_bot',
        contactTelegramChannel: '@smmflux_news',
        contactSupportEmail: 'support@smmflux.ru',
        contactPrivacyEmail: 'privacy@smmflux.ru',
        legalCompanyName: 'ИП Новиков Н. Н.',
        legalCompanyInn: '770123456789',
        legalCompanyOgrnip: '320774600000025',
        legalCompanyAddress: 'г. Казань, ул. Мира, д. 5',
      }
    });
  });

  it('1. should disconnect telegram bot only from targeted tenant without affecting the other', async () => {
    // Disconnect bot on 'flux'
    await db.systemSettings.update({
      where: { id: 'flux' },
      data: {
        contactTelegramBot: null,
        telegramBotToken: null,
      }
    });

    const fluxSettings = await settingsService.getSystemSettings('flux');
    const planSettings = await settingsService.getSystemSettings('smmplan');

    // Flux bot should be cleared
    expect(fluxSettings.contactTelegramBot).toBeNull();
    expect(fluxSettings.telegramBotToken).toBeNull();

    // SMMplan bot MUST remain untouched
    expect(planSettings.contactTelegramBot).toBe('smmplan_main_bot');
    expect(planSettings.contactTelegramChannel).toBe('@smmplan_news');
  });

  it('2. should maintain independent legal entities and tax requisites per tenant', async () => {
    const fluxLegal = await SettingsProvider.getContactAndLegalSettings('flux');
    const planLegal = await SettingsProvider.getContactAndLegalSettings('smmplan');

    // Verify completely different legal entities
    expect(planLegal.COMPANY_NAME).toBe('ООО СММ ПЛАН');
    expect(planLegal.COMPANY_INN).toBe('7701234567');
    expect(planLegal.COMPANY_ADDRESS).toBe('г. Москва, ул. Ленина, д. 1');

    expect(fluxLegal.COMPANY_NAME).toBe('ИП Новиков Н. Н.');
    expect(fluxLegal.COMPANY_INN).toBe('770123456789');
    expect(fluxLegal.COMPANY_ADDRESS).toBe('г. Казань, ул. Мира, д. 5');
  });

  it('3. should support identical/duplicated legal entities across tenants without collision', async () => {
    // Operator decides to unify legal entity to the same IP for both brands
    await settingsService.updateSystemSettings({
      legalCompanyName: 'ИП Новиков Н. Н.',
      legalCompanyInn: '770123456789',
      legalCompanyOgrnip: '320774600000025',
      legalCompanyAddress: 'г. Казань, ул. Мира, д. 5',
    }, 'smmplan');

    const planLegal = await SettingsProvider.getContactAndLegalSettings('smmplan');
    const fluxLegal = await SettingsProvider.getContactAndLegalSettings('flux');

    // Both now have the same legal details
    expect(planLegal.COMPANY_INN).toBe('770123456789');
    expect(fluxLegal.COMPANY_INN).toBe('770123456789');

    // But brand names and contact emails remain strictly isolated
    expect(planLegal.SITE_NAME).toBe('SMMplan Pro');
    expect(planLegal.SUPPORT_EMAIL).toBe('support@smmplan.pro');
    expect(fluxLegal.SITE_NAME).toBe('SMMflux Aurora');
    expect(fluxLegal.SUPPORT_EMAIL).toBe('support@smmflux.ru');
  });

  it('4. should return empty string for TELEGRAM_SUPPORT_BOT when disconnected, never falling back to other tenant', async () => {
    await db.systemSettings.update({
      where: { id: 'flux' },
      data: { contactTelegramBot: null }
    });

    const fluxLegal = await SettingsProvider.getContactAndLegalSettings('flux');
    expect(fluxLegal.TELEGRAM_SUPPORT_BOT).toBe('');

    const planLegal = await SettingsProvider.getContactAndLegalSettings('smmplan');
    expect(planLegal.TELEGRAM_SUPPORT_BOT).toBe('smmplan_main_bot');
  });
});
