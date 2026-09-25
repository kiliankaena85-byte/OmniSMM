'use client';

import { useState } from 'react';
import { Copy, Check, ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface LogDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  data: unknown;
}

export function LogDetailsModal({
  isOpen,
  onClose,
  title,
  subtitle,
  data,
}: LogDetailsModalProps) {
  const [copied, setCopied] = useState(false);

  const formattedData = typeof data === 'string'
    ? data
    : JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write error
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="flex flex-col gap-1 border-b border-border bg-muted/40 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
                {title}
              </DialogTitle>
              {subtitle && (
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 font-normal">
                  {subtitle}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        <div className="p-5 font-mono text-xs text-foreground bg-muted/20">
          <pre className="whitespace-pre-wrap break-all rounded-lg p-4 bg-background border border-border/80 leading-relaxed max-h-[50vh] overflow-y-auto">
            {formattedData || 'Данные отсутствуют'}
          </pre>
        </div>
        <DialogFooter className="border-t border-border bg-muted/30 p-3 flex items-center justify-between sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            className="font-medium mr-auto"
            onClick={handleCopy}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
            {copied ? 'Скопировано' : 'Копировать'}
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
