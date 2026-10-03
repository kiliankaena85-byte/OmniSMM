'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { DePinAnalyticsTab } from './depin-analytics-tab';
import { DePinNodesKpiCards } from './depin-nodes-kpi-cards';
import { DePinNodesTableView } from './depin-nodes-table-view';
import { DePinTargetsTableView } from './depin-targets-table-view';
import { DePinNodesModals } from './depin-nodes-modals';
import { DePinNodesToolbar } from './depin-nodes-toolbar';
import { useDePinAdmin } from './use-depin-admin';

interface DePinNodesTabProps {
  tenantId?: string;
}

export function DePinNodesTab({ tenantId = 'smmplan' }: DePinNodesTabProps) {
  const admin = useDePinAdmin();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── 1. ВЕРХНИЕ СВОДНЫЕ МЕТРИКИ (KPI CARDS) ── */}
      <DePinNodesKpiCards stats={admin.stats} />

      {/* ── 2. ПЕРЕКЛЮЧАТЕЛЬ ПОДРАЗДЕЛОВ И ТУЛБАР ── */}
      <Card className="rounded-2xl border border-border/80 shadow-sm p-4 bg-card/80 space-y-4">
        <DePinNodesToolbar
          currentView={admin.currentView}
          setCurrentView={admin.setCurrentView}
          filteredNodesCount={admin.filteredNodes.length}
          targetsCount={admin.targets.length}
          searchQuery={admin.searchQuery}
          setSearchQuery={admin.setSearchQuery}
          onOpenCreateTarget={() => admin.setIsCreateTargetOpen(true)}
          onRefresh={admin.loadData}
          loading={admin.loading}
        />

        {/* ── 2.5 ВИД: ПРОДУКТОВАЯ АНАЛИТИКА И ВОРОНКА ── */}
        {admin.currentView === 'analytics' && (
          <DePinAnalyticsTab tenantId={tenantId} />
        )}

        {/* ── 3. ВИД 1: ТАБЛИЦА УЗЛОВ И ЗАРАБОТКА (HIGH DENSITY) ── */}
        {admin.currentView === 'nodes' && (
          <DePinNodesTableView
            nodes={admin.nodes}
            filteredNodes={admin.filteredNodes}
            loading={admin.loading}
            onOpenEditNode={admin.handleOpenEditNode}
          />
        )}

        {/* ── 4. ВИД 2: ОЧЕРЕДЬ ЗАДАНИЙ / ИНФО ── */}
        {(admin.currentView === 'targets' || admin.currentView === 'info') && (
          <DePinTargetsTableView targets={admin.targets} currentView={admin.currentView} />
        )}
      </Card>

      {/* ── 5. МОДАЛЬНЫЕ ОКНА УПРАВЛЕНИЯ И СОЗДАНИЯ ── */}
      <DePinNodesModals
        selectedNode={admin.selectedNode}
        setSelectedNode={admin.setSelectedNode}
        editReputation={admin.editReputation}
        setEditReputation={admin.setEditReputation}
        resetFailed={admin.resetFailed}
        setResetFailed={admin.setResetFailed}
        creditsAdj={admin.creditsAdj}
        setCreditsAdj={admin.setCreditsAdj}
        isUpdatingNode={admin.isUpdatingNode}
        onSaveNode={admin.handleSaveNode}
        isCreateTargetOpen={admin.isCreateTargetOpen}
        setIsCreateTargetOpen={admin.setIsCreateTargetOpen}
        targetChannel={admin.targetChannel}
        setTargetChannel={admin.setTargetChannel}
        targetPostId={admin.targetPostId}
        setTargetPostId={admin.setTargetPostId}
        targetType={admin.targetType}
        setTargetType={admin.setTargetType}
        targetViews={admin.targetViews}
        setTargetViews={admin.setTargetViews}
        isCreatingTarget={admin.isCreatingTarget}
        onCreateTarget={admin.handleCreateTarget}
      />
    </div>
  );
}
