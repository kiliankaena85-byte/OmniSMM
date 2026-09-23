// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

vi.mock('@/actions/admin/provider-proxy', () => ({
  listProviderProxiesAction: vi.fn().mockResolvedValue({ success: true, proxies: [] }),
  getProxyHealthSummaryAction: vi.fn().mockResolvedValue({ success: true, health: null }),
  createProviderProxyAction: vi.fn().mockResolvedValue({ success: true }),
  updateProviderProxyAction: vi.fn().mockResolvedValue({ success: true }),
  deleteProviderProxyAction: vi.fn().mockResolvedValue({ success: true }),
  testProviderProxyAction: vi.fn().mockResolvedValue({ success: true }),
  assignProxyToProviderAction: vi.fn().mockResolvedValue({ success: true }),
  syncSubscriptionAction: vi.fn().mockResolvedValue({ success: true }),
  syncAllSubscriptionsAction: vi.fn().mockResolvedValue({ success: true }),
  harvestFreeProxiesAction: vi.fn().mockResolvedValue({ success: true }),
  importSubscriptionAction: vi.fn().mockResolvedValue({ success: true }),
  importRawProxyListAction: vi.fn().mockResolvedValue({ success: true }),
  batchAssignProxyToAllProvidersAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Wave 22: Provider Proxy Manager Decomposition (CDD-TDD)', () => {
  it('should ensure all created submodules obey the <= 200 lines rule', () => {
    const filesToCheck = [
      'src/app/admin/settings/proxy/types.ts',
      'src/app/admin/settings/proxy/ProxyHealthSummaryCard.tsx',
      'src/app/admin/settings/proxy/ProxyDeleteDialog.tsx',
      'src/app/admin/settings/proxy/ProxyImportSubscriptionModal.tsx',
      'src/app/admin/settings/proxy/ProxyImportRawListModal.tsx',
      'src/app/admin/settings/proxy/ProxyFormCard.tsx',
      'src/app/admin/settings/proxy/ProxyCardItem.tsx',
      'src/app/admin/settings/proxy/useProxyManager.ts',
      'src/app/admin/settings/provider-proxy-manager.tsx',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath);
      expect(fs.existsSync(fullPath), `File ${relPath} should exist`).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').length;
      expect(lines, `Component ${relPath} has ${lines} lines, expected <= 200`).toBeLessThanOrEqual(200);
    }
  });

  it('should render ProviderProxyManager without crashing', async () => {
    const { ProviderProxyManager } = await import('@/app/admin/settings/provider-proxy-manager');
    const { container } = render(<ProviderProxyManager providers={[]} />);
    expect(container).toBeDefined();
  });
});
