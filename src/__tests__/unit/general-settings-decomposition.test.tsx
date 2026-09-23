// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  GeneralMaintenanceSection,
  GeneralBrandingSection,
  GeneralTelegramBotSection,
  GeneralLegalFiscalSection,
} from '@/app/admin/settings/components/general';
import { GeneralSettings } from '@/app/admin/settings/general-settings';
import type { SystemSettings } from '@prisma/client';

// Mock server actions to prevent network/db calls in unit tests
vi.mock('@/actions/admin/settings', () => ({
  updateGlobalSettings: vi.fn().mockResolvedValue({ success: true }),
  disconnectTelegramBotAction: vi.fn().mockResolvedValue({ success: true, message: 'Бот успешно отвязан' }),
}));

vi.mock('@/actions/admin/tenants', () => ({
  toggleTenantMaintenanceAction: vi.fn().mockResolvedValue({ success: true }),
}));

const mockSettings: SystemSettings = {
  id: 'smmplan',
  siteName: 'SMMplan Test',
  siteDescription: 'SMMplan Description',
  siteLogoUrl: 'https://example.com/logo.png',
  siteFaviconUrl: 'https://example.com/favicon.ico',
  maintenanceMode: false,
  contactSupportEmail: 'support@smmplan.pro',
  contactPrivacyEmail: 'privacy@smmplan.pro',
  contactTelegramBot: 'test_bot',
  contactTelegramChannel: '@test_channel',
  telegramBotToken: 'vault_token_encrypted',
  legalCompanyName: 'ООО Тест',
  legalCompanyInn: '7701234567',
  legalCompanyOgrnip: '1237700000000',
  legalCompanyAddress: 'г. Москва',
  usnScheme: 'INCOME_EXPENSES',
  taxRate: 15,
  opexMonthly: 5000000,
  updatedAt: new Date(),
} as unknown as SystemSettings;

describe('GeneralSettings Decomposition Suite (Wave 11 CDD-TDD)', () => {
  it('renders GeneralMaintenanceSection and triggers toggle/modal', () => {
    const onToggle = vi.fn().mockResolvedValue(undefined);
    const setIsOpen = vi.fn();

    const { rerender } = render(
      <GeneralMaintenanceSection
        maintenance={false}
        isTogglingMaintenance={false}
        isMaintenanceModalOpen={false}
        setIsMaintenanceModalOpen={setIsOpen}
        onToggleMaintenance={onToggle}
      />
    );

    expect(screen.getByText('Статус платформы & Режим техработ')).toBeDefined();
    expect(screen.getByText('⚪ Выключен')).toBeDefined();

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(setIsOpen).toHaveBeenCalledWith(true);

    // Rerender with active maintenance
    rerender(
      <GeneralMaintenanceSection
        maintenance={true}
        isTogglingMaintenance={false}
        isMaintenanceModalOpen={false}
        setIsMaintenanceModalOpen={setIsOpen}
        onToggleMaintenance={onToggle}
      />
    );
    expect(screen.getByText('🔴 Включен')).toBeDefined();
  });

  it('renders GeneralBrandingSection and handles siteName and logo preview', () => {
    const setSiteName = vi.fn();
    const setSiteDescription = vi.fn();
    const onRemove = vi.fn();
    const copy = vi.fn();

    render(
      <GeneralBrandingSection
        siteName="SMMplan Pro"
        setSiteName={setSiteName}
        siteDescription="Best SMM"
        setSiteDescription={setSiteDescription}
        logoUrl="https://example.com/logo.png"
        setLogoUrl={vi.fn()}
        faviconUrl={null}
        setFaviconUrl={vi.fn()}
        logoUploading={false}
        faviconUploading={false}
        handleBrandingUpload={vi.fn().mockResolvedValue(undefined)}
        copyToClipboard={copy}
        copiedField={null}
        formState={null}
        onRemoveBranding={onRemove}
      />
    );

    expect(screen.getByText('Брендинг & Идентичность сайта')).toBeDefined();
    const nameInput = screen.getByPlaceholderText('SMMplan') as HTMLInputElement;
    expect(nameInput.value).toBe('SMMplan Pro');

    fireEvent.change(nameInput, { target: { value: 'SMMplan New' } });
    expect(setSiteName).toHaveBeenCalledWith('SMMplan New');
  });

  it('renders GeneralTelegramBotSection with diagnostics and token field', () => {
    const handleTest = vi.fn().mockResolvedValue(undefined);

    render(
      <GeneralTelegramBotSection
        tenantId="smmplan"
        telegramBot="test_bot"
        setTelegramBot={vi.fn()}
        telegramBotToken=""
        setTelegramBotToken={vi.fn()}
        telegramChannel="@test_channel"
        setTelegramChannel={vi.fn()}
        hasExistingToken={true}
        isDisconnectBotModalOpen={false}
        setIsDisconnectBotModalOpen={vi.fn()}
        isDisconnectingBot={false}
        handleDisconnectBot={vi.fn()}
        isTestingBot={false}
        botTestResult={{
          success: true,
          username: 'test_bot',
          name: 'Test Bot',
          pingMs: 42,
        }}
        handleTestBot={handleTest}
      />
    );

    expect(screen.getByText('Telegram Бот Поддержки')).toBeDefined();
    expect(screen.getByText('AES-256-GCM Vault')).toBeDefined();
    expect(screen.getAllByText('@test_bot').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Токен сохранен')).toBeDefined();
    expect(screen.getByText(/Связь установлена успешно/)).toBeDefined();
  });

  it('renders GeneralLegalFiscalSection with 54-FZ settings and live preview', () => {
    render(
      <GeneralLegalFiscalSection
        defaultEmail="support@smmplan.pro"
        defaultPrivacyEmail="privacy@smmplan.pro"
        defaultSiteName="SMMplan"
        supportEmail="support@smmplan.pro"
        setSupportEmail={vi.fn()}
        privacyEmail="privacy@smmplan.pro"
        setPrivacyEmail={vi.fn()}
        telegramChannelDefault="@smmplan_news"
        companyName="ООО СММ ПЛАН"
        setCompanyName={vi.fn()}
        companyInn="7701234567"
        setCompanyInn={vi.fn()}
        companyOgrnip="1237700000000"
        setCompanyOgrnip={vi.fn()}
        companyAddress="г. Москва"
        setCompanyAddress={vi.fn()}
        usnScheme="INCOME_EXPENSES"
        handleUsnChange={vi.fn()}
        taxRate={15}
        setTaxRate={vi.fn()}
        opexMonthly={50000}
        setOpexMonthly={vi.fn()}
        siteName="SMMplan"
        formState={null}
      />
    );

    expect(screen.getByText('Контакты & Юридические реквизиты (152-ФЗ)')).toBeDefined();
    expect(screen.getByText('54-ФЗ')).toBeDefined();
    expect(screen.getByText('Brand-First предпросмотр (Безопасность реквизитов оператора)')).toBeDefined();
    expect(screen.getByText(/ООО СММ ПЛАН/)).toBeDefined();
  });

  it('renders GeneralSettings full orchestrator without crashing', () => {
    render(<GeneralSettings settings={mockSettings} tenantId="smmplan" />);

    expect(screen.getByText('Статус платформы & Режим техработ')).toBeDefined();
    expect(screen.getByText('Брендинг & Идентичность сайта')).toBeDefined();
    expect(screen.getByText('Telegram Бот Поддержки')).toBeDefined();
    expect(screen.getByText('Контакты & Юридические реквизиты (152-ФЗ)')).toBeDefined();
    expect(screen.getByText('Сохранить все настройки')).toBeDefined();
  });
});
