'use client';
interface TelegramBindPreviewData {
  tempUserOrders?: number;
  targetEmail?: string;
  targetBalance?: number | string;
}

// audit-disable STR-002

import { useState, useTransition } from 'react';
import { ChevronRight, ChevronLeft, User, ShoppingCart, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { formatBalance } from '@/lib/utils';
import { ClientDate } from '@/components/ui/client-date';

type OrderSummary = {
  id: string;
  status: string;
  quantity: number;
  charge: number;
  createdAt: string;
  service: { name: string };
};

type PaymentSummary = {
  id: string;
  amount: number;
  status: string;
  gateway: string;
  createdAt: string;
};

export type ClientProfileData = {
  id: string;
  email: string;
  balance: number;
  totalSpent: number;
  createdAt: string;
  orders: OrderSummary[];
  payments: PaymentSummary[];
};

const ORDER_STATUS_MAP: Record<string, { label: string, color: string }> = {
  IN_PROGRESS: { label: 'В работе', color: 'text-primary bg-primary/10 border border-primary/20' },
  PENDING: { label: 'Ожидание', color: 'text-warning-text bg-warning/10 border border-warning/20' },
  COMPLETED: { label: 'Выполнен', color: 'text-success-text bg-success/10 border border-success/20' },
  CANCELED: { label: 'Отменен', color: 'text-muted-foreground bg-muted border border-border' },
  ERROR: { label: 'Ошибка', color: 'text-destructive-text bg-destructive/10 border border-destructive/20' },
};

const PAYMENT_STATUS_MAP: Record<string, { label: string, color: string }> = {
  SUCCEEDED: { label: 'Успешно', color: 'text-success-text bg-success/10 border border-success/20' },
  PENDING: { label: 'Ожидание', color: 'text-warning-text bg-warning/10 border border-warning/20' },
  CANCELED: { label: 'Отмена', color: 'text-muted-foreground bg-muted border border-border' },
};

import { requestTelegramBind, adminManualTelegramBind } from '@/actions/support/ticket';

export default function ClientProfileSidebar({ 
  user, 
  ticketId,
  supportLimitCents,
  supportSpentTodayCents,
  onClose,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isMobile,
  canSeeFinances = true
}: { 
  user: ClientProfileData; 
  ticketId: string;
  supportLimitCents?: number;
  supportSpentTodayCents?: number;
  onClose?: () => void;
  isMobile?: boolean;
  canSeeFinances?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(true);
    const [previewData, setPreviewData] = useState<TelegramBindPreviewData | null>(null);
  const [emailVal, setEmailVal] = useState('');

  if (!isOpen) {
    return (
      <div className="h-full flex items-center justify-center shrink-0 border-l border-border bg-card rounded-xl w-12 transition-all">
        <button
          onClick={() => {
            if (onClose) onClose();
            else setIsOpen(true);
          }}
          aria-label="Показать профиль клиента"
          className="min-w-[44px] min-h-[44px] rounded-full bg-muted hover:bg-primary/10 text-foreground hover:text-primary flex items-center justify-center transition-all duration-200 cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-card border-l border-border flex flex-col relative animate-in slide-in-from-right-8 duration-300 shadow-sm overflow-hidden min-w-0 min-h-0">
      {/* Profile header */}
      <div className="p-4 border-b border-border/60 bg-muted/10 relative flex flex-col items-center text-center shrink-0">
        {/* Absolute close button neatly aligned */}
        <button
          onClick={() => {
            if (onClose) onClose();
            else setIsOpen(false);
          }}
          aria-label="Скрыть панель профиля"
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-all duration-200 cursor-pointer shadow-2xs"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-2.5 text-base font-bold uppercase shadow-2xs">
          {user.email.substring(0, 2)}
        </div>
        <h3 className="font-bold text-foreground mb-1 truncate max-w-[240px] text-xs font-mono" title={user.email}>
          {user.email}
        </h3>
        {user.email.startsWith('tg_') && (
          <div className="w-full mb-3 mt-1 bg-warning/10 text-warning-text border border-warning/20 rounded-xl p-2.5 text-[10px] text-center font-medium">
            <p className="mb-2">Временный профиль. Вы можете запросить у клиента авторизацию:</p>
            <div className="mb-2">
              <button 
                disabled={isPending}
                onClick={() => {
                  console.info('[Sidebar] Request Auth Link Clicked');
                  startTransition(async () => {
                    const fd = new FormData();
                    fd.set('ticketId', ticketId);
                    await requestTelegramBind(fd);
                  });
                }}
                className="w-full py-1.5 px-2 bg-warning hover:bg-warning/90 text-primary-foreground rounded-lg font-bold transition-colors disabled:opacity-50 cursor-pointer text-xs"
              >
                {isPending ? 'Отправка...' : 'Отправить ссылку для привязки'}
              </button>
            </div>
            <div className="border-t border-amber-500/20 pt-2 text-left">
              <p className="mb-1 text-[9px] uppercase tracking-wider font-bold opacity-80">Или привязать вручную:</p>
              {!previewData ? (
                <div className="flex gap-1 mt-1">
                  <input 
                    type="email" 
                    value={emailVal}
                    onChange={(e) => setEmailVal(e.target.value)}
                    disabled={isPending}
                    placeholder="email@client.ru" 
                    className="flex-1 bg-card border border-warning/30 rounded-lg px-2 py-1 outline-none text-foreground text-[11px]" 
                  />
                  <button 
                    id="manual-bind-submit"
                    disabled={isPending}
                    onClick={() => startTransition(async () => {
                      if (!emailVal) {
                        console.warn('[Sidebar] Email field is empty');
                        return;
                      }
                      const fd = new FormData();
                      fd.set('ticketId', ticketId);
                      fd.set('targetEmail', emailVal);
                      console.info('[Sidebar] Calling adminManualTelegramBind with email:', emailVal);
                      const res = (await adminManualTelegramBind(fd)) as { preview?: boolean; data?: TelegramBindPreviewData; success?: boolean };
                      if (res && res.preview) {
                        setPreviewData(res.data || null);
                      } else if (res && res.success) {
                        setPreviewData(null);
                        setEmailVal('');
                      }
                    })}
                    className="bg-warning hover:bg-warning/90 text-primary-foreground px-2 py-1 rounded-lg font-bold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <div className="mt-1 bg-warning/20 border border-warning/40 rounded-lg p-2 text-[10px]">
                  <p className="font-bold text-warning-text mb-1">Подтвердите слияние:</p>
                  <ul className="list-disc pl-3 mb-2 text-muted-foreground space-y-0.5">
                    <li>Врем. заказов: <b>{previewData.tempUserOrders}</b></li>
                    <li>Цель: <b>{previewData.targetEmail}</b></li>
                    <li>Баланс цели: <b>{previewData.targetBalance} ₽</b></li>
                  </ul>
                  <div className="flex gap-1">
                    <button
                      disabled={isPending}
                      onClick={() => setPreviewData(null)}
                      className="flex-1 py-1 bg-muted hover:bg-muted/80 text-foreground rounded-lg font-semibold transition-colors text-center cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button
                      id="manual-bind-confirm"
                      disabled={isPending}
                      onClick={() => startTransition(async () => {
                        const fd = new FormData();
                        fd.set('ticketId', ticketId);
                        fd.set('targetEmail', previewData.targetEmail || '');
                        fd.set('confirm', 'true');
                        const res = await adminManualTelegramBind(fd);
                        if (res && res.success) {
                          setPreviewData(null);
                          setEmailVal('');
                        }
                      })}
                      className="flex-1 py-1 bg-success hover:bg-success/90 text-success-foreground rounded-lg font-bold transition-colors text-center cursor-pointer"
                    >
                      Слить
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mb-3 font-medium">
          Регистрация: <ClientDate date={user.createdAt} format="date" />
        </p>

        {/* Financial Stat Pills */}
        <div className="grid grid-cols-2 gap-2 w-full">
          <div className="bg-card rounded-xl p-2.5 border border-border/80 shadow-2xs text-left">
            <div className="text-[9px] uppercase font-black tracking-wider text-muted-foreground mb-0.5">Баланс</div>
            <div className="font-bold text-success-text text-xs tabular-nums font-mono">{canSeeFinances ? formatBalance(user.balance) : '🔒 *** ₽'}</div>
          </div>
          <div className="bg-card rounded-xl p-2.5 border border-border/80 shadow-2xs text-left">
            <div className="text-[9px] uppercase font-black tracking-wider text-muted-foreground mb-0.5">LTV</div>
            <div className="font-bold text-foreground text-xs tabular-nums font-mono">{canSeeFinances ? formatBalance(user.totalSpent) : '🔒 *** ₽'}</div>
          </div>
        </div>

        {supportLimitCents !== undefined && (() => {
          const limitCents = supportLimitCents || 0;
          const spentCents = supportSpentTodayCents || 0;
          const leftCents = Math.max(0, limitCents - spentCents);
          const spentPercent = limitCents > 0 ? (spentCents / limitCents) * 100 : 0;
          
          let colorClasses = "bg-success/5 border-success/20 text-success-text";
          let badgeText = "В норме";
          let badgeColor = "bg-success/20 text-success-text";
          
          if (spentPercent >= 90) {
            colorClasses = "bg-destructive/5 border-destructive/20 text-destructive-text";
            badgeText = "Исчерпан";
            badgeColor = "bg-destructive/20 text-destructive-text";
          } else if (spentPercent >= 50) {
            colorClasses = "bg-warning/5 border-warning/20 text-warning-text";
            badgeText = "Мало";
            badgeColor = "bg-warning/20 text-warning-text";
          }
          
          return (
            <div className={`w-full mt-2.5 p-3 border rounded-xl space-y-2 text-left transition-colors ${colorClasses}`}>
              <div className="flex justify-between items-center">
                <div className="text-[9px] font-black uppercase tracking-wider">Суточный лимит саппорта</div>
                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${badgeColor}`}>
                  {badgeText}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between leading-tight">
                  <span className="text-muted-foreground font-medium">Потрачено:</span>
                  <span className="font-bold font-mono text-foreground">{(spentCents / 100).toFixed(0)} ₽ / {(limitCents / 100).toFixed(0)} ₽</span>
                </div>
                <div className="flex justify-between leading-tight border-t border-border/50 pt-1 font-bold text-foreground">
                  <span>Доступно:</span>
                  <span className="font-mono text-success-text">{(leftCents / 100).toFixed(0)} ₽</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Brand Profile Button */}
        <Link
          href={`/admin/clients/${user.id}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Открыть профиль клиента"
          className="mt-3 w-full min-h-[42px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground border border-primary/20 shadow-xs hover:shadow active:scale-98 transition-all duration-200 cursor-pointer select-none tracking-wide"
        >
          <User className="w-4 h-4 shrink-0" /> 
          <span>В профиль клиента →</span>
        </Link>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-6">
        
        {/* Последние заказы */}
        <div>
           <div className="flex items-center justify-between mb-3 px-1">
             <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
               <ShoppingCart className="w-3.5 h-3.5" /> Заказы (последние 3)
             </h4>
           </div>
           
           <div className="space-y-2">
             {user.orders.map(order => {
               const st = ORDER_STATUS_MAP[order.status] || { label: order.status, color: 'text-muted-foreground bg-muted border border-border' };
               return (
                 <div key={order.id} className="bg-card border border-border rounded-xl p-3 shadow-sm flex flex-col gap-2">
                   <div className="flex justify-between items-start">
                     <span className="text-[10px] font-mono text-muted-foreground/80">#{order.id.slice(-6)}</span>
                     <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${st.color}`}>
                       {st.label}
                     </span>
                   </div>
                   <div className="text-xs font-medium text-foreground line-clamp-2 leading-tight">
                     {order.service.name}
                   </div>
                   <div className="flex justify-between items-center mt-1">
                     <span className="text-[10px] text-muted-foreground">{order.quantity} шт.</span>
                     <span className="text-[10px] font-bold text-foreground">{formatBalance(order.charge)}</span>
                   </div>
                 </div>
               );
             })}
             {user.orders.length === 0 && <div className="text-xs text-muted-foreground/80 text-center py-2">Нет заказов</div>}
           </div>

            {user.orders.length > 0 && (
              <Link href={`/admin/orders?userId=${user.id}`} target="_blank" rel="noopener noreferrer" className="block mt-2 text-[11px] text-center font-bold text-primary hover:text-primary/80 transition-colors">
                Смотреть все заказы →
              </Link>
            )}
        </div>

        {/* Последние транзакции */}
        <div>
           <div className="flex items-center justify-between mb-3 px-1">
             <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
               <CreditCard className="w-3.5 h-3.5" /> Транзакции
             </h4>
           </div>
           
           <div className="space-y-2">
             {user.payments.map(payment => {
               const st = PAYMENT_STATUS_MAP[payment.status] || { label: payment.status, color: 'text-muted-foreground bg-muted border border-border' };
               return (
                 <div key={payment.id} className="bg-card border border-border rounded-xl p-3 shadow-sm flex items-center justify-between gap-2">
                   <div>
                     <div className="text-xs font-bold text-foreground">
                       {payment.gateway === 'cryptobot' ? `${(payment.amount / 100).toLocaleString('ru-RU')} USDT` : formatBalance(payment.amount)}
                     </div>
                     <div className="text-[10px] text-muted-foreground/80 mt-0.5 capitalize">{payment.gateway.replace('yookassa', 'Ru Карта')}</div>
                   </div>
                   <div className="text-right">
                     <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${st.color}`}>
                       {st.label}
                     </span>
                     <div className="text-[9px] text-muted-foreground/80 mt-1">
                       <ClientDate date={payment.createdAt} format="date-short" />
                     </div>
                   </div>
                 </div>
               );
             })}
             {user.payments.length === 0 && <div className="text-xs text-muted-foreground/80 text-center py-2">Нет пополнений</div>}
           </div>
        </div>

      </div>
    </div>
  );
}
