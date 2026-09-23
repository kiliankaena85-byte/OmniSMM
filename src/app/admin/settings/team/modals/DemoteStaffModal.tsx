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
import { UserMinus, Loader2 } from 'lucide-react';

interface DemoteStaffModalProps {
  staffToRemove: { id: string; email: string; role: string } | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending?: boolean;
}

export function DemoteStaffModal({
  staffToRemove,
  onClose,
  onConfirm,
  isPending = false,
}: DemoteStaffModalProps) {
  return (
    <Dialog open={!!staffToRemove} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-3 text-amber-500 pb-1">
            <UserMinus className="w-5 h-5" />
            <DialogTitle className="text-base font-bold">Разжаловать сотрудника</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground font-mono">{staffToRemove?.email}</strong> будет переведён в роль{' '}
            <strong className="text-foreground">USER</strong>. Аккаунт и история сохраняются.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Отмена
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isPending}
            className="font-bold gap-1.5"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
            Разжаловать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
