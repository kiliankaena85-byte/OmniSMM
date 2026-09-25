'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Unlink, ShieldCheck, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { getTenantFallbackBranding } from '@/lib/tenant-branding';
import type { BotTestResult } from './types';

interface GeneralTelegramBotSectionProps {
  tenantId: string;
  telegramBot: string;
  setTelegramBot: (v: string) => void;
  telegramBotToken: string;
  setTelegramBotToken: (v: string) => void;
  telegramChannel: string;
  setTelegramChannel: (v: string) => void;
  hasExistingToken: boolean;
  isDisconnectBotModalOpen: boolean;
  setIsDisconnectBotModalOpen: (v: boolean) => void;
  isDisconnectingBot: boolean;
  handleDisconnectBot: () => void;
  isTestingBot: boolean;
  botTestResult: BotTestResult | null;
  handleTestBot: () => Promise<void>;
}

export function GeneralTelegramBotSection({
  tenantId,
  telegramBot,
  setTelegramBot,
  telegramBotToken,
  setTelegramBotToken,
  telegramChannel,
  setTelegramChannel,
  hasExistingToken,
  isDisconnectBotModalOpen,
  setIsDisconnectBotModalOpen,
  isDisconnectingBot,
  handleDisconnectBot,
  isTestingBot,
  botTestResult,
  handleTestBot,
}: GeneralTelegramBotSectionProps) {
  const branding = getTenantFallbackBranding(tenantId);

  return (
    <Card className="rounded-3xl border border-border/60 shadow-lg bg-card/70 backdrop-blur-xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl border border-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">Telegram Бот Поддержки</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {branding.name}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Прием сообщений от клиентов из Telegram и отправка ответов операторов из единой админки.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {telegramBot && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDisconnectBotModalOpen(true)}
              disabled={isDisconnectingBot}
              className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-500/30 gap-1.5 h-9"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Отвязать бота</span>
            </Button>
          )}
          <Button
            type="button"
            onClick={handleTestBot}
            disabled={isTestingBot}
            className="text-xs font-bold gap-2 cursor-pointer shrink-0 h-9 px-3.5 border border-border bg-muted/40 hover:bg-muted text-foreground"
          >
            {isTestingBot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />}
            <span>Проверить статус API</span>
          </Button>
        </div>
      </div>

      {/* Bot Disconnect Confirmation Dialog */}
      <Dialog open={isDisconnectBotModalOpen} onOpenChange={setIsDisconnectBotModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <div className="flex items-center gap-3 text-rose-500 pb-2">
              <AlertTriangle className="w-6 h-6" />
              <DialogTitle className="text-lg font-bold">Отвязать Telegram-бота?</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Вы уверены, что хотите отвязать бота <strong className="text-foreground">@{telegramBot}</strong> от бренда <strong className="text-foreground">{branding.name}</strong>?
              <br /><br />
              ⚠️ Клиенты сайта <strong className="text-foreground">{branding.domain}</strong> потеряют возможность обращаться в поддержку через Telegram, пока не будет подключен новый бот. Настройки других брендов затронуты не будут.
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
              onClick={handleDisconnectBot}
              disabled={isDisconnectingBot}
              className="font-bold gap-1.5"
            >
              {isDisconnectingBot ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Отвязать бота
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Юзернейм бота (без @)
          </Label>
          <Input
            name="contactTelegramBot"
            value={telegramBot}
            onChange={(e) => setTelegramBot(e.target.value)}
            placeholder={branding.bot || `${tenantId}_support_bot`}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            {telegramBot ? (
              <>Клиенты на сайте видят ссылку <span className="font-mono text-primary font-bold">t.me/{telegramBot}</span></>
            ) : (
              <span className="text-amber-500/90 font-medium">⚠️ Бот не указан: ссылка на Telegram в шапке сайта будет скрыта</span>
            )}
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Официальный Telegram-канал
          </Label>
          <Input
            name="contactTelegramChannel"
            value={telegramChannel}
            onChange={(e) => setTelegramChannel(e.target.value)}
            placeholder={`@${branding.name.toLowerCase()}_news`}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            Канал для новостей и акций бренда, отображаемый в футере и виджетах.
          </p>
        </div>
      </div>

      {/* Telegram Bot Token Input Field (AES-256 Vault) */}
      <div className="space-y-2 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Токен Telegram Бота (API Token)
          </Label>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            AES-256-GCM Vault
          </span>
        </div>
        <Input
          name="telegramBotToken"
          type="password"
          value={telegramBotToken}
          onChange={(e) => setTelegramBotToken(e.target.value)}
          placeholder={hasExistingToken ? '••••••••••••••••' : 'Вставьте токен от @BotFather (например: 123456:ABC-DEF...)'}
          className="font-mono text-xs"
          autoComplete="new-password"
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <p>
            Токен шифруется в защищенном хранилище БД (Vault) и имеет приоритет над переменными окружения.
          </p>
          <a
            href="/admin/settings?tab=telegram"
            className="text-primary hover:underline font-bold inline-flex items-center gap-1 shrink-0"
          >
            <span>Центр управления ботом (меню, CSAT, конструктор) →</span>
          </a>
        </div>
      </div>

      {/* Bot Status & Link Preview */}
      <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 flex items-center justify-between text-xs min-h-[46px]">
        {telegramBot ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-foreground font-mono">@{telegramBot}</span>
              {hasExistingToken && (
                <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Токен сохранен
                </span>
              )}
            </div>
            <a
              href={`https://t.me/${telegramBot}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-bold text-[11px] flex items-center gap-1"
            >
              Открыть в Telegram ↗
            </a>
          </>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground font-medium">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
            <span>Бот не привязан к {tenantId === 'flux' ? 'SMMflux' : 'SMMplan'}</span>
          </div>
        )}
      </div>

      {/* Live Diagnostics Card */}
      {botTestResult && (
        <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
          botTestResult.success 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : 'bg-destructive/10 border-destructive/30 text-destructive'
        }`}>
          <div className="flex items-center justify-between font-bold">
            <span>{botTestResult.success ? '✅ Telegram Bot API: Связь установлена успешно!' : '❌ Ошибка проверки Telegram Bot:'}</span>
            {botTestResult.pingMs && <span className="font-mono text-[11px]">Ping: {botTestResult.pingMs}ms</span>}
          </div>
          {botTestResult.success && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px] text-foreground">
              <div>Имя: <span className="font-bold">{botTestResult.name || '—'}</span></div>
              <div>Username: <span className="font-bold">{botTestResult.username ? `@${botTestResult.username}` : '—'}</span></div>
              <div>Bot ID: <span className="font-bold">{String(botTestResult.botId || '—')}</span></div>
            </div>
          )}
          {!botTestResult.success && (
            <p className="text-[11px] font-mono">{botTestResult.error}</p>
          )}
        </div>
      )}
    </Card>
  );
}
