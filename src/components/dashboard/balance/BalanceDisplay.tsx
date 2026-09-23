'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { RotateCw, Wallet } from 'lucide-react';
import { useUserBalance } from '@/hooks/use-user-balance';

interface BalanceDisplayProps {
  initialBalance: string;
  variant: 'sidebar' | 'mobile-header';
}

export function BalanceDisplay({ initialBalance, variant }: BalanceDisplayProps) {
  const { balance, isRefreshing, refreshBalance } = useUserBalance(initialBalance);
  const [pollCount, setPollCount] = useState(0);

  // Set up short-term polling if user manually refreshes, to catch delayed payment webhooks
  useEffect(() => {
    if (pollCount <= 0) return;

    const timer = setTimeout(() => {
      refreshBalance(true);
      setPollCount((prev) => prev - 1);
    }, 10000); // poll every 10 seconds

    return () => clearTimeout(timer);
  }, [pollCount, refreshBalance]);

  const handleManualClick = () => {
    refreshBalance(false);
    // Start polling for 12 cycles (2 minutes total) to capture the webhook
    setPollCount(12);
  };

  if (variant === 'mobile-header') {
    return (
      <div className="flex items-center gap-1 sm:gap-1.5 text-foreground shrink-0 select-none bg-secondary/80 px-2 sm:px-2.5 py-1 rounded-xl border border-border/60">
        <span className="text-[11px] sm:text-xs font-black font-mono tabular-nums tracking-tight sm:tracking-wide truncate max-w-[95px] sm:max-w-none" title={balance}>{balance}</span>
        <button
          onClick={handleManualClick}
          className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-90 cursor-pointer shrink-0"
          title="Обновить баланс"
          aria-label="Обновить баланс"
          disabled={isRefreshing}
        >
          <RotateCw className={`w-3.5 h-3.5 transition-transform duration-500 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-card/85 backdrop-blur-xl border border-border/80 shadow-md relative overflow-hidden group">
      {/* Soft background glow */}
      <div className="absolute -top-6 -right-6 w-20 h-20 bg-primary/10 rounded-full blur-xl pointer-events-none" />
      
      <div className="flex justify-between items-center mb-1.5 relative z-10">
        <span className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider">
          Текущий баланс
        </span>
        <button
          onClick={handleManualClick}
          className="p-1 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-200 active:scale-90 cursor-pointer"
          title="Обновить баланс"
          aria-label="Обновить баланс"
          disabled={isRefreshing}
        >
          <RotateCw className={`w-3.5 h-3.5 transition-transform duration-500 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
        </button>
      </div>
      
      <div className="text-xl font-black font-mono tracking-tight text-foreground mb-3 relative z-10">
        {balance}
      </div>

      <Link
        href="/dashboard/add-funds"
        className="w-full flex items-center justify-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-xl py-2 shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer relative z-10"
      >
        <Wallet className="w-3.5 h-3.5" />
        <span>Пополнить баланс</span>
      </Link>
    </div>
  );
}
