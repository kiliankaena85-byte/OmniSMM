// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

describe('Wave 20: SMMflux Cyber Link Drawer & Transactions View Decomposition (CDD-TDD)', () => {
  it('should ensure all created submodules obey the <= 200 lines rule', () => {
    const filesToCheck = [
      'src/components/orders/flux/sub/CyberPhoneSimulator.tsx',
      'src/components/orders/flux/sub/CyberTimelineSteps.tsx',
      'src/components/orders/flux/sub/CyberLinkScanner.tsx',
      'src/components/orders/flux/sub/validateTelegramLink.ts',
      'src/components/orders/flux/FluxCyberLinkDrawer.tsx',
      'src/components/dashboard/flux/sub/types.ts',
      'src/components/dashboard/flux/sub/FluxTransactionsHeader.tsx',
      'src/components/dashboard/flux/sub/FluxTransactionsSummaryBanner.tsx',
      'src/components/dashboard/flux/sub/FluxTransactionRow.tsx',
      'src/components/dashboard/flux/FluxTransactionsView.tsx',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath);
      expect(fs.existsSync(fullPath), `File ${relPath} should exist`).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').length;
      expect(lines, `Component ${relPath} has ${lines} lines, expected <= 200`).toBeLessThanOrEqual(200);
    }
  });

  it('should render FluxTransactionsView without crashing', async () => {
    const { FluxTransactionsView } = await import('@/components/dashboard/flux/FluxTransactionsView');
    const { container } = render(
      <FluxTransactionsView
        initialEntries={[]}
        userEmail="test@test.com"
        currentBalanceRub={1000}
      />
    );
    expect(container).toBeDefined();
  });
});
