'use client';

import * as React from 'react';
import type { DePinNodeAdminItem } from '@/actions/admin/depin/depin-admin-actions';
import { DePinNodeEditModal } from './depin-node-edit-modal';
import { DePinTargetCreateModal } from './depin-target-create-modal';

interface DePinNodesModalsProps {
  selectedNode: DePinNodeAdminItem | null;
  setSelectedNode: (node: DePinNodeAdminItem | null) => void;
  editReputation: number;
  setEditReputation: (val: number) => void;
  resetFailed: boolean;
  setResetFailed: (val: boolean) => void;
  creditsAdj: number;
  setCreditsAdj: (val: number) => void;
  isUpdatingNode: boolean;
  onSaveNode: () => void;

  isCreateTargetOpen: boolean;
  setIsCreateTargetOpen: (open: boolean) => void;
  targetChannel: string;
  setTargetChannel: (val: string) => void;
  targetPostId: string;
  setTargetPostId: (val: string) => void;
  targetType: 'VIEW_POST' | 'REACT_POST' | 'MULTI_POST' | 'SMART_COMMENT';
  setTargetType: (val: 'VIEW_POST' | 'REACT_POST' | 'MULTI_POST' | 'SMART_COMMENT') => void;
  targetViews: string;
  setTargetViews: (val: string) => void;
  isCreatingTarget: boolean;
  onCreateTarget: () => void;
}

export function DePinNodesModals(props: DePinNodesModalsProps) {
  return (
    <>
      <DePinNodeEditModal
        selectedNode={props.selectedNode}
        setSelectedNode={props.setSelectedNode}
        editReputation={props.editReputation}
        setEditReputation={props.setEditReputation}
        resetFailed={props.resetFailed}
        setResetFailed={props.setResetFailed}
        creditsAdj={props.creditsAdj}
        setCreditsAdj={props.setCreditsAdj}
        isUpdatingNode={props.isUpdatingNode}
        onSaveNode={props.onSaveNode}
      />

      <DePinTargetCreateModal
        isCreateTargetOpen={props.isCreateTargetOpen}
        setIsCreateTargetOpen={props.setIsCreateTargetOpen}
        targetChannel={props.targetChannel}
        setTargetChannel={props.setTargetChannel}
        targetPostId={props.targetPostId}
        setTargetPostId={props.setTargetPostId}
        targetType={props.targetType}
        setTargetType={props.setTargetType}
        targetViews={props.targetViews}
        setTargetViews={props.setTargetViews}
        isCreatingTarget={props.isCreatingTarget}
        onCreateTarget={props.onCreateTarget}
      />
    </>
  );
}
