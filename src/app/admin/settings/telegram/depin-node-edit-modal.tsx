'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sliders, Loader2 } from 'lucide-react';
import type { DePinNodeAdminItem } from '@/actions/admin/depin/depin-admin-actions';

interface DePinNodeEditModalProps {
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
}

export function DePinNodeEditModal({
  selectedNode,
  setSelectedNode,
  editReputation,
  setEditReputation,
  resetFailed,
  setResetFailed,
  creditsAdj,
  setCreditsAdj,
  isUpdatingNode,
  onSaveNode,
}: DePinNodeEditModalProps) {
  if (!selectedNode) return null;

  return (
    <Dialog open={Boolean(selectedNode)} onOpenChange={(open) => !open && setSelectedNode(null)}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            <span>Управление узлом {selectedNode.id}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Корректировка индекса репутации и сброс штрафных баллов за невыполненные задания.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Текущий баланс:</span>
              <span className="font-mono font-bold text-amber-400">{selectedNode.creditsBalance} PTS ({selectedNode.rublesEquivalent} ₽)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Выполнено заданий:</span>
              <span className="font-mono font-bold text-foreground">{selectedNode.totalCompletedTasks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Зафиксировано сбоев/отписок:</span>
              <span className="font-mono font-bold text-rose-400">{selectedNode.tasksFailed}</span>
            </div>
          </div>

          {/* Слайдер репутации */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground flex justify-between">
              <span>Репутация узла (Trust Score):</span>
              <span className="font-mono font-extrabold text-primary">{editReputation}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={editReputation}
              onChange={(e) => setEditReputation(parseInt(e.target.value, 10))}
              className="w-full accent-primary cursor-pointer"
            />
            <p className="text-[11px] text-muted-foreground">
              При репутации &lt; 50% узел перестает получать высокооплачиваемые задачи на реакции и комментарии.
            </p>
          </div>

          {/* Корректировка баланса */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground">
              Корректировка кредитов (PTS):
            </label>
            <Input
              type="number"
              value={creditsAdj}
              onChange={(e) => setCreditsAdj(parseInt(e.target.value, 10) || 0)}
              placeholder="+100 или -50"
              className="h-8 text-xs font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Введите положительное число для бонуса или отрицательное для штрафа.
            </p>
          </div>

          {/* Чекбокс сброса сбоев */}
          {selectedNode.tasksFailed > 0 && (
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/20 border border-border/60 cursor-pointer">
              <input
                type="checkbox"
                checked={resetFailed}
                onChange={(e) => setResetFailed(e.target.checked)}
                className="rounded accent-primary w-4 h-4 cursor-pointer"
              />
              <span className="font-medium text-foreground">Сбросить счетчик нарушений (обнулить штрафы)</span>
            </label>
          )}
        </div>

        <DialogFooter className="flex gap-2 pt-2">
          <Button
            type="button"
            intent="secondary"
            size="sm"
            onClick={() => setSelectedNode(null)}
            className="cursor-pointer"
          >
            Отмена
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSaveNode}
            disabled={isUpdatingNode}
            className="font-bold cursor-pointer bg-primary gap-1.5"
          >
            {isUpdatingNode && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Применить изменения</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
