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
import { Radio, Loader2 } from 'lucide-react';

interface DePinTargetCreateModalProps {
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

export function DePinTargetCreateModal({
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
  onCreateTarget,
}: DePinTargetCreateModalProps) {
  return (
    <Dialog open={isCreateTargetOpen} onOpenChange={setIsCreateTargetOpen}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            <span>Добавить задание в очередь DePIN</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Узлы сети DePIN получат это задание и распределенно выполнят просмотры или реакции.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-foreground">Канал Telegram:</label>
            <Input
              value={targetChannel}
              onChange={(e) => setTargetChannel(e.target.value)}
              placeholder="smmMarket69 (без @)"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-foreground">Номер поста (#ID):</label>
              <Input
                type="number"
                value={targetPostId}
                onChange={(e) => setTargetPostId(e.target.value)}
                placeholder="32"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Количество действий:</label>
              <Input
                type="number"
                value={targetViews}
                onChange={(e) => setTargetViews(e.target.value)}
                placeholder="25"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-foreground">Тип действия:</label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as 'VIEW_POST' | 'REACT_POST' | 'MULTI_POST' | 'SMART_COMMENT')}
              className="w-full h-8 px-2.5 rounded-xl bg-background border border-border text-xs text-foreground cursor-pointer"
            >
              <option value="VIEW_POST">👁 Просмотр поста (VIEW_POST, +5-10 PTS)</option>
              <option value="REACT_POST">🔥 Реакция на пост (REACT_POST, +8-10 PTS)</option>
              <option value="MULTI_POST">📚 Пакетный просмотр (MULTI_POST, +15 PTS)</option>
              <option value="SMART_COMMENT">💬 ИИ-комментарий (SMART_COMMENT, +35 PTS)</option>
            </select>
          </div>
        </div>

        <DialogFooter className="flex gap-2 pt-2">
          <Button
            type="button"
            intent="secondary"
            size="sm"
            onClick={() => setIsCreateTargetOpen(false)}
            className="cursor-pointer"
          >
            Отмена
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onCreateTarget}
            disabled={isCreatingTarget}
            className="font-bold cursor-pointer bg-primary gap-1.5"
          >
            {isCreatingTarget && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Добавить в очередь</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
