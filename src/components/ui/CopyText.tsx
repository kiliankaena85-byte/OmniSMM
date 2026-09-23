'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CopyTextProps {
  text: string;
  displayValue?: string;
  className?: string;
  iconOnly?: boolean;
  tooltipText?: string;
}

export function CopyText({
  text,
  displayValue,
  className,
  iconOnly = false,
  tooltipText = 'Скопировать',
}: CopyTextProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Скопировано в буфер обмена!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Не удалось скопировать. Пожалуйста, скопируйте вручную.');
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'group inline-flex items-center gap-1.5 hover:text-primary transition-colors text-left outline-none rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        className
      )}
      title={copied ? 'Успешно скопировано!' : tooltipText}
      aria-label={copied ? 'Успешно скопировано!' : tooltipText}
      type="button"
    >
      {!iconOnly && (
        <span className="truncate max-w-[150px] sm:max-w-[200px]">
          {displayValue || text}
        </span>
      )}
      <span className="relative flex items-center justify-center w-5 h-5 shrink-0 rounded-md bg-muted/40 group-hover:bg-primary/10 border border-border/40 group-hover:border-primary/20 transition-all active:scale-90">
        {copied ? (
          <Check className="w-3 h-3 text-success animate-in zoom-in-50 duration-200" />
        ) : (
          <Copy className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
        )}
      </span>
    </button>
  );
}
