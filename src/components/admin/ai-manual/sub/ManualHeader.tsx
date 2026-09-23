'use client';

/**
 * Header of Admin AI Manual Drawer with Tab Switcher
 */

import React from 'react';
import type { ManualTabType } from '../types';
import type { DockerMemoryStatus } from '@/types/admin-ai-manual';
import { ManualConnectionStatus } from './ManualConnectionStatus';
import { MessageSquare, BookOpen, Layers, X } from 'lucide-react';

interface ManualHeaderProps {
  activeTab: ManualTabType;
  onTabChange: (tab: ManualTabType) => void;
  onClose: () => void;
  memoryStatus: DockerMemoryStatus | null;
  isLoadingStatus: boolean;
}

export const ManualHeader: React.FC<ManualHeaderProps> = ({
  activeTab,
  onTabChange,
  onClose,
  memoryStatus,
  isLoadingStatus,
}) => {
  return (
    <div className="flex flex-col border-b border-border/80 bg-background/95 backdrop-blur-md shrink-0">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            OmniManual <span className="text-primary text-xs font-mono font-bold">1.0</span>
          </h2>
          <ManualConnectionStatus status={memoryStatus} isLoading={isLoadingStatus} />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
          aria-label="Закрыть инструкцию"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 pb-2 border-t border-border/40 pt-1.5">
        <button
          type="button"
          onClick={() => onTabChange('chat')}
          aria-label="Вкладка AI-Консультант"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'chat'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>AI-Консультант</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('guides')}
          aria-label="Вкладка Инструкция"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'guides'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Инструкция</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('inspector')}
          aria-label="Вкладка Инспектор"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'inspector'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Инспектор</span>
        </button>
      </div>
    </div>
  );
};
