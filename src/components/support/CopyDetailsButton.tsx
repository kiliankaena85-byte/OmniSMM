'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

interface CopyDetailsButtonProps {
  textToCopy: string;
}

export function CopyDetailsButton({ textToCopy }: CopyDetailsButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <Button
      intent="secondary"
      onClick={handleCopy}
      className="flex items-center gap-2 rounded-full min-h-[48px] px-6 text-sm font-semibold transition-all duration-200"
      aria-label="Скопировать детали платежа в буфер обмена"
    >
      {copied ? (
        <>
          <Check size={18} className="text-success" />
          <span>Скопировано!</span>
        </>
      ) : (
        <>
          <Copy size={18} className="text-muted-foreground" />
          <span>Скопировать детали ошибки</span>
        </>
      )}
    </Button>
  );
}
