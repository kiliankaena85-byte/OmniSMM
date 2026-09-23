import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SubFormData } from './types';
import type { ProxyCategory, ProxyProtocol } from '@/types/provider-proxy';

interface ProxyImportSubscriptionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  subForm: SubFormData;
  setSubForm: React.Dispatch<React.SetStateAction<SubFormData>>;
  onImport: () => void;
  isPending: boolean;
}

export function ProxyImportSubscriptionModal({
  isOpen,
  onOpenChange,
  subForm,
  setSubForm,
  onImport,
  isPending,
}: ProxyImportSubscriptionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-primary pb-1">
            <Download className="w-5 h-5" />
            <DialogTitle className="text-base font-bold">Импорт подписки в 1 клик</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Вставьте ссылку на подписку (Quattro VPN, Clash, V2Ray, Shadowsocks). Платформа автоматически запросит лимиты трафика, оставшиеся дни и настроит проксирование.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">URL подписки *</Label>
            <Input
              value={subForm.subscriptionUrl}
              onChange={(e) => setSubForm((prev) => ({ ...prev, subscriptionUrl: e.target.value }))}
              placeholder="https://auth.quattro-cloud.ru/VMzjeCDftAx4PP6H"
              className="font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Название</Label>
              <Input
                value={subForm.label}
                onChange={(e) => setSubForm((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="Quattro VPN - Основной канал"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Категория</Label>
              <select
                value={subForm.category}
                onChange={(e) => setSubForm((prev) => ({ ...prev, category: e.target.value as ProxyCategory }))}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium"
              >
                <option value="PAID_PREMIUM">💎 Платный Premium (Quattro VPN)</option>
                <option value="BACKUP_RESERVE">🛡️ Резервный канал</option>
                <option value="FREE_PUBLIC">🌿 Бесплатный пул</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Протокол</Label>
              <select
                value={subForm.protocol}
                onChange={(e) => setSubForm((prev) => ({ ...prev, protocol: e.target.value as ProxyProtocol }))}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium"
              >
                <option value="socks5">SOCKS5</option>
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Локальный Хост</Label>
              <Input
                value={subForm.inboundHost}
                onChange={(e) => setSubForm((prev) => ({ ...prev, inboundHost: e.target.value }))}
                placeholder="127.0.0.1"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Входящий порт</Label>
              <Input
                type="number"
                value={subForm.inboundPort}
                onChange={(e) => setSubForm((prev) => ({ ...prev, inboundPort: e.target.value }))}
                placeholder="7891"
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="autoAssignSub"
              checked={subForm.autoAssignToProviders}
              onCheckedChange={(checked) => setSubForm((prev) => ({ ...prev, autoAssignToProviders: Boolean(checked) }))}
            />
            <label htmlFor="autoAssignSub" className="text-xs font-medium cursor-pointer">
              Автоматически привязать всех активных провайдеров без прокси к этой подписке
            </label>
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
            disabled={isPending || !subForm.subscriptionUrl.trim()}
            className="font-bold text-xs gap-1.5"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Импортировать и подключить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
