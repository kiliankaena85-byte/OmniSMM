'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { updateApiWebhookAction } from '@/actions/user/settings-extra';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ApiWebhookInput, UpdateApiWebhookResult } from '@/actions/user/settings-extra.types';
import { Webhook, Copy, CheckCheck, RefreshCw, Save, ShieldCheck, Power } from 'lucide-react';
import { toast } from 'sonner';

export interface ApiWebhookCardProps {
  initialData?: {
    webhookUrl?: string | null;
    webhookSecret?: string | null;
    isWebhookActive?: boolean;
  };
}

export default function ApiWebhookCard({ initialData }: ApiWebhookCardProps) {
  const [isPending, startTransition] = useTransition();
  const [webhookUrl, setWebhookUrl] = useState(initialData?.webhookUrl || '');
  const [webhookSecret, setWebhookSecret] = useState(initialData?.webhookSecret || '');
  const [isWebhookActive, setIsWebhookActive] = useState(
    initialData?.isWebhookActive ?? (!!initialData?.webhookUrl)
  );
  const [copied, setCopied] = useState(false);

  const handleCopySecret = async () => {
    if (!webhookSecret) return;
    try {
      await navigator.clipboard.writeText(webhookSecret);
      setCopied(true);
      toast.success('Секретный ключ скопирован');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Не удалось скопировать ключ');
    }
  };

  const handleSave = (regenerateSecret: boolean = false, nextActiveState?: boolean) => {
    const targetActiveState = nextActiveState ?? isWebhookActive;
    const trimmedUrl = webhookUrl.trim();
    if (trimmedUrl && !trimmedUrl.startsWith('https://')) {
      toast.error('URL вебхука должен начинаться с https://');
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateApiWebhookAction({
          webhookUrl: trimmedUrl,
          isWebhookActive: targetActiveState,
          regenerateSecret,
        });

        if (!res.success) {
          toast.error(res.error || 'Ошибка при сохранении вебхука');
          return;
        }

        setWebhookUrl(res.webhookUrl || '');
        if (res.webhookSecret) {
          setWebhookSecret(res.webhookSecret);
        }
        if (typeof res.isWebhookActive === 'boolean') {
          setIsWebhookActive(res.isWebhookActive);
        }

        if (regenerateSecret) {
          toast.success('Новый секретный ключ вебхука сгенерирован!');
        } else {
          toast.success('Настройки API-вебхука успешно сохранены!');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Неизвестная ошибка';
        toast.error(`Ошибка при сохранении: ${msg}`);
      }
    });
  };

  const handleToggleActive = () => {
    const nextState = !isWebhookActive;
    setIsWebhookActive(nextState);
    handleSave(false, nextState);
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-sm">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Webhook className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground text-sm">
              Webhook & Автоматизация
            </h2>
            <p className="text-[10px] text-muted-foreground">
              Автоматическая отправка статусов заказов и событий на ваш сервер
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Active status toggle switch */}
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={isPending}
            aria-label={isWebhookActive ? 'Деактивировать вебхук' : 'Активировать вебхук'}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-all duration-200 ${
              isWebhookActive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-muted border-border/80 text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Power className={`w-3.5 h-3.5 ${isWebhookActive ? 'text-emerald-500' : 'text-muted-foreground'}`} />
            <span>{isWebhookActive ? 'Активен (isWebhookActive: true)' : 'Отключён (isWebhookActive: false)'}</span>
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Webhook URL input */}
        <div className="space-y-1">
          <label htmlFor="webhookUrl" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Webhook URL (HTTPS) — webhookUrl
          </label>
          <input
            id="webhookUrl"
            type="url"
            placeholder="https://api.yourcompany.com/v1/smmplan-webhook"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="w-full text-base sm:text-sm border border-border/80 rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background/50 hover:bg-background/80 transition-all duration-200 font-mono"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Все события (изменение статусов заказов, выполнение, отмена) будут отправляться методом POST на этот URL.
          </p>
        </div>

        {/* Webhook Secret input / display */}
        <div className="space-y-1 pt-2">
          <label htmlFor="webhookSecret" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Webhook Secret (HMAC-SHA256) — webhookSecret
          </label>
          <div className="flex gap-2">
            <input
              id="webhookSecret"
              type="text"
              readOnly
              value={webhookSecret || 'Секретный ключ еще не сгенерирован'}
              className="flex-1 min-w-0 bg-muted/40 border border-border rounded-xl px-4 py-2.5 font-mono text-base sm:text-xs text-foreground truncate select-all outline-none"
            />
            {webhookSecret && (
              <button
                type="button"
                onClick={handleCopySecret}
                aria-label="Скопировать секрет вебхука"
                className={`shrink-0 px-3.5 py-2.5 rounded-xl border font-semibold text-xs flex items-center gap-1.5 transition-all duration-200 ${
                  copied
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-card border-border hover:bg-muted text-foreground'
                }`}
              >
                {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Скопировано' : 'Скопировать'}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isPending}
              aria-label="Сгенерировать новый секрет вебхука"
              title="Сгенерировать новый секрет"
              className="shrink-0 px-3.5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 flex items-center gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
              Секрет
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
            Используйте этот ключ для проверки подписи подлинности заголовка <code className="text-foreground font-mono font-bold">X-Smmplan-Signature</code>.
          </p>
        </div>

        <div className="flex items-center justify-end pt-3 border-t border-border/40 gap-2">
          <Button
            type="button"
            onClick={() => handleSave(false)}
            intent="primary"
            size="sm"
            isAnimated={true}
            disabled={isPending}
            className="rounded-xl shrink-0 font-semibold px-6 shadow-sm gap-2"
          >
            <Save className="w-4 h-4" />
            {isPending ? 'Сохранение...' : 'Сохранить настройки вебхука'}
          </Button>
        </div>
      </div>
    </div>
  );
}
