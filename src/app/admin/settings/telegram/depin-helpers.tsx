'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';

export function formatRelativeTime(dateInput: Date | string | number): string {
  const date = new Date(dateInput);
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return 'только что';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;
  return `${Math.floor(diffHours / 24)} дн назад`;
}

export function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Скопировано в буфер');
    } catch {
      toast.error('Не удалось скопировать');
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-colors"
      title="Копировать"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}
