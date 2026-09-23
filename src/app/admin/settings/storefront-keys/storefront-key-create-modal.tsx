'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, AlertTriangle, KeyRound, Loader2, ShieldAlert, Globe } from 'lucide-react';
import { toast } from 'sonner';

interface StorefrontKeyCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { type: 'PUBLISHABLE' | 'SECRET'; name: string }) => Promise<string | null>;
}

export function StorefrontKeyCreateModal({
  isOpen,
  onClose,
  onSubmit,
}: StorefrontKeyCreateModalProps) {
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<'PUBLISHABLE' | 'SECRET'>('PUBLISHABLE');
  const [createdToken, setCreatedToken] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const resetState = () => {
    setName('');
    setType('PUBLISHABLE');
    setCreatedToken(null);
    setIsSubmitting(false);
    setCopied(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Укажите название ключа');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await onSubmit({ type, name: name.trim() });
      if (token) {
        setCreatedToken(token);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToken = () => {
    if (!createdToken) return;
    navigator.clipboard.writeText(createdToken);
    setCopied(true);
    toast.success('Ключ скопирован в буфер обмена');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            {createdToken ? 'Ключ успешно выпущен' : 'Выпуск нового ключа Storefront API'}
          </DialogTitle>
          <DialogDescription>
            {createdToken
              ? 'Обязательно сохраните сгенерированный токен в безопасном месте.'
              : 'Создайте API-ключ для интеграции внешней витрины или мобильного приложения.'}
          </DialogDescription>
        </DialogHeader>

        {createdToken ? (
          <div className="space-y-4 py-2">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Этот токен отображается <strong>только один раз</strong>. После закрытия окна мы не сможем его восстановить!
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ваш API токен</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={createdToken}
                  className="font-mono text-xs bg-muted selection:bg-primary/20"
                />
                <Button size="icon" variant="outline" onClick={copyToken} type="button" className="shrink-0">
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button onClick={handleClose} className="w-full sm:w-auto">
                Я сохранил ключ
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="key-name">Название ключа</Label>
              <Input
                id="key-name"
                placeholder="Например, iOS Мобильное приложение"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Тип ключа</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('PUBLISHABLE')}
                  className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                    type === 'PUBLISHABLE'
                      ? 'border-blue-500 bg-blue-500/10 text-foreground ring-1 ring-blue-500'
                      : 'border-border/70 hover:bg-accent/30 text-muted-foreground'
                  }`}
                >
                  <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-500" />
                    Publishable
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">pk_live_* (Каталог, фронтенд)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setType('SECRET')}
                  className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                    type === 'SECRET'
                      ? 'border-amber-500 bg-amber-500/10 text-foreground ring-1 ring-amber-500'
                      : 'border-border/70 hover:bg-accent/30 text-muted-foreground'
                  }`}
                >
                  <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                    Secret
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">sk_live_* (Заказы, бэкенд)</div>
                </button>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Отмена
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Сгенерировать ключ
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
