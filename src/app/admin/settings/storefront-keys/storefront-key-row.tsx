'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KeyRound, ShieldAlert, Check, Copy, Ban, Clock } from 'lucide-react';
import { toast } from 'sonner';

export interface StorefrontKeyRowProps {
  id: string;
  type: 'PUBLISHABLE' | 'SECRET';
  keyPrefix: string;
  name: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  onRevoke: (id: string) => void;
  isRevoking?: boolean;
}

export function StorefrontKeyRow({
  id,
  type,
  keyPrefix,
  name,
  isActive,
  lastUsedAt,
  createdAt,
  onRevoke,
  isRevoking,
}: StorefrontKeyRowProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(keyPrefix);
    setCopied(true);
    toast.success('Префикс ключа скопирован');
    setTimeout(() => setCopied(false), 2000);
  };

  const isPublishable = type === 'PUBLISHABLE';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/60 bg-card/40 hover:bg-card/70 transition-all gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className={`p-2.5 rounded-lg shrink-0 ${isPublishable ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'}`}>
          <KeyRound className="w-5 h-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground truncate max-w-[240px]">
              {name || (isPublishable ? 'Публичный ключ' : 'Секретный ключ')}
            </span>
            <Badge intent={isPublishable ? 'secondary' : 'outline'} className="text-[10px] tracking-wider uppercase">
              {isPublishable ? 'Publishable' : 'Secret'}
            </Badge>
            {isActive ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500">
                Активен
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                Отозван
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span>{keyPrefix}••••••••</span>
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Скопировать префикс"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
            <span>Создан: {new Date(createdAt).toLocaleDateString('ru-RU')}</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastUsedAt ? `Исп.: ${new Date(lastUsedAt).toLocaleDateString('ru-RU')}` : 'Не использовался'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        {isActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRevoke(id)}
            disabled={isRevoking}
            className="text-xs h-8 text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
          >
            <Ban className="w-3.5 h-3.5" />
            Отозвать
          </Button>
        )}
      </div>
    </div>
  );
}
