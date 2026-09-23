import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Loader2, Layers } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { RawFormData } from './types';
import type { ProxyCategory, ProxyProtocol } from '@/types/provider-proxy';

interface ProxyImportRawListModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  rawForm: RawFormData;
  setRawForm: React.Dispatch<React.SetStateAction<RawFormData>>;
  onImport: () => void;
  isPending: boolean;
}

export function ProxyImportRawListModal({
  isOpen,
  onOpenChange,
  rawForm,
  setRawForm,
  onImport,
  isPending,
}: ProxyImportRawListModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-primary pb-1">
            <FileText className="w-5 h-5" />
            <DialogTitle className="text-base font-bold">Массовый импорт прокси списком</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Вставьте список прокси (каждый с новой строки). Форматы: <code className="font-mono text-foreground">host:port</code>, <code className="font-mono text-foreground">host:port:user:pass</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Список прокси (до 500 строк) *</Label>
            <Textarea
              rows={6}
              value={rawForm.rawListText}
              onChange={(e) => setRawForm((prev) => ({ ...prev, rawListText: e.target.value }))}
              placeholder={`185.209.29.226:1080\n45.74.31.30:6154:user:pass`}
              className="font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Категория</Label>
              <select
                value={rawForm.category}
                onChange={(e) => setRawForm((prev) => ({ ...prev, category: e.target.value as ProxyCategory }))}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium"
              >
                <option value="PAID_PREMIUM">💎 Платный Premium</option>
                <option value="FREE_PUBLIC">🌿 Бесплатный пул</option>
                <option value="BACKUP_RESERVE">🛡️ Резерв</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Протокол</Label>
              <select
                value={rawForm.defaultProtocol}
                onChange={(e) => setRawForm((prev) => ({ ...prev, defaultProtocol: e.target.value as ProxyProtocol }))}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium"
              >
                <option value="socks5">SOCKS5</option>
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Тег</Label>
              <Input
                value={rawForm.tag}
                onChange={(e) => setRawForm((prev) => ({ ...prev, tag: e.target.value }))}
                placeholder="batch-2026"
                className="text-xs"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onImport}
            disabled={isPending || !rawForm.rawListText.trim()}
            className="font-bold text-xs gap-1.5"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
            Импортировать список
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
