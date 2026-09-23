/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatRunbookToPatentMarkdown,
  formatConsolidatedManualToPatentMarkdown,
} from '@/services/admin/ai-manual/runbook-markdown-formatter';
import {
  downloadMarkdownFile,
  downloadRunbookAsMarkdown,
  downloadFullManualAsMarkdown,
} from '@/services/admin/ai-manual/runbook-downloader';
import { CURATED_ADMIN_RUNBOOKS } from '@/services/admin/ai-manual/runbooks';

describe('Admin Runbook Patent Formatter (Rospatent / GOST ESPD standard)', () => {
  it('formats a runbook with all 6 mandatory technical sections', () => {
    const runbook = CURATED_ADMIN_RUNBOOKS.find((r) => r.id === 'catalog-import')!;
    expect(runbook).toBeDefined();

    const markdown = formatRunbookToPatentMarkdown(runbook);

    // Header and metadata
    expect(markdown).toContain('РЕГЛАМЕНТ ТЕХНИЧЕСКОЙ ЭКСПЛУАТАЦИИ');
    expect(markdown).toContain('ГОСТ ЕСПД 19.505-79');
    expect(markdown).toContain('OmniSMM 1.0');
    expect(markdown).toContain('Глава 1. Каталог и Провайдеры');

    // Section 1: Scope & Objectives
    expect(markdown).toContain('### 1. ОБЛАСТЬ ПРИМЕНЕНИЯ И НАЗНАЧЕНИЕ');
    expect(markdown).toContain('Cherry-Pick');

    // Section 2: Terms & Definitions
    expect(markdown).toContain('### 2. ТЕРМИНЫ, СОКРАЩЕНИЯ И ОПРЕДЕЛЕНИЯ');
    expect(markdown).toContain('Зомби-услуги (Zombie Services)');
    expect(markdown).toContain('Карантин цен (Price Quarantine)');
    expect(markdown).toContain('Shadow Catalog');

    // Section 3: Technical Architecture
    expect(markdown).toContain('### 3. ТЕХНИЧЕСКАЯ СУЩНОСТЬ И АРХИТЕКТУРА МОДУЛЯ');
    expect(markdown).toContain('Service');
    expect(markdown).toContain('Provider');
    expect(markdown).toContain('smartAnalyzerLogic');

    // Section 4: Operational steps
    expect(markdown).toContain('### 4. ПОШАГОВЫЙ РЕГЛАМЕНТ ШТАТНОЙ ЭКСПЛУАТАЦИИ');
    expect(markdown).toContain('Шаг 1. Выбор целевого провайдера');

    // Section 5: Protective Mechanisms
    expect(markdown).toContain('### 5. НЕСТАНДАРТНЫЕ И ЗАЩИТНЫЕ ФУНКЦИИ');
    expect(markdown).toContain('Приоритет №1 выбора администратора');
    expect(markdown).toContain('CAT-PRICE-QUARANTINE-30');

    // Section 6: Troubleshooting & Recovery
    expect(markdown).toContain('### 6. ДИАГНОСТИКА СБОЕВ И ПЛАН ВОССТАНОВЛЕНИЯ');
    expect(markdown).toContain('Конфликт целевого типа ссылки');
    expect(markdown).toContain('resolveServiceTargetType');
  });

  it('formats the consolidated technical manual containing all curated chapters', () => {
    const fullMarkdown = formatConsolidatedManualToPatentMarkdown(CURATED_ADMIN_RUNBOOKS);

    expect(fullMarkdown).toContain('СВОДНОЕ РУКОВОДСТВО ПО ТЕХНИЧЕСКОЙ ЭКСПЛУАТАЦИИ И АРХИТЕКТУРЕ');
    expect(fullMarkdown).toContain('СОДЕРЖАНИЕ СВОДНОГО РУКОВОДСТВА');
    expect(fullMarkdown).toContain('Глава 1:');
    expect(fullMarkdown).toContain('Глава 2:');
    expect(fullMarkdown).toContain('Глава 3:');
    expect(fullMarkdown).toContain('Глава 4:');
    expect(fullMarkdown).toContain('Глава 5:');
    expect(fullMarkdown).toContain('Глава 6:');
    expect(fullMarkdown).toContain('Глава 7:');

    // Check key requirements mentioned in task:
    expect(fullMarkdown).toContain('НДС 22%');
    expect(fullMarkdown).toContain('Drip-Feed Floor');
    expect(fullMarkdown).toContain('Emergency KillSwitch');
  });

  it('contains valid and complete curated runbooks in the repository registry', () => {
    expect(CURATED_ADMIN_RUNBOOKS.length).toBe(7);

    // Verify task-mandated topics exist in curated runbooks
    const catalogRunbook = CURATED_ADMIN_RUNBOOKS.find((r) => r.id === 'catalog-import')!;
    expect(catalogRunbook.troubleshooting?.some((t) => t.scenario.includes('Поломка валидатора ссылок'))).toBe(true);

    const financeRunbook = CURATED_ADMIN_RUNBOOKS.find((r) => r.id === 'finance-54fz')!;
    expect(financeRunbook.steps.some((s) => s.title.includes('Настройка валют'))).toBe(true);

    CURATED_ADMIN_RUNBOOKS.forEach((r) => {
      expect(r.id).toBeDefined();
      expect(r.chapterNumber).toBeGreaterThan(0);
      expect(r.steps.length).toBeGreaterThan(0);
      expect(r.scopeAndObjectives).toBeDefined();
      expect(r.termsAndDefinitions?.length).toBeGreaterThan(0);
      expect(r.technicalArchitecture?.prismaTables?.length).toBeGreaterThan(0);
      expect(r.protectiveMechanisms?.length).toBeGreaterThan(0);
      expect(r.troubleshooting?.length).toBeGreaterThan(0);
    });
  });

  it('guarantees all 6 numbered sections are rendered even when optional fields are empty', () => {
    const minimalRunbook = {
      id: 'minimal-test',
      chapterNumber: 99,
      chapterTitle: 'Тестовая глава',
      title: 'Минимальный регламент',
      targetRoute: '/test',
      summary: 'Краткое описание',
      estimatedMinutes: 1,
      steps: [{ stepNumber: 1, title: 'Шаг 1', instruction: 'Инструкция' }],
      relatedFiles: [],
      tags: ['тест'],
    };

    const md = formatRunbookToPatentMarkdown(minimalRunbook);
    expect(md).toContain('### 1. ОБЛАСТЬ ПРИМЕНЕНИЯ И НАЗНАЧЕНИЕ');
    expect(md).toContain('### 2. ТЕРМИНЫ, СОКРАЩЕНИЯ И ОПРЕДЕЛЕНИЯ');
    expect(md).toContain('### 3. ТЕХНИЧЕСКАЯ СУЩНОСТЬ И АРХИТЕКТУРА МОДУЛЯ');
    expect(md).toContain('### 4. ПОШАГОВЫЙ РЕГЛАМЕНТ ШТАТНОЙ ЭКСПЛУАТАЦИИ');
    expect(md).toContain('### 5. НЕСТАНДАРТНЫЕ И ЗАЩИТНЫЕ ФУНКЦИИ');
    expect(md).toContain('### 6. ДИАГНОСТИКА СБОЕВ И ПЛАН ВОССТАНОВЛЕНИЯ');

    // Verify sequential ordering of sections
    const pos1 = md.indexOf('### 1.');
    const pos2 = md.indexOf('### 2.');
    const pos3 = md.indexOf('### 3.');
    const pos4 = md.indexOf('### 4.');
    const pos5 = md.indexOf('### 5.');
    const pos6 = md.indexOf('### 6.');
    expect(pos1).toBeLessThan(pos2);
    expect(pos2).toBeLessThan(pos3);
    expect(pos3).toBeLessThan(pos4);
    expect(pos4).toBeLessThan(pos5);
    expect(pos5).toBeLessThan(pos6);
  });

  describe('Download Triggers', () => {
    beforeEach(() => {
      // Mock URL.createObjectURL / revokeObjectURL in JSDOM
      URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      URL.revokeObjectURL = vi.fn();
    });

    it('triggers client-side Blob download without errors', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      downloadMarkdownFile('test.md', '# Test content');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('downloads single runbook and full manual via helper functions', () => {
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');

      downloadRunbookAsMarkdown(CURATED_ADMIN_RUNBOOKS[0]);
      expect(appendChildSpy).toHaveBeenCalled();

      downloadFullManualAsMarkdown(CURATED_ADMIN_RUNBOOKS);
      expect(appendChildSpy).toHaveBeenCalled();
    });
  });
});
