/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProviderForm } from '@/app/admin/providers/components/provider-form';
import { ProviderCredentialsSection } from '@/app/admin/providers/components/sub/ProviderCredentialsSection';
import { ProviderMappingSection } from '@/app/admin/providers/components/sub/ProviderMappingSection';
import { ProviderPricingSection } from '@/app/admin/providers/components/sub/ProviderPricingSection';
import { ProviderCatalogPreviewModal } from '@/app/admin/providers/components/sub/ProviderCatalogPreviewModal';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/actions/admin/providers/crud', () => ({
  createProvider: vi.fn().mockResolvedValue({ success: true }),
  updateProvider: vi.fn().mockResolvedValue({ success: true }),
  checkProviderConnection: vi.fn().mockResolvedValue({ success: true, balance: 100 }),
  probeProviderAction: vi.fn().mockResolvedValue({
    success: true,
    sanitizedUrl: 'https://api.example.com',
    sanitizedKey: 'secret_key',
    latencyMs: 120,
    balanceSuccess: true,
    servicesSuccess: true,
    balance: 500,
    detectedCurrency: 'USD',
  }),
  getProviderCatalogPreviewAction: vi.fn().mockResolvedValue({
    success: true,
    services: [
      { service: 1, name: 'Service 1', rate: '0.05', min: 100, max: 10000, category: 'Telegram' }
    ],
    total: 1
  }),
  inferProviderSchema: vi.fn().mockResolvedValue({
    success: true,
    schema: {
      catalog: { keys: ['service', 'name', 'rate'], itemsPath: '$' },
      balance: { keys: ['balance', 'currency'], balancePath: 'balance', currencyPath: 'currency' }
    }
  })
}));

describe('ProviderForm CDD Decomposition (Wave 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders provider form in create mode with all key sections', () => {
    render(<ProviderForm />);

    expect(screen.getByText('Новое подключение')).toBeDefined();
    expect(screen.getByLabelText(/Название провайдера/i)).toBeDefined();
    expect(screen.getByLabelText(/API URL/i)).toBeDefined();
    expect(screen.getByLabelText(/API Ключ/i)).toBeDefined();
    expect(screen.getByText(/Стандартный v2 API/i)).toBeDefined();
    expect(screen.getByText(/Визуальный конструктор/i)).toBeDefined();
  });

  it('renders provider form with initialData in edit mode', () => {
    const initialData = {
      id: 'prov-1',
      name: 'GlobalSMM',
      apiUrl: 'https://globalsmm.com/api/v2',
      hasApiKey: true,
      isActive: true,
      balanceCurrency: 'USD',
      ticketUrl: 'https://globalsmm.com/tickets',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      balance: 250,
      balanceUpdatedAt: new Date().toISOString(),
      totalServices: 10,
      activeServices: 8,
      status: 'active'
    };

    render(<ProviderForm initialData={initialData as any} />);

    expect(screen.getByText('Редактирование: GlobalSMM')).toBeDefined();
    expect(screen.getByDisplayValue('GlobalSMM')).toBeDefined();
    expect(screen.getByDisplayValue('https://globalsmm.com/api/v2')).toBeDefined();
  });

  it('switches between Standard, Visual and JSON integration modes', () => {
    render(<ProviderForm />);

    const visualTab = screen.getByRole('button', { name: /Визуальный конструктор/i });
    fireEvent.click(visualTab);
    expect(screen.getByText(/Параметры авторизации/i)).toBeDefined();

    const jsonTab = screen.getByRole('button', { name: /Прямой JSON/i });
    fireEvent.click(jsonTab);
    expect(screen.getByPlaceholderText(/JSON конфигурация маппинга/i)).toBeDefined();
  });

  it('ProviderCredentialsSection isolates credentials input and probe triggering', () => {
    const mockChange = vi.fn();
    const mockProbe = vi.fn();

    render(
      <ProviderCredentialsSection
        formData={{
          name: 'Test',
          apiUrl: 'https://test.com',
          apiKey: 'test_api_key',
          isActive: true,
          balanceCurrency: 'USD',
          ticketUrl: ''
        }}
        isEditMode={false}
        hasApiKey={false}
        checkLoading={false}
        probeResult={null}
        fieldErrors={{}}
        onChange={mockChange}
        onUrlBlur={vi.fn()}
        onKeyBlur={vi.fn()}
        onDeepProbe={mockProbe}
        onApplySuggestedUrl={vi.fn()}
      />
    );

    const nameInput = screen.getByLabelText(/Название провайдера/i);
    fireEvent.change(nameInput, { target: { name: 'name', value: 'New Name' } });
    expect(mockChange).toHaveBeenCalled();

    const probeBtn = screen.getByRole('button', { name: /Проверить соединение/i });
    fireEvent.click(probeBtn);
    expect(mockProbe).toHaveBeenCalled();
  });

  it('ProviderCatalogPreviewModal opens, displays services, and triggers close', () => {
    const mockClose = vi.fn();
    render(
      <ProviderCatalogPreviewModal
        isOpen={true}
        loading={false}
        services={[
          { service: '101', name: 'Telegram TG Views', rate: '0.001', category: 'Views', min: 10, max: 1000 }
        ]}
        total={1}
        search=""
        currency="USD"
        onSearchChange={vi.fn()}
        onClose={mockClose}
      />
    );

    expect(screen.getByText(/Каталог провайдера/i)).toBeDefined();
    expect(screen.getByText('Telegram TG Views')).toBeDefined();

    const closeBtns = screen.getAllByRole('button', { name: /Закрыть предпросмотр/i });
    fireEvent.click(closeBtns[0]);
    expect(mockClose).toHaveBeenCalled();
  });
});
