'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Подтверждение действия",
  children,
  confirmText = "Да",
  cancelText = "Отмена",
  isDanger = false
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl border border-border bg-background shadow-2xl p-6">
        <DialogHeader className="pb-3 border-b border-border/50">
          <DialogTitle className="text-foreground font-black text-base">
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 text-muted-foreground text-xs leading-relaxed font-medium">
          {children}
        </div>

        <DialogFooter className="mt-4 pt-4 border-t border-border/50">
          <DialogClose render={<Button intent="outline" className="text-xs h-9 font-semibold" onClick={onClose} />}>
            {cancelText}
          </DialogClose>
          <Button 
            intent={isDanger ? "destructive" : "primary"} 
            onClick={onConfirm} 
            className="text-xs h-9 font-semibold"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
