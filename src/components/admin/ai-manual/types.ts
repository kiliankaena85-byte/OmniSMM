/**
 * UI State & Props for Admin AI Manual Widget
 */

import type { AdminRunbook, DockerMemoryStatus } from '@/types/admin-ai-manual';

export type ManualTabType = 'chat' | 'guides' | 'inspector';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp: string;
  chunksUsed?: Array<{ title: string; filePath?: string }>;
  isFromCache?: boolean;
}

export interface AdminAiManualWidgetProps {
  userRole?: string;
  activeTenantId?: string;
}
