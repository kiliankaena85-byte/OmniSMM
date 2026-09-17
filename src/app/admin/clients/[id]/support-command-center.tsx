'use client';

/**
 * SupportCommandCenter — единая панель управления для роли SUPPORT
 * Все действия в одном экране: баланс, безопасность, заметка, заказы.
 */

import React, { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Wallet, KeyRound, FileText, Sparkles, Check, Copy,
  Link as LinkIcon, LogOut, Mail, Percent, Shield,
  TrendingUp, CreditCard, ShoppingBag, AlertCircle, Eye, EyeOff, Globe
} from 'lucide-react';
import { UserDTO, PaymentDTO, OrderDTO, LoginLogDTO } from './tabs/types';
import {
  updateClientNoteAction,
  clearClientNoteAction,
  updateClientDiscountAction,
  supportGoodwillCreditAction,
} from '@/actions/admin/clients';
import {
  SUPPORT_CREDIT_REASONS,
  SUPPORT_DEBIT_REASONS,
} from '@/lib/constants/support-reasons';
import {
  adminGenerateMagicLinkAction,
  adminChangeUserPasswordAction,
  adminRevokeUserSessionsAction,
} from '@/actions/admin/users';
import { SecurityEmailModal } from './tabs/security-email-modal';
import { SecurityLoginLogs } from './tabs/security-login-logs';
import { PaymentsTab } from './tabs/payments-tab';
import { ClientLedgerTable } from './components/client-ledger-table';
import { ClientNotesManager } from './components/client-notes-manager';
import { ClientLedgerModal } from './components/client-ledger-modal';
import { ClientPaymentsModal } from './components/client-payments-modal';
import { ClientLedgerEntryDTO, ClientLedgerSummaryDTO, UserNoteDTO } from './tabs/types';

function fmtBalance(kopecks: number | undefined): string {
  if (kopecks === undefined || kopecks === null) return '—';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency', currency: 'RUB', maximumFractionDigits: 2
  }).format(kopecks / 100);
}

interface Props {
  user: UserDTO;
  loginLogs: LoginLogDTO[];
  payments: PaymentDTO[];
  orders: OrderDTO[];
  ledgerEntries?: ClientLedgerEntryDTO[];
  ledgerSummary?: ClientLedgerSummaryDTO;
  initialNotes?: UserNoteDTO[];
}

