'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TelegramResetWebhookDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function TelegramResetWebhookDialog({
  isOpen,
  onOpenChange,
  onConfirm,
}: TelegramResetWebhookDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-3 text-amber-500 pb-2">
            <AlertTriangle className="w-6 h-6" />
            <DialogTitle className="text-lg font-bold">Сброс очереди Telegram</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Действие вызовет метод <code>deleteWebhook(&#123; drop_pending_updates: true &#125;)</code> на серверах Telegram.
            <br /><br />
            • Все зависшие очереди входящих сообщений будут очищены.<br />
            • Активные вебхуки будут удалены в пользу Long Polling демона.<br />
            • Рекомендуется применять при ошибках <code>409 Conflict</code>.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 pt-4">
          <Button
            type="button"
            intent="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            className="font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
          >
            Сбросить очередь
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
