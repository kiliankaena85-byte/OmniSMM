/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManualGuidesTab } from '@/components/admin/ai-manual/sub/ManualGuidesTab';
import { ManualRunbookDetail } from '@/components/admin/ai-manual/sub/ManualRunbookDetail';
import { CURATED_ADMIN_RUNBOOKS } from '@/services/admin/ai-manual/runbooks';
import * as downloader from '@/services/admin/ai-manual/runbook-downloader';

const { mockRunbooks } = vi.hoisted(() => {
  return {
    mockRunbooks: [
      {
        id: 'catalog-import',
        chapterNumber: 1,
        chapterTitle: 'Каталог и Провайдеры',
        title: 'Импорт каталога услуг через мастер Cherry-Pick и защита от зомби-услуг',
        targetRoute: '/admin/providers/import',
        summary: 'Регламент сопоставления категорий, детекции платформ, пакетных наценок и изоляции зомби-услуг.',
        estimatedMinutes: 5,
        tags: ['каталог', 'провайдеры', 'импорт', 'зомби-услуги'],
        relatedFiles: ['src/services/providers/analyzer/smart-analyzer.logic.ts'],
        scopeAndObjectives: 'Назначение модуля и регламент Cherry-Pick импорта.',
        termsAndDefinitions: [
          { term: 'Зомби-услуги (Zombie Services)', definition: 'Услуги, удаленные у провайдера.' },
        ],
        technicalArchitecture: {
          prismaTables: ['Service', 'Provider'],
          serverActions: ['importServicesAction'],
          level1Services: ['smartAnalyzerLogic'],
          description: 'Многослойный пайплайн.',
        },
        steps: [
          {
            stepNumber: 1,
            title: 'Выбор целевого провайдера',
            instruction: 'Перейдите в мастер импорта и выберите провайдера.',
          },
        ],
        protectiveMechanisms: [
          {
            title: 'Приоритет №1 выбора администратора',
            description: 'Выбор администратора отключает авто-сплит.',
            ruleCode: 'CAT-INGEST-PRIORITY-1',
          },
        ],
        troubleshooting: [
          {
            scenario: 'Конфликт целевого типа ссылки',
            symptoms: 'Ошибка несовместимости ссылки.',
            remedy: 'Использовать resolveServiceTargetType.',
          },
        ],
      },
    ],
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/providers/import',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/actions/admin/ai-manual/guides.action', () => ({
  getAdminRunbooksAction: vi.fn().mockResolvedValue({
    success: true,
    runbooks: mockRunbooks,
  }),
}));

describe('Admin AI Manual - Patent Sections & Download UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders download full manual button in ManualGuidesTab', async () => {
    const downloadFullSpy = vi.spyOn(downloader, 'downloadFullManualAsMarkdown').mockImplementation(() => {});

    render(<ManualGuidesTab />);

    await waitFor(() => {
      expect(screen.getByText(/Скачать все \(\.md\)/i)).toBeDefined();
    });

    const downloadButton = screen.getByText(/Скачать все \(\.md\)/i);
    fireEvent.click(downloadButton);

    expect(downloadFullSpy).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'catalog-import' }),
    ]));
  });

  it('renders download button on individual runbook cards in ManualGuidesTab', async () => {
    const downloadSingleSpy = vi.spyOn(downloader, 'downloadRunbookAsMarkdown').mockImplementation(() => {});

    render(<ManualGuidesTab />);

    await waitFor(() => {
      expect(screen.getAllByTitle(/Скачать этот регламент \(\.md\)/i).length).toBeGreaterThan(0);
    });

    const cardDownloadButtons = screen.getAllByTitle(/Скачать этот регламент \(\.md\)/i);
    fireEvent.click(cardDownloadButtons[0]);

    expect(downloadSingleSpy).toHaveBeenCalledTimes(1);
  });

  it('renders patent standard sections and download button in ManualRunbookDetail', () => {
    const downloadSingleSpy = vi.spyOn(downloader, 'downloadRunbookAsMarkdown').mockImplementation(() => {});
    const onBack = vi.fn();
    const runbook = CURATED_ADMIN_RUNBOOKS[0]; // catalog-import

    render(<ManualRunbookDetail runbook={runbook} onBack={onBack} />);

    // Header download button
    const downloadBtn = screen.getByRole('button', { name: /Скачать.*\.md/i });
    expect(downloadBtn).toBeDefined();

    fireEvent.click(downloadBtn);
    expect(downloadSingleSpy).toHaveBeenCalledWith(runbook);

    // Section 1: Scope & Objectives
    const sec1 = screen.getByText(/1\. Область применения и назначение/i);
    expect(sec1).toBeDefined();
    expect(screen.getAllByText(/Cherry-Pick/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Настоящий регламент определяет порядок/i)).toBeDefined();

    // Section 2: Terms & Definitions
    const sec2 = screen.getByText(/2\. Термины и определения/i);
    expect(sec2).toBeDefined();
    expect(screen.getByText(/Зомби-услуги \(Zombie Services\)/i)).toBeDefined();

    // Section 3: Architecture & Stack
    const sec3 = screen.getByText(/3\. Архитектура и стек модуля/i);
    expect(sec3).toBeDefined();
    expect(screen.getByText(/smartAnalyzerLogic/i)).toBeDefined();

    // Section 4: Steps
    const sec4 = screen.getByText(/4\. Пошаговый регламент штатной эксплуатации/i);
    expect(sec4).toBeDefined();
    expect(screen.getByText(/Шаг 1: Выбор целевого провайдера/i)).toBeDefined();

    // Section 5: Protective Mechanisms
    const sec5 = screen.getByText(/5\. Нестандартные и защитные функции/i);
    expect(sec5).toBeDefined();
    expect(screen.getByText(/Приоритет №1 выбора администратора/i)).toBeDefined();

    // Section 6: Troubleshooting
    const sec6 = screen.getByText(/6\. Диагностика сбоев и восстановление/i);
    expect(sec6).toBeDefined();
    expect(screen.getByText(/Конфликт целевого типа ссылки/i)).toBeDefined();

    // Verify correct 1..6 visual and DOM sequencing (patent standard)
    expect(sec1.compareDocumentPosition(sec2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sec2.compareDocumentPosition(sec3) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sec3.compareDocumentPosition(sec4) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sec4.compareDocumentPosition(sec5) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sec5.compareDocumentPosition(sec6) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
