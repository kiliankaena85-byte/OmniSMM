// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('ImportWizard Monolith Decomposition Standards (Wave 14 CDD-TDD)', () => {
  const rootDir = process.cwd();
  const coordinatorFile = path.resolve(rootDir, 'src/app/admin/providers/import/components/import-wizard.tsx');
  const wizardDir = path.resolve(rootDir, 'src/app/admin/providers/import/components/wizard');

  it('MUST keep coordinator import-wizard.tsx <= 200 lines', () => {
    expect(fs.existsSync(coordinatorFile)).toBe(true);
    const content = fs.readFileSync(coordinatorFile, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines, `Expected coordinator to be <= 200 lines, got ${lines}`).toBeLessThanOrEqual(200);
  });

  it('MUST contain all decomposed submodules in src/app/admin/providers/import/components/wizard/', () => {
    expect(fs.existsSync(wizardDir), 'Expected wizard/ directory to exist').toBe(true);

    const expectedFiles = [
      'types.ts',
      'category-auto-mapper.ts',
      'mixed-type-detector.ts',
      'useImportWizardState.ts',
      'WizardProviderHeader.tsx',
      'WizardBulkToolbar.tsx',
      'WizardFilterDrawer.tsx',
      'WizardPlatformTabs.tsx',
      'WizardWarningBanners.tsx',
    ];

    for (const file of expectedFiles) {
      const filePath = path.join(wizardDir, file);
      expect(fs.existsSync(filePath), `Expected ${file} to exist in wizard/`).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').length;
      expect(lines, `Expected ${file} to be <= 200 lines, got ${lines}`).toBeLessThanOrEqual(200);
    }
  });

  it('MUST export helper algorithms and verify their behavior', async () => {
    const { autoMapCategory } = await import(
      '@/app/admin/providers/import/components/wizard/category-auto-mapper'
    );
    const { detectMixedCategoryTypes } = await import(
      '@/app/admin/providers/import/components/wizard/mixed-type-detector'
    );
    const { computeMarkupMultiplier, formatMarkupLabel, checkIsFiltersActive, groupCategoriesByNetwork, DEFAULT_FILTERS } = await import(
      '@/app/admin/providers/import/components/wizard/types'
    );
    const { computePlatformBreakdown, computeIncompatibleIds } = await import(
      '@/app/admin/providers/import/components/wizard/wizard-computed-stats'
    );

    expect(typeof autoMapCategory).toBe('function');
    expect(typeof detectMixedCategoryTypes).toBe('function');
    expect(computeMarkupMultiplier('200')).toBe(3);
    expect(computeMarkupMultiplier('0')).toBe(0);
    expect(formatMarkupLabel('200')).toBe('×3');
    expect(formatMarkupLabel('0')).toBe('авто');

    // Default filters are not active
    expect(checkIsFiltersActive(DEFAULT_FILTERS)).toBe(false);
    expect(checkIsFiltersActive({ ...DEFAULT_FILTERS, platform: 'telegram' })).toBe(true);

    // Categories grouped by network
    const sampleCategories = [
      { id: 'c1', name: 'Подписчики', network: { name: 'Telegram', slug: 'telegram' } } as any,
      { id: 'c2', name: 'Лайки', network: { name: 'Telegram', slug: 'telegram' } } as any,
      { id: 'c3', name: 'Просмотры', network: { name: 'VK', slug: 'vk' } } as any,
    ];
    const grouped = groupCategoriesByNetwork(sampleCategories);
    expect(grouped.length).toBe(2);
    expect(grouped[0].network).toBe('Telegram');
    expect(grouped[0].items.length).toBe(2);
    expect(grouped[1].network).toBe('VK');
    expect(grouped[1].items.length).toBe(1);

    // Platform breakdown
    const sampleServices = [
      { service: 101, name: 'Telegram Subs', metrics: { platform: 'telegram' } } as any,
      { service: 102, name: 'VK Likes', metrics: { platform: 'vk' } } as any,
    ];
    const breakdown = computePlatformBreakdown(new Set(['101', '102']), sampleServices);
    expect(breakdown.length).toBe(2);
    expect(breakdown.some(b => b.name === 'Telegram' && b.count === 1)).toBe(true);
    expect(breakdown.some(b => b.name === 'ВКонтакте' && b.count === 1)).toBe(true);
  });

  it('MUST auto-map categories based on platform and service name keywords', async () => {
    const { autoMapCategory } = await import(
      '@/app/admin/providers/import/components/wizard/category-auto-mapper'
    );

    const categories = [
      { id: 'cat-tg-sub', name: 'Подписчики Telegram', network: { name: 'Telegram', slug: 'telegram' } } as any,
      { id: 'cat-tg-views', name: 'Просмотры Telegram', network: { name: 'Telegram', slug: 'telegram' } } as any,
      { id: 'cat-vk-sub', name: 'Подписчики VK', network: { name: 'VK', slug: 'vk' } } as any,
    ];

    const tgSubService = {
      service: 501,
      name: 'Telegram Subscribers Fast Real',
      metrics: { platform: 'telegram', category: 'Subscribers' },
    } as any;

    const mapped = autoMapCategory(tgSubService, categories);
    expect(mapped).not.toBeNull();
    expect(mapped?.id).toBe('cat-tg-sub');
    expect(mapped?.confident).toBe(true);
  });

  it('MUST detect mixed activity types going into the same category', async () => {
    const { detectMixedCategoryTypes } = await import(
      '@/app/admin/providers/import/components/wizard/mixed-type-detector'
    );

    const categories = [
      { id: 'cat-tg', name: 'Telegram Канал', network: { name: 'Telegram', slug: 'telegram' } } as any,
    ];

    const services = [
      { service: 1, name: 'Telegram Subscribers Channel', metrics: { platform: 'telegram', category: 'Subscribers' } } as any,
      { service: 2, name: 'Telegram Reactions Post', metrics: { platform: 'telegram', category: 'Reactions' } } as any,
    ];

    const selectedIds = new Set(['1', '2']);
    const selectedCategories = { '1': 'cat-tg', '2': 'cat-tg' };

    const warnings = detectMixedCategoryTypes(selectedIds, services, selectedCategories, {}, categories);
    expect(warnings.length).toBe(1);
    expect(warnings[0].targetCategoryId).toBe('cat-tg');
    expect(warnings[0].types.length).toBeGreaterThanOrEqual(2);
  });

  it('MUST preserve critical invariants and handlers in import-wizard.tsx', () => {
    const coordinatorContent = fs.readFileSync(coordinatorFile, 'utf-8');
    expect(coordinatorContent).toContain('ImportWizard');
    expect(coordinatorContent).toContain('ServicesTable');
    expect(coordinatorContent).toContain('ConfirmationModal');
    expect(coordinatorContent).toContain('ImportReportCard');
  });
});
