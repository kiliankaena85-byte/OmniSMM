import React from 'react';
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

interface ProxyDeleteDialogProps {
  proxyToDelete: { id: string; label: string } | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function ProxyDeleteDialog({
  proxyToDelete,
  onClose,
  onConfirm,
}: ProxyDeleteDialogProps) {
  return (
    <Dialog open={!!proxyToDelete} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-3 text-rose-500 pb-2">
            <AlertTriangle className="w-6 h-6" />
            <DialogTitle className="text-lg font-bold">Удаление прокси-сервера</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Вы уверены, что хотите удалить прокси <strong className="text-foreground">«{proxyToDelete?.label}»</strong>?
            <br /><br />
            ⚠️ Все провайдеры услуг, привязанные к данному прокси, будут автоматически переведены на прямое подключение без защиты прокси.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            className="font-bold gap-1.5"
          >
            Удалить прокси
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
