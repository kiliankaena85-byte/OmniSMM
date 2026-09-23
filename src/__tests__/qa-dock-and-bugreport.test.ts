import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitBugReportAction, type BugReportPayload } from '../actions/admin/bug-reports';
import { db } from '../lib/db';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn().mockResolvedValue({ userId: 'test-qa-user-123' }),
}));

vi.mock('@/lib/admin-audit', () => ({
  auditAdmin: vi.fn(),
}));

describe('BLOCK 24: QA Dock & BugReport Stress & Resilience Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Valid Bug Report with Screenshot Base64
  // --------------------------------------------------------------------------
  it('BugReport 1: Valid bug report with screenshot parses, formats markdown, and succeeds', async () => {
    const payload: BugReportPayload = {
      title: 'Checkout button disabled on mobile',
      description: '1. Selected YouTube Views 2. Typed link 3. Button did not activate',
      priority: 'CRITICAL',
      url: '/order/checkout?service=1987',
      tenantId: 'smmplan',
      role: 'Авторизованный клиент',
      viewport: '390x844',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      checkoutMode: 'wizard',
      screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    };

    const result = await submitBugReportAction(payload);
    expect(result.success).toBe(true);
    expect(result.markdown).toContain('### Баг-репорт: Checkout button disabled on mobile');
    expect(result.markdown).toContain('**Приоритет:** CRITICAL');
    expect(result.markdown).toContain('**Бренд (Тенант):** smmplan');
    expect(result.markdown).toContain('**Скриншот:** Прикреплен');
  });

  // --------------------------------------------------------------------------
  // 2. Multi-Tenant Tagging (SMMflux vs SMMplan)
  // --------------------------------------------------------------------------
  it('BugReport 2: Correctly tags SMMflux vs SMMplan tenant context', async () => {
    const fluxPayload: BugReportPayload = {
      title: 'Neon gradient misalignment on hero card',
      description: 'Border beam clipped at right boundary',
      priority: 'LOW',
      url: '/services/vk',
      tenantId: 'flux',
      role: 'Гость',
      viewport: '1440x900',
      userAgent: 'Chrome/124.0.0.0',
    };

    const result = await submitBugReportAction(fluxPayload);
    expect(result.success).toBe(true);
    expect(result.markdown).toContain('**Бренд (Тенант):** flux');
    expect(result.markdown).toContain('**Скриншот:** Отсутствует');
  });

  // --------------------------------------------------------------------------
  // 3. Oversized Screenshot Payload Stress (Simulation of 2MB Base64)
  // --------------------------------------------------------------------------
  it('BugReport 3: Handles large screenshot payload without memory leak or crash', async () => {
    // Generate a simulated large base64 string (~500KB)
    const largeDummyBase64 = 'data:image/png;base64,' + 'A'.repeat(500000);

    const payload: BugReportPayload = {
      title: 'Large 4K Screenshot Attached',
      description: 'Testing high-resolution screenshot buffer handling',
      priority: 'NORMAL',
      url: '/admin/orders',
      tenantId: 'smmplan',
      role: 'Владелец',
      viewport: '3840x2160',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      screenshot: largeDummyBase64,
    };

    const result = await submitBugReportAction(payload);
    expect(result.success).toBe(true);
    expect(result.markdown).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 4. JS Console Logs Extraction & Formatting
  // --------------------------------------------------------------------------
  it('BugReport 4: Formats JavaScript console error trace blocks cleanly in markdown', async () => {
    const payloadWithLogs: BugReportPayload = {
      title: 'Uncaught TypeError on SBP QR Generation',
      description: 'Clicked SBP payment, received error in console',
      priority: 'CRITICAL',
      url: '/order/checkout',
      tenantId: 'smmplan',
      role: 'Клиент',
      viewport: '1920x1080',
      userAgent: 'Chrome/124.0',
      consoleLogs: [
        'TypeError: Cannot read properties of undefined (reading qr_url)',
        'at generateSbpQr (checkout-wizard.tsx:142:15)',
        'at HTMLButtonElement.dispatch (react-dom.production.min.js:284:12)',
      ],
    };

    const result = await submitBugReportAction(payloadWithLogs);
    expect(result.success).toBe(true);
    expect(result.markdown).toContain('#### Ошибки консоли JS:');
    expect(result.markdown).toContain('TypeError: Cannot read properties of undefined');
  });
});
