/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ManualFloatingTrigger } from '@/components/admin/ai-manual/sub/ManualFloatingTrigger';
import { ManualConnectionStatus } from '@/components/admin/ai-manual/sub/ManualConnectionStatus';
import { ManualInspectorTab } from '@/components/admin/ai-manual/sub/ManualInspectorTab';
import { AdminAiManualWidget } from '@/components/admin/ai-manual/AdminAiManualWidget';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/dashboard',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/actions/admin/ai-manual/guides.action', () => ({
  getDockerMemoryStatusAction: vi.fn().mockResolvedValue({
    success: true,
    status: {
      isAvailable: true,
      qdrantPointsCount: 1420,
      indexedFilesCount: 284,
      mode: 'LIVE_DOCKER',
      vectorModel: 'paraphrase-multilingual-MiniLM-L12-v2',
    },
  }),
  getAdminRunbooksAction: vi.fn().mockResolvedValue({
    success: true,
    runbooks: [],
  }),
}));

describe('Admin AI Manual UI Components', () => {
  it('renders ManualFloatingTrigger and handles click', () => {
    const onToggle = vi.fn();
    render(<ManualFloatingTrigger isOpen={false} onToggle={onToggle} />);

    const button = screen.getByRole('button', { name: /открыть интерактивную инструкцию/i });
    expect(button).toBeDefined();

    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders ManualConnectionStatus in live docker mode', () => {
    render(
      <ManualConnectionStatus
        isLoading={false}
        status={{
          isAvailable: true,
          qdrantPointsCount: 500,
          indexedFilesCount: 100,
          mode: 'LIVE_DOCKER',
          vectorModel: 'paraphrase-multilingual-MiniLM-L12-v2',
        }}
      />
    );

    expect(screen.getByText(/Docker RAG Live/i)).toBeDefined();
  });

  it('renders ManualInspectorTab with ADR and Model items', () => {
    render(<ManualInspectorTab />);
    expect(screen.getAllByText(/ADR-2026-20/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Prisma Model: User/i)).toBeDefined();
  });

  it('toggles AdminAiManualWidget via Ctrl + / keyboard shortcut', () => {
    render(<AdminAiManualWidget userRole="ADMIN" activeTenantId="smmplan" />);

    // Initially trigger is visible, dialog is closed
    expect(screen.queryByRole('dialog')).toBeNull();

    // Trigger keyboard shortcut Ctrl + /
    fireEvent.keyDown(window, { key: '/', ctrlKey: true });

    // Dialog should open
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/OmniManual/i)).toBeDefined();

    // Trigger Escape to close
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
