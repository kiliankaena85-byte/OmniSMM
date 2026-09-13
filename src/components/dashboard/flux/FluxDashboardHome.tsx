'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingCart, Wallet, ArrowRight, RefreshCw, TrendingUp, Users, Copy, Check } from 'lucide-react';
import { formatBalance } from '@/lib/utils';
import { PaymentAutoSync } from '@/components/orders/PaymentAutoSync';
import { FluxOrderClient } from '@/components/ab-test/FluxOrderClient';

import { getStatusBadgeClass, getStatusLabel } from '@/utils/status-helpers';
import { formatRub, toCents } from '@/lib/money';
import { FluxOrder, FluxNetwork } from '@/types/flux';

import { useUserBalance } from '@/hooks/use-user-balance';

export function FluxDashboardHome({
  user,
  orders,
  referralCount,
  activeOrders,
  hasPendingPayments,
  origin,
  initialCatalog = [],
}: {
  user: { email: string; balanceCents: number; referralCode?: string | null; totalSpent?: number };
  orders: FluxOrder[];
  referralCount: number;
  activeOrders: number;
  hasPendingPayments: boolean;
  origin: string;
  initialCatalog?: FluxNetwork[];
}) {
  const [copied, setCopied] = React.useState(false);
  const { balance: liveBalance } = useUserBalance(user.balanceCents);
  const refCode = user.referralCode ?? '';
  const refLink = refCode ? `${origin}?ref=${encodeURIComponent(refCode)}` : origin;
  const isRefLinkAvailable = Boolean(refCode);

  const copyTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const copyRefLink = () => {
    if (!isRefLinkAvailable) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(refLink).then(() => {
        setCopied(true);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {hasPendingPayments && <PaymentAutoSync />}
      
      {/* ── HERO ORDER WIZARD SECTION ── */}
      <section className="w-full">
        <FluxOrderClient 
          initialCatalog={initialCatalog} 
          initialEmail={user.email} 
        />
      </section>

      {/* ── METRICS & RECENT ORDERS GRID ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Balance & Active Orders */}
        <div className="space-y-6 lg:col-span-1">
          {/* Balance Card */}
          <div className="relative overflow-hidden rounded-[2rem] p-6 bg-card/80 backdrop-blur-2xl border border-border/40 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary shrink-0" />
                </div>
                <span className="font-bold text-foreground text-base">Ваш баланс</span>
              </div>
              <Link
                href="/dashboard/add-funds"
                className="text-xs font-bold px-3 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
              >
                + Пополнить
              </Link>
            </div>
            
            <div className="text-3xl font-black tabular-nums tracking-tight mb-2 text-foreground">
              {liveBalance}
            </div>
            
            <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Потрачено всего: {formatRub(Number(user.totalSpent || 0))} ₽</span>
            </div>
          </div>

          {/* Active Orders Card */}
          <div className="relative overflow-hidden rounded-[2rem] p-6 bg-card/80 backdrop-blur-2xl border border-border/40 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-primary animate-spin-slow shrink-0" />
                </div>
                <span className="font-bold text-foreground text-base">Активные заказы</span>
              </div>
              <Link href="/dashboard/orders" className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                Все <ArrowRight className="w-3 h-3 shrink-0" />
              </Link>
            </div>

            <div className="text-3xl font-black tabular-nums tracking-tight mb-1 text-foreground">
              {activeOrders}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Кампаний выполняется прямо сейчас</div>
          </div>
        </div>

        {/* Right Column: Recent Activity Feed */}
        <div className="relative overflow-hidden rounded-[2rem] p-6 bg-card/80 backdrop-blur-2xl border border-border/40 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <span className="font-bold text-foreground text-lg">Последняя активность</span>
              <Link href="/dashboard/orders" className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                История <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            
            <div className="space-y-3">
              {orders.length === 0 ? (
                <div className="text-center py-10 opacity-60">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="font-medium text-sm text-muted-foreground">Заказов пока нет</p>
                </div>
              ) : (
                orders.map(order => {
                  const color = getStatusBadgeClass(order.status);
                  const label = getStatusLabel(order.status);
                  return (
                    <div key={order.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-border/20 hover:bg-muted/60 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${color}`}>
                          {label}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-foreground text-sm truncate min-w-0">{order.service.name}</div>
                          <div className="text-xs text-muted-foreground font-medium">{order.quantity.toLocaleString('ru-RU')} шт.</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-foreground">{formatRub(order.chargeCents ?? toCents(order.charge))} ₽</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </section>

      {/* ── REFERRAL PROGRAM BANNER ── */}
      <section className="relative overflow-hidden rounded-[2rem] p-6 sm:p-8 bg-card border border-border shadow-sm text-foreground">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 backdrop-blur-md text-xs font-bold uppercase tracking-wider text-primary">
              <Users className="w-3.5 h-3.5" />
              Партнёрская программа
            </div>
            <h3 className="text-2xl font-extrabold tracking-tight">Приглашайте друзей и зарабатывайте</h3>
            <p className="text-sm text-muted-foreground max-w-xl font-medium">
              Делитесь персональной ссылкой и получайте % от каждого пополнения баланса вашими рефералами.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
            <div className="bg-muted/50 backdrop-blur-md px-4 py-2.5 rounded-xl border border-border text-center flex-1 sm:flex-none">
              <span className="text-xs text-muted-foreground font-semibold block">Приглашено</span>
              <span className="text-xl font-black">{referralCount} чел.</span>
            </div>

            <button
              onClick={copyRefLink}
              disabled={!isRefLinkAvailable}
              title={!isRefLinkAvailable ? "Код скоро появится" : undefined}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-sm hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {copied ? <Check className="w-4 h-4 text-success shrink-0" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? "Ссылка скопирована!" : !isRefLinkAvailable ? "Код скоро появится" : "Скопировать ссылку"}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
