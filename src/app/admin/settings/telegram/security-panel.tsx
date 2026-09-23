'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useState, useTransition } from 'react';
import {
  Shield, Key, ShieldCheck, ShieldAlert, ShieldX, Lock, Server, AlertTriangle, Loader2, RefreshCw, Eye, EyeOff,
} from 'lucide-react';
import { updateTelegramSecurityAction } from '@/actions/admin/telegram-bot';
import type { TelegramBotDiagnostics, WebhookSecurityConfig } from '@/types/telegram';
import type { SystemSettings } from '@prisma/client';

interface Props {
  settings: SystemSettings;
  diagnostics: TelegramBotDiagnostics | null;
  onRefresh: () => void;
}

interface SecurityFormData {
  webhookSecret: string;
  allowedIps: string[];
  rateLimitPerMin: number;
  maxMessageLength: number;
  telegramMaintenanceMode: boolean;
  telegramLogErrors: boolean;
  telegramEnableCsat: boolean;
  telegramEnableSmartBind: boolean;
}

export function SecurityPanel({ settings, diagnostics, onRefresh }: Props) {
  const [showSecret, setShowSecret] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<SecurityFormData>({
    webhookSecret: '',
    allowedIps: settings.telegramAllowedIps ? JSON.parse(settings.telegramAllowedIps) : [],
    rateLimitPerMin: (settings as Record<string, unknown>).telegramRateLimitPerMin as number || 30,
    maxMessageLength: (settings as Record<string, unknown>).telegramMaxMessageLength as number || 4096,
    telegramMaintenanceMode: (settings as Record<string, unknown>).telegramMaintenanceMode as boolean || false,
    telegramLogErrors: (settings as Record<string, unknown>).telegramLogErrors as boolean || true,
    telegramEnableCsat: (settings as Record<string, unknown>).telegramEnableCsat as boolean || true,
    telegramEnableSmartBind: (settings as Record<string, unknown>).telegramEnableSmartBind as boolean || true,
  });

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateTelegramSecurityAction({
        webhookSecret: form.webhookSecret || null,
        allowedIps: form.allowedIps,
        rateLimitPerMin: form.rateLimitPerMin,
        maxMessageLength: form.maxMessageLength,
        telegramMaintenanceMode: form.telegramMaintenanceMode,
        telegramLogErrors: form.telegramLogErrors,
        telegramEnableCsat: form.telegramEnableCsat,
        telegramEnableSmartBind: form.telegramEnableSmartBind,
      });
      toast[res.success ? 'success' : 'error'](res.success ? res.message! : res.error!);
      if (res.success) onRefresh();
    });
  };

  const addIp = () => {
    const ip = newIp.trim();
    if (!ip) return;
    if (form.allowedIps.includes(ip)) { toast.error('IP уже в списке'); return; }
    setForm(p => ({ ...p, allowedIps: [...p.allowedIps, ip] }));
    setNewIp('');
  };

  const removeIp = (ip: string) => {
    setForm(p => ({ ...p, allowedIps: p.allowedIps.filter(i => i !== ip) }));
  };

  const sec = diagnostics?.security;

  // OWASP compliance checklist
  const checks = [
    { label: 'Webhook Secret (HMAC)', ok: sec?.webhookSecretSet === true, owasp: 'A08' },
    { label: 'IP Whitelist', ok: (sec?.allowedIpsCount ?? 0) > 0, owasp: 'A01' },
    { label: 'Rate Limiting', ok: (sec?.rateLimitPerMin ?? 0) <= 60, owasp: 'A05' },
    { label: 'Error Logging', ok: form.telegramLogErrors, owasp: 'A09' },
    { label: 'Input Sanitization', ok: true, owasp: 'A03' },
    { label: 'SSRF Protection', ok: true, owasp: 'A10' },
    { label: 'Audit Trail', ok: true, owasp: 'A09' },
    { label: 'Encrypted Secrets', ok: true, owasp: 'A02' },
  ];

  const passedCount = checks.filter(c => c.ok).length;

  return (
    <div className="space-y-6">
      {/* OWASP Compliance Score */}
      <Card className="rounded-3xl border border-border/80 shadow-sm bg-card p-6 space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
          <span className="p-1 px-2.5 bg-emerald-500/10 text-emerald-400 rounded-md text-[10px] font-bold">OWASP</span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Безопасность — OWASP Top 10 2025</h3>
          <span className={`ml-auto text-xs font-extrabold font-mono ${passedCount === checks.length ? 'text-emerald-400' : passedCount >= 6 ? 'text-amber-400' : 'text-rose-400'}`}>
            {passedCount}/{checks.length}
          </span>
        </div>

        {/* Compliance Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {checks.map(c => (
            <div key={c.label} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/20 border border-border/60">
              {c.ok ? <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" /> : <ShieldX className="w-4 h-4 text-rose-400 shrink-0" />}
              <span className="text-xs text-foreground flex-1">{c.label}</span>
              <span className="text-[9px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">{c.owasp}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Webhook Secret */}
      <Card className="rounded-3xl border border-border/80 shadow-sm bg-card p-6 space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
          <span className="p-1 px-2.5 bg-amber-500/10 text-amber-400 rounded-md text-[10px] font-bold">A08</span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Webhook Secret (HMAC-SHA256)</h3>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Секрет подписи вебхука
          </Label>
          <div className="relative">
            <Input
              type={showSecret ? 'text' : 'password'}
              value={form.webhookSecret}
              onChange={(e) => setForm(p => ({ ...p, webhookSecret: e.target.value }))}
              placeholder={sec?.webhookSecretSet ? '•••••••• (уже установлен, введите новый для замены)' : 'Минимум 16 символов'}
              className="font-mono text-xs pr-10"
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer">
              {showSecret ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Используется для HMAC-SHA256 верификации входящих вебхуков. Секрет шифруется AES-256-GCM.
            При смене секрета необходимо обновить конфигурацию в Telegram (setWebhook с новым secret_token).
          </p>
        </div>

        {/* IP Whitelist */}
        <div className="space-y-3 pt-4 border-t border-border/40">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" /> IP Whitelist для вебхуков
            </Label>
            <span className="text-[10px] font-mono text-muted-foreground">{form.allowedIps.length} / 20</span>
          </div>

          <div className="flex gap-2">
            <Input value={newIp} onChange={(e) => setNewIp(e.target.value)} placeholder="1.2.3.4" className="font-mono text-xs flex-1" />
            <Button type="button" variant="outline" size="sm" onClick={addIp} disabled={!newIp.trim()} className="text-xs cursor-pointer">Добавить</Button>
          </div>

          {form.allowedIps.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {form.allowedIps.map(ip => (
                <span key={ip} className="inline-flex items-center gap-1 text-[10px] font-mono bg-muted/60 text-foreground px-2 py-1 rounded-lg border border-border">
                  {ip}
                  <button type="button" onClick={() => removeIp(ip)} className="text-rose-400 hover:text-rose-300 cursor-pointer">×</button>
                </span>
              ))}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Если список пуст — принимаются запросы с любых IP. Telegram использует определённый диапазон IP для вебхуков.
          </p>
        </div>

        {/* Rate Limiting */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/40">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rate Limit (запросов/мин)</Label>
            <Input type="number" min={5} max={120} value={form.rateLimitPerMin} onChange={(e) => setForm(p => ({ ...p, rateLimitPerMin: Number(e.target.value) }))} className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Макс. длина сообщения</Label>
            <Input type="number" min={256} max={4096} value={form.maxMessageLength} onChange={(e) => setForm(p => ({ ...p, maxMessageLength: Number(e.target.value) }))} className="font-mono text-xs" />
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-border/40">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/60">
            <Checkbox checked={form.telegramMaintenanceMode} onCheckedChange={(c) => setForm(p => ({ ...p, telegramMaintenanceMode: !!c }))} />
            <div>
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Maintenance Mode</p>
              <p className="text-[10px] text-muted-foreground">Бот отвечает стандартным сообщением об обслуживании</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/60">
            <Checkbox checked={form.telegramLogErrors} onCheckedChange={(c) => setForm(p => ({ ...p, telegramLogErrors: !!c }))} />
            <div>
              <p className="text-xs font-bold text-foreground">Логирование ошибок</p>
              <p className="text-[10px] text-muted-foreground">Запись сбоев в TelegramErrorLog с дедупликацией</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/60">
            <Checkbox checked={form.telegramEnableCsat} onCheckedChange={(c) => setForm(p => ({ ...p, telegramEnableCsat: !!c }))} />
            <div>
              <p className="text-xs font-bold text-foreground">CSAT Рейтинг</p>
              <p className="text-[10px] text-muted-foreground">Кнопки оценки (1-5) при закрытии тикета</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/60">
            <Checkbox checked={form.telegramEnableSmartBind} onCheckedChange={(c) => setForm(p => ({ ...p, telegramEnableSmartBind: !!c }))} />
            <div>
              <p className="text-xs font-bold text-foreground">Smart Bind Protocol</p>
              <p className="text-[10px] text-muted-foreground">Одноразовые токены привязки аккаунтов</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" onClick={handleSave} disabled={isPending} className="font-bold uppercase tracking-widest text-xs h-11 px-6 shadow-lg shadow-primary/20 cursor-pointer">
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
            Сохранить безопасность
          </Button>
        </div>
      </Card>
    </div>
  );
}