'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { toast } from 'sonner';
import {
  getUserLedgerAuditAction,
  reconcileUserAction,
} from '@/actions/admin/finance/reconciliation';
import type { UserAuditTimelineDTO } from '@/services/financial/ledger-reconciliation.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LEDGER_TYPE_CONFIG, resolveLedgerTypeForDisplay } from '@/lib/financial/ledger-types';
import { Textarea } from '@/components/ui/textarea';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Lock,
  Wrench,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface LedgerAuditDrawerProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRemediationComplete?: () => void;
}

function fmt(cents: number, showSign = false): string {
  const sign = showSign && cents > 0 ? '+' : '';
  return `${sign}${(cents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
}

const LEDGER_STATUS_BADGES: Record<string, { label: string; className: string }> = {
  APPROVED:   { label: 'Одобрено',  className: 'bg-success/15 text-success border-success/20' },
  QUARANTINE: { label: 'Карантин',  className: 'bg-warning/15 text-warning border-warning/20' },
  REJECTED:   { label: 'Отклонено', className: 'bg-destructive/15 text-destructive border-destructive/20' },
};

export function LedgerAuditDrawer({
  userId,
  isOpen,
  onClose,
  onRemediationComplete,
}: LedgerAuditDrawerProps) {
  const [data, setData] = useState<UserAuditTimelineDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Remediation states
  const [showLockPrompt, setShowLockPrompt] = useState(false);
  const [showAdjustPrompt, setShowAdjustPrompt] = useState(false);
  const [reasonInput, setReasonInput] = useState('');

  const loadData = useCallback(async (uid: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getUserLedgerAuditAction(uid);
      if ('error' in res) {
        setError(res.error);
        toast.error(res.error);
      } else {
        setData(res);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка загрузки данных аудита';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && userId) {
      loadData(userId);
      setShowLockPrompt(false);
      setShowAdjustPrompt(false);
      setReasonInput('');
    } else {
      setData(null);
    }
  }, [isOpen, userId, loadData]);

  if (!isOpen || !userId) return null;

  const handleCopyId = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  const handleRemediate = (action: 'LOCK' | 'AUTO_ADJUST') => {
    if (!userId) return;
    startTransition(async () => {
      try {
        const res = await reconcileUserAction(userId, action, reasonInput.trim() || undefined);
        if ('error' in res || !res.success) {
          toast.error('error' in res ? res.error : res.message);
        } else {
          toast.success(res.message);
          setShowLockPrompt(false);
          setShowAdjustPrompt(false);
          setReasonInput('');
          await loadData(userId);
          onRemediationComplete?.();
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Ошибка выполнения операции');
      }
    });
  };

  const user = data?.user;
  const discrepancy = data?.discrepancy ?? 0;
  const isDiscrepancy = data?.isDiscrepancy ?? false;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-xs transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-drawer-title"
    >
      <div className="w-full max-w-2xl bg-card border-l border-border h-full flex flex-col justify-between shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
        
        {/* ── Header ── */}
        <div className="p-6 border-b border-border/80 bg-muted/20 flex items-center justify-between shrink-0">
          <div className="space-y-1 min-w-0 flex-1 mr-4">
            <div className="flex items-center gap-2">
              <h2 id="audit-drawer-title" className="text-lg font-bold text-foreground truncate tracking-tight">
                Финансовый аудит аккаунта
              </h2>
              {user && (
                <Badge
                  intent="outline"
                  className={user.isActive ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20'}
                >
                  {user.isActive ? 'Активен' : 'Заблокирован'}
                </Badge>
              )}
            </div>
            {user && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono font-medium text-foreground truncate">{user.email}</span>
                <span className="opacity-40">•</span>
                <button
                  onClick={() => handleCopyId(user.id)}
                  className="inline-flex items-center gap-1 min-h-[36px] font-mono text-[10px] text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                  title="Копировать ID пользователя"
                  type="button"
                >
                  <span>ID: {user.id.slice(0, 8)}...</span>
                  {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>

          <Button
            intent="ghost"
            size="sm"
            onClick={onClose}
            className="w-10 h-10 min-h-[40px] rounded-full p-0 shrink-0 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            aria-label="Закрыть панель аудита"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* ── Body Content ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Восстановление хронологии проводок...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>Ошибка загрузки</span>
              </div>
              <p className="text-xs">{error}</p>
              <Button
                intent="outline"
                size="sm"
                onClick={() => userId && loadData(userId)}
                className="mt-2 min-h-[36px]"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Повторить
              </Button>
            </div>
          ) : data && user ? (
            <>
              {/* ── Status Banner & Key Numbers ── */}
              <div className={`p-5 rounded-2xl border transition-all ${
                isDiscrepancy
                  ? 'bg-destructive/10 border-destructive/20 text-destructive'
                  : 'bg-success/10 border-success/20 text-success'
              }`}>
                <div className="flex items-start gap-3">
                  {isDiscrepancy ? (
                    <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldCheck className="w-6 h-6 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 flex-1">
                    <h3 className="text-sm font-bold tracking-tight">
                      {isDiscrepancy
                        ? 'Обнаружено нарушение финансового инварианта!'
                        : 'Финансовый инвариант соблюдён'}
                    </h3>
                    <p className="text-xs text-foreground/80 leading-relaxed font-medium">
                      {isDiscrepancy
                        ? `Сумма проводок Ledger отличается от текущего баланса User на ${fmt(Math.abs(discrepancy))}.`
                        : 'Баланс кошелька пользователя строго соответствует сумме подтверждённых проводок.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Balance Breakdown Grid ── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl border border-border/80 bg-card space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Баланс (User)
                  </span>
                  <div className="text-base font-black font-mono tabular-nums text-foreground">
                    {fmt(user.balance)}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border/80 bg-card space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Сумма Ledger
                  </span>
                  <div className="text-base font-black font-mono tabular-nums text-foreground">
                    {fmt(user.balance - discrepancy)}
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1 p-4 rounded-xl border border-border/80 bg-card space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Расхождение
                  </span>
                  <div className={`text-base font-black font-mono tabular-nums ${
                    isDiscrepancy ? 'text-destructive' : 'text-success'
                  }`}>
                    {fmt(discrepancy, true)}
                  </div>
                </div>
              </div>

              {user.quarantineBalance > 0 && (
                <div className="p-4 rounded-xl border border-warning/20 bg-warning/10 text-warning flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Средства в карантине (Escrow):</span>
                  </div>
                  <span className="font-mono font-bold tabular-nums text-foreground">
                    {fmt(user.quarantineBalance)}
                  </span>
                </div>
              )}

              {/* ── Remediation Controls ── */}
              {isDiscrepancy && (
                <div className="p-5 rounded-2xl border border-border bg-muted/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Действия по устранению (Remediation)
                    </span>
                  </div>

                  {showLockPrompt ? (
                    <div className="space-y-3 p-4 rounded-xl border border-destructive/20 bg-destructive/5 animate-in fade-in duration-200">
                      <p className="text-xs font-semibold text-destructive">
                        Подтвердите блокировку аккаунта {user.email}:
                      </p>
                      <Textarea
                        rows={2}
                        placeholder="Укажите обоснование блокировки..."
                        value={reasonInput}
                        onChange={(e) => setReasonInput(e.target.value)}
                        className="text-xs bg-background"
                      />
                      <div className="flex gap-2">
                        <Button
                          intent="destructive"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleRemediate('LOCK')}
                          className="flex-1 min-h-[36px] font-bold text-xs"
                        >
                          {isPending ? 'Блокировка...' : 'Подтвердить блокировку'}
                        </Button>
                        <Button
                          intent="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => setShowLockPrompt(false)}
                          className="min-h-[36px] text-xs"
                        >
                          Отмена
                        </Button>
                      </div>
                    </div>
                  ) : showAdjustPrompt ? (
                    <div className="space-y-3 p-4 rounded-xl border border-primary/20 bg-primary/5 animate-in fade-in duration-200">
                      <p className="text-xs font-semibold text-foreground">
                        Авто-выравнивание: создать компенсирующую проводку на {fmt(discrepancy, true)}
                      </p>
                      <Textarea
                        rows={2}
                        placeholder="Обоснование автоматической корректировки..."
                        value={reasonInput}
                        onChange={(e) => setReasonInput(e.target.value)}
                        className="text-xs bg-background"
                      />
                      <div className="flex gap-2">
                        <Button
                          intent="primary"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleRemediate('AUTO_ADJUST')}
                          className="flex-1 min-h-[36px] font-bold text-xs"
                        >
                          {isPending ? 'Выравнивание...' : 'Применить корректировку'}
                        </Button>
                        <Button
                          intent="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => setShowAdjustPrompt(false)}
                          className="min-h-[36px] text-xs"
                        >
                          Отмена
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        intent="primary"
                        size="sm"
                        onClick={() => setShowAdjustPrompt(true)}
                        className="flex-1 min-h-[40px] font-bold text-xs"
                      >
                        <Wrench className="w-4 h-4 mr-1.5" />
                        Авто-выравнивание баланса
                      </Button>
                      {user.isActive && (
                        <Button
                          intent="destructive"
                          size="sm"
                          onClick={() => setShowLockPrompt(true)}
                          className="min-h-[40px] font-bold text-xs"
                        >
                          <Lock className="w-4 h-4 mr-1.5" />
                          Заблокировать
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Transaction Timeline ── */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Хронология транзакций ({data.entries.length})
                  </h4>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Сортировка: новые сверху
                  </span>
                </div>

                {data.entries.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-border rounded-2xl text-muted-foreground text-xs font-medium">
                    Проводок в реестре не найдено.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.entries.map((entry, idx) => {
                      const isPositive = entry.amount >= 0;
                      const badgeInfo = LEDGER_STATUS_BADGES[entry.status] || {
                        label: entry.status,
                        className: 'bg-muted text-muted-foreground',
                      };

                      return (
                        <div
                          key={entry.id || idx}
                          className="p-4 rounded-xl border border-border/80 bg-card hover:border-border transition-all space-y-2.5"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-black font-mono tabular-nums ${
                                  isPositive ? 'text-success' : 'text-destructive'
                                }`}>
                                  {fmt(entry.amount, true)}
                                </span>
                                {(() => {
                                  const resolvedType = resolveLedgerTypeForDisplay(entry.transactionType, entry.amount, entry.adminId);
                                  const cfg = LEDGER_TYPE_CONFIG[resolvedType] || LEDGER_TYPE_CONFIG.TOPUP;
                                  return (
                                    <Badge intent="outline" className={`text-[9px] font-bold px-1.5 py-0 h-4 rounded ${cfg.badgeClass}`}>
                                      {cfg.emoji} {cfg.label}
                                    </Badge>
                                  );
                                })()}
                                <Badge
                                  intent="outline"
                                  className={`text-[9px] font-bold uppercase px-1.5 py-0 h-4 rounded ${badgeInfo.className}`}
                                >
                                  {badgeInfo.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-foreground font-medium leading-relaxed">
                                {entry.reason}
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                                Баланс после:
                              </span>
                              <span className="text-xs font-bold font-mono tabular-nums text-foreground">
                                {fmt(entry.runningBalance)}
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-2 border-t border-border/40 font-mono">
                            <span>
                              {new Date(entry.createdAt).toLocaleString('ru-RU', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </span>
                            <span>
                              {entry.adminId ? `👤 Админ (${entry.adminId.slice(0, 6)})` : '⚙️ Система'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* ── Footer ── */}
        <div className="p-4 border-t border-border/80 bg-muted/20 flex justify-end shrink-0">
          <Button
            intent="outline"
            size="sm"
            onClick={onClose}
            className="min-h-[40px] px-6 font-bold text-xs"
          >
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}
