'use client';

import React, { useState } from 'react';
import { AlfaBankAccountBalance } from '@/services/financial/bank-integrations/alfa-bank.service';
import { Building2, RefreshCw, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  bankAccount?: AlfaBankAccountBalance;
  bankRub: number;
  isSyncingBank: boolean;
  onSync: () => void;
}

export function AlfaBankStatusCard({
  bankAccount,
  bankRub,
  isSyncingBank,
  onSync,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopyAccount = () => {
    if (!bankAccount?.maskedAccountNumber) {
      toast.error('Номер счета не настроен');
      return;
    }
    const acc = bankAccount.maskedAccountNumber;
    navigator.clipboard.writeText(acc);
    setCopied(true);
    toast.info(`Номер счета ${acc} скопирован`);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderStatusBadge = () => {
    if (!bankAccount) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
          <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
          Не синхронизировано / Ошибка связи
        </span>
      );
    }

    if (bankAccount.isSandbox) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Sandbox Mock (Эмулятор)
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live Open API
      </span>
    );
  };

  return (
    <div className="bg-card border border-border p-4 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-foreground">Альфа-Банк для Бизнеса (Alfa Developer Hub)</span>
            {renderStatusBadge()}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {bankAccount ? (
              <button
                onClick={handleCopyAccount}
                className="hover:text-foreground inline-flex items-center gap-1 transition-colors cursor-pointer"
                title="Скопировать маскированный счет"
              >
                <span>Счет: <strong className="font-mono text-foreground">{bankAccount.maskedAccountNumber}</strong></span>
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
              </button>
            ) : (
              <span className="text-muted-foreground">Счет: <span className="font-mono text-foreground">Не подключен</span></span>
            )}
            <span>•</span>
            <span>Баланс: <strong className="font-mono text-foreground">{bankRub.toLocaleString('ru-RU')} ₽</strong></span>
            <span>•</span>
            <span>
              Синхронизировано: {bankAccount?.lastSyncedAt ? new Date(bankAccount.lastSyncedAt).toLocaleTimeString('ru-RU') : 'Нет данных'}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={onSync}
        disabled={isSyncingBank}
        className="px-3.5 py-2 bg-red-600/10 text-red-600 dark:text-red-400 hover:bg-red-600/20 border border-red-600/30 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBank ? 'animate-spin' : ''}`} />
        {isSyncingBank ? 'Синхронизация...' : 'Синхронизировать с Альфа-Банком'}
      </button>
    </div>
  );
}
