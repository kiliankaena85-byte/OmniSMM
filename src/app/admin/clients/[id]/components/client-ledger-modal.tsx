'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, BookOpen, User, Wallet, ArrowUpRight } from 'lucide-react';
import { ClientLedgerEntryDTO, ClientLedgerSummaryDTO, UserDTO } from '../tabs/types';
import { ClientLedgerTable } from './client-ledger-table';
import { formatBalance } from '@/lib/utils';

interface ClientLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserDTO;
  entries: ClientLedgerEntryDTO[];
  summary: ClientLedgerSummaryDTO;
}

export function ClientLedgerModal({
  isOpen,
  onClose,
  user,
  entries,
  summary,
}: ClientLedgerModalProps) {
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Prevent body background scrolling when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentBalanceRub = ((user.balance ?? 0) / 100).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 md:p-8 animate-in fade-in duration-200">
      {/* Dark Blur Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity cursor-pointer"
        aria-hidden="true"
      />

      {/* Main Full-Width Dialog Card */}
      <div className="relative w-full max-w-6xl max-h-[92vh] bg-card border border-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border/60 bg-muted/25 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base font-bold text-foreground tracking-tight">
                  Книга транзакций Ledger
                </h2>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  {user.email}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 font-medium">
                <span className="flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Текущий баланс:</span>
                  <b className="text-emerald-700 dark:text-emerald-400 font-mono">{currentBalanceRub} ₽</b>
                </span>
                <span>•</span>
                <span className="font-mono">ID: {user.id}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              aria-label="Закрыть окно"
              className="px-3 py-1.5 rounded-xl border border-border/60 bg-card hover:bg-muted text-foreground flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
            >
              <span>Закрыть</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border border-border/60 text-muted-foreground">
                Esc
              </kbd>
              <X className="w-4 h-4 text-muted-foreground ml-0.5" />
            </button>
          </div>
        </div>

        {/* Modal Body (Scrollable Table & Metrics) */}
        <div className="flex-1 overflow-y-auto p-6 bg-card/60">
          <ClientLedgerTable
            userId={user.id}
            initialEntries={entries}
            initialSummary={summary}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-border/60 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Все финансовые записи синхронизированы с базой данных Ledger</span>
          </div>
          <button
            onClick={onClose}
            className="text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            Вернуться в карточку клиента →
          </button>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
