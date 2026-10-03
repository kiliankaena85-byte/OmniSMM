'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  getDePinAdminDataAction,
  updateDePinNodeAction,
  createDePinTargetAdminAction,
  type DePinAdminStats,
  type DePinNodeAdminItem,
  type DePinTargetAdminItem,
} from '@/actions/admin/depin/depin-admin-actions';
import type { DePinSubView } from './depin-nodes-toolbar';

export function useDePinAdmin() {
  const [stats, setStats] = React.useState<DePinAdminStats | null>(null);
  const [nodes, setNodes] = React.useState<DePinNodeAdminItem[]>([]);
  const [targets, setTargets] = React.useState<DePinTargetAdminItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [currentView, setCurrentView] = React.useState<DePinSubView>('analytics');

  // Edit Node Modal State
  const [selectedNode, setSelectedNode] = React.useState<DePinNodeAdminItem | null>(null);
  const [editReputation, setEditReputation] = React.useState<number>(100);
  const [resetFailed, setResetFailed] = React.useState(false);
  const [creditsAdj, setCreditsAdj] = React.useState<number>(0);
  const [isUpdatingNode, startNodeTransition] = React.useTransition();

  // Create Target Modal State
  const [isCreateTargetOpen, setIsCreateTargetOpen] = React.useState(false);
  const [targetChannel, setTargetChannel] = React.useState('');
  const [targetPostId, setTargetPostId] = React.useState('');
  const [targetType, setTargetType] = React.useState<'VIEW_POST' | 'REACT_POST' | 'MULTI_POST' | 'SMART_COMMENT'>('VIEW_POST');
  const [targetViews, setTargetViews] = React.useState('25');
  const [isCreatingTarget, startTargetTransition] = React.useTransition();

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDePinAdminDataAction();
      if (res.success) {
        if (res.stats) setStats(res.stats);
        if (res.nodes) setNodes(res.nodes);
        if (res.targets) setTargets(res.targets);
      } else {
        toast.error(res.error || 'Ошибка загрузки данных');
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenEditNode = (node: DePinNodeAdminItem) => {
    setSelectedNode(node);
    setEditReputation(node.reputation);
    setResetFailed(false);
    setCreditsAdj(0);
  };

  const handleSaveNode = () => {
    if (!selectedNode) return;
    startNodeTransition(async () => {
      try {
        const res = await updateDePinNodeAction({
          nodeId: selectedNode.id,
          reputation: editReputation,
          resetFailedTasks: resetFailed,
          creditsAdjustment: creditsAdj !== 0 ? creditsAdj : undefined,
        });

        if (res.success) {
          toast.success(res.message);
          setSelectedNode(null);
          loadData();
        } else {
          toast.error(res.error || 'Ошибка обновления узла');
        }
      } catch (err) {
        toast.error(String(err));
      }
    });
  };

  const handleCreateTarget = () => {
    const pId = parseInt(targetPostId, 10);
    const views = parseInt(targetViews, 10);
    if (!targetChannel.trim() || isNaN(pId) || pId <= 0 || isNaN(views) || views <= 0) {
      toast.error('Заполните все поля корректно');
      return;
    }

    startTargetTransition(async () => {
      try {
        const res = await createDePinTargetAdminAction({
          channel: targetChannel,
          postId: pId,
          type: targetType,
          targetViews: views,
        });

        if (res.success) {
          toast.success(res.message);
          setIsCreateTargetOpen(false);
          setTargetChannel('');
          setTargetPostId('');
          loadData();
        } else {
          toast.error(res.error || 'Ошибка создания задания');
        }
      } catch (err) {
        toast.error(String(err));
      }
    });
  };

  const filteredNodes = React.useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const q = searchQuery.toLowerCase();
    return nodes.filter(
      (n) =>
        n.id.toLowerCase().includes(q) ||
        (n.telegramId && n.telegramId.toLowerCase().includes(q)) ||
        (n.linkedUserEmail && n.linkedUserEmail.toLowerCase().includes(q))
    );
  }, [nodes, searchQuery]);

  return {
    stats,
    nodes,
    targets,
    loading,
    searchQuery,
    setSearchQuery,
    currentView,
    setCurrentView,
    selectedNode,
    setSelectedNode,
    editReputation,
    setEditReputation,
    resetFailed,
    setResetFailed,
    creditsAdj,
    setCreditsAdj,
    isUpdatingNode,
    isCreateTargetOpen,
    setIsCreateTargetOpen,
    targetChannel,
    setTargetChannel,
    targetPostId,
    setTargetPostId,
    targetType,
    setTargetType,
    targetViews,
    setTargetViews,
    isCreatingTarget,
    loadData,
    handleOpenEditNode,
    handleSaveNode,
    handleCreateTarget,
    filteredNodes,
  };
}
