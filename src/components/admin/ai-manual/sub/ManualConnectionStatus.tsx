'use client';

/**
 * Connection Status Badge for Docker Vector Memory
 */

import React from 'react';
import type { DockerMemoryStatus } from '@/types/admin-ai-manual';
import { Database, Wifi, WifiOff } from 'lucide-react';

interface ManualConnectionStatusProps {
  status: DockerMemoryStatus | null;
  isLoading: boolean;
}

export const ManualConnectionStatus: React.FC<ManualConnectionStatusProps> = ({ status, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground animate-pulse">
        <Database className="w-3 h-3 animate-spin" />
        <span>Проверка Docker RAG...</span>
      </div>
    );
  }

  const isLive = status?.isAvailable && status.mode === 'LIVE_DOCKER';

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
        isLive
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
      }`}
      title={
        isLive
          ? `Docker Qdrant активен на :6333/:8100. Точек: ${status?.qdrantPointsCount || 0}`
          : 'Docker контейнер недоступен. Работает режим Offline Cache.'
      }
    >
      {isLive ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <Wifi className="w-3 h-3" />
          <span>Docker RAG Live ({status?.qdrantPointsCount ?? 0})</span>
        </>
      ) : (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <WifiOff className="w-3 h-3" />
          <span>Offline Cache</span>
        </>
      )}
    </div>
  );
};