export function SupportCommandCenter({ 
  user, 
  loginLogs, 
  payments, 
  orders, 
  ledgerEntries = [], 
  ledgerSummary = { totalDepositedRub: 0, totalSpentRub: 0, totalRefundedRub: 0, totalAdjustedRub: 0 },
  initialNotes = []
}: Props) {
  const [discount, setDiscount] = useState(user.personalDiscount || 0);
  const [isPendingDiscount, startDiscountTransition] = useTransition();

  const [adjAmount, setAdjAmount] = useState('');
  const [adjDirection, setAdjDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjReason, setAdjReason] = useState<string>(SUPPORT_CREDIT_REASONS[0]);
  const [adjComment, setAdjComment] = useState('');
  const [isPendingAdj, startAdjTransition] = useTransition();

  const [newPass, setNewPass] = useState('');
  const [showPass, setShowPass] = useState(true);
  const [copiedPass, setCopiedPass] = useState(false);
  const [copiedMagic, setCopiedMagic] = useState(false);
  const [isPendingPass, startPassTransition] = useTransition();
  const [isPendingMagic, startMagicTransition] = useTransition();
  const [isPendingRevoke, startRevokeTransition] = useTransition();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [isPaymentsModalOpen, setIsPaymentsModalOpen] = useState(false);

  const currentBalanceRub = (user.balance ?? 0) / 100;

  function generatePass() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
    const p = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setNewPass(p);
    setShowPass(true);
  }

  function handleDirectionChange(d: 'CREDIT' | 'DEBIT') {
    setAdjDirection(d);
    setAdjReason(d === 'CREDIT' ? SUPPORT_CREDIT_REASONS[0] : SUPPORT_DEBIT_REASONS[0]);
  }

  function saveDiscount() {
    startDiscountTransition(async () => {
      const r = await updateClientDiscountAction(user.id, discount);
      if (r.success) toast.success(`Скидка ${discount}% применена`);
      else toast.error(r.error ?? 'Ошибка');
    });
  }

  function applyAdj() {
    const amount = parseFloat(adjAmount);
    if (!adjAmount || isNaN(amount) || amount <= 0) {
      toast.error('Укажите корректную сумму');
      return;
    }

    if (adjDirection === 'DEBIT' && amount > currentBalanceRub) {
      toast.error(`Невозможно списать больше текущего баланса (${currentBalanceRub.toLocaleString('ru-RU')} ₽)`);
      return;
    }

    startAdjTransition(async () => {
      const fd = new FormData();
      fd.set('userId', user.id);
      fd.set('amount', adjAmount);
      fd.set('direction', adjDirection);
      fd.set('reason', adjReason);
      fd.set('comment', adjComment);
      const r = await supportGoodwillCreditAction(fd);
      if (r.success) {
        if ('pendingApproval' in r && r.pendingApproval) {
          toast.info(r.message || 'Заявка отправлена администратору на согласование');
        } else {
          toast.success(r.message || `${adjDirection === 'CREDIT' ? 'Начислено' : 'Списано'} ${amount} ₽`);
        }
        setAdjAmount('');
        setAdjComment('');
      } else {
        toast.error((r as { error?: string }).error ?? 'Ошибка операции');
      }
    });
  }

  function handleMagic() {
    startMagicTransition(async () => {
      const res = await adminGenerateMagicLinkAction(user.id);
      if (res.success && res.magicUrl) {
        await navigator.clipboard.writeText(`${window.location.origin}${res.magicUrl}`);
        setCopiedMagic(true);
        toast.success('Magic-ссылка скопирована (15 мин)');
        setTimeout(() => setCopiedMagic(false), 3000);
      } else toast.error(res.error || 'Ошибка');
    });
  }

  function handleSetPass() {
    if (!newPass || newPass.length < 8) { toast.error('Минимум 8 символов'); return; }
    startPassTransition(async () => {
      const r = await adminChangeUserPasswordAction(user.id, newPass);
      if (r.success) { 
        toast.success('Пароль установлен, сессии сброшены'); 
      }
      else toast.error(r.error ?? 'Ошибка');
    });
  }

  function handleRevoke() {
    if (!confirm('Завершить все активные сессии клиента?')) return;
    startRevokeTransition(async () => {
      const r = await adminRevokeUserSessionsAction(user.id);
      if (r.success) toast.success(r.message); else toast.error(r.error || 'Ошибка');
    });
  }

  const lastLog = loginLogs[0];

  const currentReasons = adjDirection === 'CREDIT' ? SUPPORT_CREDIT_REASONS : SUPPORT_DEBIT_REASONS;

  const statusCls = (s: string) =>
    s === 'COMPLETED' ? 'bg-success/10 text-success' :
    s === 'IN_PROGRESS' ? 'bg-primary/10 text-primary' :
    (s === 'FAILED' || s === 'CANCELLED') ? 'bg-destructive/10 text-destructive' :
    'bg-muted text-muted-foreground';

  return (
    <div className="space-y-5">
      {/* Основная сетка 3 колонки */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Колонка 1: Баланс */}
        <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl p-5 ring-1 ring-border/5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              <span className="bg-primary/10 text-primary p-1 rounded-md"><Wallet className="w-3.5 h-3.5" /></span>
              Баланс и операции
            </h3>
            <span className="text-xs font-bold font-mono text-success">
              {currentBalanceRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
            </span>
          </div>

          <div className="flex gap-2">
            {(['CREDIT', 'DEBIT'] as const).map(d => (
              <button key={d} type="button" onClick={() => handleDirectionChange(d)}
                className={`flex-1 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  adjDirection === d
                    ? d === 'CREDIT' ? 'bg-success text-success-foreground border-success' : 'bg-destructive text-destructive-foreground border-destructive'
                    : 'bg-muted text-muted-foreground border-border/50 hover:bg-muted/80'
                }`}>{d === 'CREDIT' ? '+ Начислить' : '− Списать'}</button>
            ))}
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">
              {adjDirection === 'CREDIT' ? 'Сумма начисления (₽)' : `Сумма списания (₽, макс ${currentBalanceRub.toFixed(0)} ₽)`}
            </label>
            <input type="number" min="1" max={adjDirection === 'DEBIT' ? currentBalanceRub : undefined} step="0.01" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} placeholder="100.00"
              className="w-full h-9 px-3 text-sm font-mono rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground outline-none focus:border-primary" />
            {adjDirection === 'CREDIT' && (
              <p className="text-[10px] text-muted-foreground mt-1">
                ⚡ Мгновенно до 2 000 ₽. Суммы выше создадут заявку администратору.
              </p>
            )}
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">Причина ({adjDirection === 'CREDIT' ? 'начисления' : 'списания'})</label>
            <select value={adjReason} onChange={e => setAdjReason(e.target.value)}
              className="w-full h-9 px-3 text-xs rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground outline-none focus:border-primary cursor-pointer">
              {currentReasons.map((r: string) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">Комментарий (опц.)</label>
            <input type="text" value={adjComment} onChange={e => setAdjComment(e.target.value)} placeholder="Детали..."
              className="w-full h-9 px-3 text-xs rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground outline-none focus:border-primary" />
          </div>
          <button type="button" onClick={applyAdj} disabled={isPendingAdj || !adjAmount}
            className={`w-full h-9 rounded-xl text-xs font-bold shadow-xs hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer ${
              adjDirection === 'CREDIT' ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'
            }`}>
            {isPendingAdj ? 'Обработка...' : `${adjDirection === 'CREDIT' ? 'Начислить' : 'Списать'}${adjAmount ? ' ' + adjAmount + ' ₽' : ''}`}
          </button>

          <div className="pt-3 border-t border-border/40 space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
              <Percent className="w-3 h-3" /> Персональная скидка
            </label>
            <div className="flex gap-2">
              <input type="number" min={0} max={50} step={1} value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-20 h-9 px-2.5 text-xs font-mono rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground outline-none focus:border-primary" />
              <span className="self-center text-xs text-muted-foreground">%</span>
              <button type="button" onClick={saveDiscount} disabled={isPendingDiscount}
                className="flex-1 h-9 rounded-xl text-xs font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer">
                {isPendingDiscount ? '...' : 'Применить'}
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <button 
              type="button" 
              onClick={() => setIsLedgerModalOpen(true)}
              className="w-full h-9 rounded-xl text-xs font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 active:scale-98 transition-all flex items-center justify-between px-3 cursor-pointer shadow-2xs"
            >
              <span className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-primary" />
                <span>Книга транзакций Ledger</span>
              </span>
              <span className="text-[10px] font-mono font-bold bg-primary/20 px-1.5 py-0.5 rounded text-primary">
                {ledgerEntries.length} операций ↗
              </span>
            </button>
            <button 
              type="button" 
              onClick={() => setIsPaymentsModalOpen(true)}
              className="w-full h-9 rounded-xl text-xs font-bold bg-muted text-foreground border border-border/60 hover:bg-muted/80 active:scale-98 transition-all flex items-center justify-between px-3 cursor-pointer shadow-2xs"
            >
              <span className="flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Платежи эквайринга</span>
              </span>
              <span className="text-[10px] font-mono font-bold bg-muted-foreground/15 px-1.5 py-0.5 rounded text-muted-foreground">
                {payments.length} пополнений ↗
              </span>
            </button>
          </div>
        </div>

        {/* Колонка 2: Безопасность */}
        <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl p-5 ring-1 ring-border/5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              <span className="bg-primary/10 text-primary p-1 rounded-md"><Shield className="w-3.5 h-3.5" /></span>
              Безопасность и доступ
            </h3>
            {lastLog && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-lg">
                <Globe className="w-3 h-3" /> {lastLog.ipAddress}
              </span>
            )}
          </div>

          <button type="button" onClick={handleMagic} disabled={isPendingMagic}
            className="w-full h-9 rounded-xl text-xs font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
            {copiedMagic ? <Check className="w-3.5 h-3.5 text-success" /> : <LinkIcon className="w-3.5 h-3.5" />}
            {isPendingMagic ? 'Генерация...' : copiedMagic ? 'Скопировано!' : 'Magic Link (15 мин)'}
          </button>

          <button type="button" onClick={() => setShowEmailModal(true)}
            className="w-full h-9 rounded-xl text-xs font-bold bg-muted text-foreground border border-border/60 hover:bg-muted/80 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer">
            <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Исправить Email клиента
          </button>

          <button type="button" onClick={handleRevoke} disabled={isPendingRevoke}
            className="w-full h-9 rounded-xl text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
            <LogOut className="w-3.5 h-3.5" />
            {isPendingRevoke ? 'Сброс...' : 'Завершить все сессии'}
          </button>

          <div className="pt-3 border-t border-border/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
                <KeyRound className="w-3 h-3" /> Новый пароль
              </label>
              <button type="button" onClick={generatePass}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-lg transition-all cursor-pointer">
                <Sparkles className="w-3 h-3" /> Сгенерировать
              </button>
            </div>
            <div className="relative flex items-center">
              <input type={showPass ? "text" : "password"} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Введите пароль..."
                className="w-full h-9 text-xs pl-3 pr-16 rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground font-mono outline-none focus:border-primary" />
              <div className="absolute right-1.5 flex items-center gap-1">
                {newPass && (
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title={showPass ? "Скрыть" : "Показать"}>
                    {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
                {newPass && (
                  <button type="button" onClick={async () => { await navigator.clipboard.writeText(newPass); setCopiedPass(true); toast.success('Пароль скопирован'); setTimeout(() => setCopiedPass(false), 2000); }}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="Скопировать пароль">
                    {copiedPass ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
            <button type="button" onClick={handleSetPass} disabled={isPendingPass || !newPass}
              className="w-full h-9 rounded-xl text-xs font-bold bg-warning text-warning-foreground shadow-xs hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer">
              {isPendingPass ? 'Сохранение...' : 'Установить пароль клиенту'}
            </button>
          </div>

          <div className="pt-3 border-t border-border/40">
            <SecurityLoginLogs loginLogs={loginLogs} />
          </div>
        </div>

        {/* Колонка 3: Заметки оператора + Заказы */}
        <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl p-5 ring-1 ring-border/5 space-y-4">
          <ClientNotesManager
            userId={user.id}
            initialNotes={initialNotes}
            compact={true}
          />

          <div className="pt-3 border-t border-border/40 space-y-2">
            <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground">
              <ShoppingBag className="w-3 h-3" /> Последние заказы
            </div>
            {orders.slice(0, 5).map(o => (
              <div key={o.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/30 last:border-0">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground truncate max-w-[155px]">#{o.numericId} {o.serviceName}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(o.createdAt).toLocaleDateString('ru-RU')}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold font-mono text-foreground">{o.chargeRub.toFixed(0)} ₽</div>
                  <div className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${statusCls(o.status)}`}>{o.status}</div>
                </div>
              </div>
            ))}
            {user.ordersCount > 5 && (
              <a href={`/admin/orders?userId=${user.id}`} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Все {user.ordersCount} заказов →
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Hoisted Fullscreen Modals */}
      <ClientLedgerModal
        isOpen={isLedgerModalOpen}
        onClose={() => setIsLedgerModalOpen(false)}
        user={user}
        entries={ledgerEntries}
        summary={ledgerSummary}
      />

      <ClientPaymentsModal
        isOpen={isPaymentsModalOpen}
        onClose={() => setIsPaymentsModalOpen(false)}
        user={user}
        payments={payments}
        totalDepositedRub={ledgerSummary.totalDepositedRub}
      />

      <SecurityEmailModal user={user} isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} />
    </div>
  );
}
