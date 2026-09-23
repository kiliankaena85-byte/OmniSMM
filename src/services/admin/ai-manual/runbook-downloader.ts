/**
 * Level 1 / Client Helper: Direct Download of Runbooks and Manual in Markdown format
 */

import type { AdminRunbook } from '@/types/admin-ai-manual';
import {
  formatRunbookToPatentMarkdown,
  formatConsolidatedManualToPatentMarkdown,
} from './runbook-markdown-formatter';

export function downloadMarkdownFile(filename: string, content: string): void {
  if (typeof window === 'undefined' || !window.Blob) return;
  // Prepend UTF-8 Byte Order Mark (BOM) to ensure clean rendering of Cyrillic text in Windows Notepad and other editors
  const blob = new Blob(['\uFEFF', content], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadRunbookAsMarkdown(runbook: AdminRunbook): void {
  const content = formatRunbookToPatentMarkdown(runbook);
  const safeTitle = (runbook.id || 'runbook').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
  const filename = `RUNBOOK_OMNISMM_${runbook.chapterNumber}_${safeTitle}.md`;
  downloadMarkdownFile(filename, content);
}

export function downloadFullManualAsMarkdown(runbooks: AdminRunbook[]): void {
  const content = formatConsolidatedManualToPatentMarkdown(runbooks);
  const filename = `ADMIN_TECHNICAL_OPERATIONS_MANUAL_OMNISMM_2026.md`;
  downloadMarkdownFile(filename, content);
}
