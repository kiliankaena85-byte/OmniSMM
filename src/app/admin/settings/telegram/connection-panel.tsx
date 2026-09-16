'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useActionState, useTransition, useState, useEffect } from 'react';
import { Loader2, Send, RotateCcw, Radio, ExternalLink, Key, ShieldCheck, CheckCircle, AlertCircle, Wifi, WifiOff, Server, AlertTriangle, Unlink, Trash2 } from 'lucide-react';
import { updateGlobalSettings, disconnectTelegramBotAction } from '@/actions/admin/settings';
import { sendTelegramTestAlertAction } from '@/actions/admin/telegram-bot';
import type { TelegramBotDiagnostics } from '@/types/telegram';
import type { SystemSettings } from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  settings: SystemSettings;
  tenantId?: string;
  diagnostics: TelegramBotDiagnostics | null;
  onRefresh: () => void;
}

export function ConnectionPanel({ settings, tenantId = 'smmplan', diagnostics, onRefresh }: Props) {
  const [isPendingReset, startTransitionReset] = useTransition();
  const [isPendingTestMsg, startTransitionTestMsg] = useTransition();
  const [isDisconnectBotModalOpen, setIsDisconnectBotModalOpen] = useState(false);
  const [isDisconnectingBot, startDisconnectBotTransition] = useTransition();
  const [testChatId, setTestChatId] = useState('');
  const [testMsgText, setTestMsgText] = useState('Проверка доставки уведомлений из панели управления.');
  const [botName, setBotName] = useState(settings.contactTelegramBot || '');
  const [channelName, setChannelName] = useState(settings.contactTelegramChannel || '');

  useEffect(() => {
    setBotName(settings.contactTelegramBot || '');
    setChannelName(settings.contactTelegramChannel || '');
  }, [settings.contactTelegramBot, settings.contactTelegramChannel, tenantId]);

  const [state, formAction, isPendingSave] = useActionState(
    async (prevState: unknown, formData: FormData) => {
      try {
        const res = await updateGlobalSettings(formData);
        if (res && typeof res === 'object' && 'success' in res && !res.success) return res;
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }, null
  );
  const formState = state as { success?: boolean; error?: string } | null;

  useEffect(() => {
    if (formState?.success) { toast.success('Настройки подключения сохранены'); onRefresh(); }
    else if (formState?.error) { toast.error(formState.error); }
  }, [formState]);

  const handleSendTestMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('tenantId', tenantId);
    startTransitionTestMsg(async () => {
      try {
        const res = await sendTelegramTestAlertAction(formData);
        toast[ res.success ? 'success' : 'error'](res.success ? res.message! : res.error!);
      } catch (err) { toast.error(String(err)); }
    });
  };

  return (
    <div className="space-y-6">
      {/* Bot Disconnect Confirmation Dialog */}
      <Dialog open={isDisconnectBotModalOpen} onOpenChange={setIsDisconnectBotModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <div className="flex items-center gap-3 text-rose-500 pb-2">
              <AlertTriangle className="w-6 h-6" />
              <DialogTitle className="text-lg font-bold">Отвязать Telegram-бота?</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Вы уверены, что хотите отвязать бота от бренда <strong className="text-foreground">{tenantId === 'flux' ? 'SMMflux' : 'SMMplan'}</strong>?
              <br /><br />
              ⚠️ Токен бота и юзернейм для этого бренда будут очищены. Настройки других брендов затронуты не будут.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDisconnectBotModalOpen(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setIsDisconnectBotModalOpen(false);
                startDisconnectBotTransition(async () => {
                  try {
                    const res = await disconnectTelegramBotAction(tenantId);
                    if (res.success) {
                      setBotName('');
                      setChannelName('');
                      toast.success(res.message);
                      onRefresh();
                    } else if ('error' in res) {
                      toast.error(res.error || 'Ошибка при отвязке бота');
                    }
                  } catch (err) { toast.error(String(err)); }
                });
              }}
              disabled={isDisconnectingBot}
              className="font-bold gap-1.5"
            >
              {isDisconnectingBot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Отвязать бота
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="tenantId" value={tenantId} />
        {/* Auth & Secrets */}
        <Card className="rounded-3xl border border-border/80 shadow-sm bg-card p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <span className="p-1 px-2.5 bg-primary/10 text-primary rounded-md text-[10px] font-bold">AUTH</span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Идентификаторы и Секреты ({tenantId === 'flux' ? 'SMMflux' : 'SMMplan'})</h3>
            </div>
            {Boolean(botName || settings.telegramBotToken) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDisconnectBotModalOpen(true)}
                disabled={isDisconnectingBot}
                className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-500/30 gap-1.5 h-8 cursor-pointer"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Отвязать бота</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Юзернейм бота (без @)</Label>
              <Input name="contactTelegramBot" value={botName} onChange={(e) => setBotName(e.target.value)} placeholder={tenantId === 'flux' ? 'smmflux_support_bot' : 'smmplan_support_bot'} className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Официальный канал</Label>
              <Input name="contactTelegramChannel" value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder={tenantId === 'flux' ? '@smmflux_news' : '@smmplan_news'} className="font-mono text-xs" />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Токен Telegram Бота
              </Label>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                AES-256-GCM Vault
              </span>
            </div>
            <Input name="telegramBotToken" type="password"
              placeholder={settings.telegramBotToken ? '••••••••••••••••' : 'Вставьте токен от @BotFather'}
              className="font-mono text-xs" autoComplete="new-password" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Токен шифруется в БД (AES-256-GCM) и имеет приоритет над .env
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/40">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Режим работы</Label>
            <select name="telegramBotMode" defaultValue={settings.telegramBotMode || 'polling'}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none">
              <option value="polling">Long Polling (Демон)</option>
              <option value="webhook">Webhook (HTTP POST)</option>
            </select>
          </div>

          {/* Connection Status Detail */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
            <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Server className="w-3 h-3 text-blue-400" /> Daemon
              </span>
              <div className="flex items-center gap-1.5">
                {diagnostics?.daemonRunning ? (
                  <><Wifi className="w-4 h-4 text-emerald-400" /><span className="text-xs font-bold text-emerald-400">Active ({diagnostics.heartbeatAgeMs}ms)</span></>
                ) : (
                  <><WifiOff className="w-4 h-4 text-rose-400" /><span className="text-xs font-bold text-rose-400">Stopped</span></>
                )}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Key className="w-3 h-3 text-amber-400" /> Proxy
              </span>
              <div className="flex items-center gap-1.5">
                {diagnostics?.proxy?.isActive ? (
                  <><ShieldCheck className="w-4 h-4 text-emerald-400" /><span className="text-xs font-bold text-emerald-400">{diagnostics.proxy.label} ({diagnostics.proxy.protocol})</span></>
                ) : (
                  <><AlertCircle className="w-4 h-4 text-zinc-500" /><span className="text-xs font-bold text-zinc-400">Direct</span></>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isPendingSave} className="font-bold uppercase tracking-widest text-xs h-11 px-6 shadow-lg shadow-primary/20 cursor-pointer">
              {isPendingSave && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Сохранить подключение
            </Button>
          </div>
        </Card>
      </form>

      {/* Test Message Dispatcher */}
      <Card className="rounded-3xl border border-border/80 shadow-sm bg-card p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
          <span className="p-1 px-2.5 bg-purple-500/10 text-purple-400 rounded-md text-[10px] font-bold">TEST</span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Тестовое сообщение</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">Лимит: 5 / 10 мин</span>
        </div>
        <form onSubmit={handleSendTestMessage} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Chat ID</Label>
              <Input name="chatId" value={testChatId} onChange={(e) => setTestChatId(e.target.value)}
                placeholder="123456789" className="font-mono text-xs" required />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Текст</Label>
              <Input name="message" value={testMsgText} onChange={(e) => setTestMsgText(e.target.value)} className="text-xs" required />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" intent="secondary" size="sm" disabled={isPendingTestMsg} className="font-bold text-xs h-9 gap-1.5 cursor-pointer">
              {isPendingTestMsg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Отправить
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}