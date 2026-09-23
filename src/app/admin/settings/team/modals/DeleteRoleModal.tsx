'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';

interface DeleteRoleModalProps {
  roleToDelete: { id: string; name: string } | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending?: boolean;
}

export function DeleteRoleModal({
  roleToDelete,
  onClose,
  onConfirm,
  isPending = false,
}: DeleteRoleModalProps) {
  return (
    <Dialog open={!!roleToDelete} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-3 text-rose-500 pb-1">
            <AlertTriangle className="w-5 h-5" />
            <DialogTitle className="text-base font-bold">Удалить роль</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Роль <strong className="text-foreground">«{roleToDelete?.name}»</strong> будет удалена.
            Все сотрудники с этой ролью потеряют её доступы.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Отмена
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={isPending} className="font-bold gap-1.5">
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Удалить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
