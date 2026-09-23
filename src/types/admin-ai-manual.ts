/**
 * Admin AI Operating Manual & Copilot (OmniManual 1.0)
 * Level 0 Domain Types & Zod Schemas
 */

import { z } from 'zod';

export const AdminAssistantMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(8000),
  createdAt: z.string().optional(),
});

export type AdminAssistantMessage = z.infer<typeof AdminAssistantMessageSchema>;

export const AdminAssistantQuerySchema = z.object({
  query: z.string().trim().min(2, 'Запрос должен содержать не менее 2 символов').max(2000),
  currentRoute: z.string().max(200).default('/admin/dashboard'),
  activeTenantId: z.enum(['smmplan', 'flux']).default('smmplan'),
  conversationHistory: z.array(AdminAssistantMessageSchema).max(10).optional().default([]),
});

export type AdminAssistantQuery = z.infer<typeof AdminAssistantQuerySchema>;

export interface CodeReference {
  filePath: string;
  startLine?: number;
  endLine?: number;
  title: string;
  snippet?: string;
  layer?: string;
}

export interface RunbookTerm {
  term: string;
  definition: string;
}

export interface RunbookArchitecture {
  prismaTables?: string[];
  serverActions?: string[];
  level1Services?: string[];
  description?: string;
}

export interface RunbookProtectiveMechanism {
  title: string;
  description: string;
  ruleCode?: string;
}

export interface RunbookTroubleshootingItem {
  scenario: string;
  symptoms: string;
  remedy: string;
  files?: string[];
}

export interface AdminRunbookStep {
  stepNumber: number;
  title: string;
  instruction: string;
  actionUrl?: string;
  actionLabel?: string;
  warningNote?: string;
}

export interface AdminRunbook {
  id: string;
  chapterNumber: number;
  chapterTitle: string;
  title: string;
  targetRoute: string;
  summary: string;
  estimatedMinutes: number;
  steps: AdminRunbookStep[];
  relatedFiles: string[];
  tags: string[];
  scopeAndObjectives?: string;
  termsAndDefinitions?: RunbookTerm[];
  technicalArchitecture?: RunbookArchitecture;
  protectiveMechanisms?: RunbookProtectiveMechanism[];
  troubleshooting?: RunbookTroubleshootingItem[];
}

export interface DockerMemoryStatus {
  isAvailable: boolean;
  qdrantPointsCount: number;
  indexedFilesCount: number;
  lastIndexedAt?: string;
  mode: 'LIVE_DOCKER' | 'OFFLINE_CACHE';
  vectorModel: string;
}

export interface AdminAiContextBundle {
  route: string;
  tenantId: string;
  role: string;
  codeChunks: Array<{
    title: string;
    content: string;
    filePath?: string;
    score: number;
  }>;
  activeSettingsSummary?: string;
}
