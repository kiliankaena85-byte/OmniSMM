'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ShoppingCart, 
  Wallet, 
  Users, 
  ArrowRight, 
  Clock, 
  Copy, 
  Check, 
  Sparkles, 
  Zap, 
  RotateCcw,
  ArrowUpRight,
  ExternalLink,
  Award,
  Activity
} from 'lucide-react';
import { PaymentAutoSync } from '@/components/orders/PaymentAutoSync';
import { SocialIcon } from '@/components/ui/SocialIcon';
import { useUserBalance } from '@/hooks/use-user-balance';
import { formatBalance } from '@/lib/utils';
import { getLoyaltyInfo, getOrderProgressPercent, TOP_LAUNCHPAD_NETWORKS } from '@/lib/loyalty';


const STATUS_LABEL: Record<string, string> = {
  COMPLETED:       'Выполнен',
  IN_PROGRESS:     'В работе',
  PENDING:         'Ожидание',
  AWAITING_PAYMENT:'Ожидает оплаты',
  ERROR:           'Ошибка',
  CANCELED:        'Отменён',
  PARTIAL:         'Частично',
  PROVISIONING:    'Запуск',
};

const STATUS_COLOR: Record<string, string> = {
  COMPLETED:       'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
  IN_PROGRESS:     'text-sky-700 dark:text-sky-400 bg-sky-500/10 border border-sky-500/20',
  PENDING:         'text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20',
  AWAITING_PAYMENT:'text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20',
  PROVISIONING:    'text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20',
  ERROR:           'text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20',
  PARTIAL:         'text-orange-700 dark:text-orange-400 bg-orange-500/10 border border-orange-500/20',
  CANCELED:        'text-muted-foreground bg-muted border border-border',
};

/**
 * ExactMath Invariant: User financial attributes in integer kopecks (cents).
 * All money handling uses BigInt kopecks representation with Banker's Rounding.
 */
export interface ClassicDashboardUser {
  id?: string;
  email?: string | null;
  /** Primary balance in BigInt kopecks */
  balance?: bigint;
  /** Kopecks serialized across Server/Client boundary */
  balanceCents?: bigint | number;
  /** Cumulative spent volume in BigInt kopecks */
  totalSpent?: bigint | number;
  referralCode?: string | null;
  referralBalance?: bigint | number;
}

/**
 * ExactMath Invariant: Order charge in BigInt kopecks.
 */
export interface ClassicDashboardOrder {
  id: string;
  numericId: number;
  status: string;
  charge: bigint | number;
  quantity: number;
  link?: string;
  serviceId?: string;
  service?: {
    name: string;
    categoryId?: string | null;
    category?: {
      network?: {
        slug: string;
      } | null;
    } | null;
  } | null;
}

export function ClassicDashboardHome({
  user,
  orders,
  referralCount,
  activeOrders,
  hasPendingPayments,
  origin,
  initialCatalog = [],
}: {
  user: ClassicDashboardUser;
  orders: ClassicDashboardOrder[];
  referralCount: number;
  activeOrders: number;
  hasPendingPayments: boolean;
  origin: string;
  initialCatalog?: Array<{ id: string; name: string; slug: string; [key: string]: unknown }>;
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const rawBalance = user.balance ?? (user.balanceCents !== undefined ? BigInt(user.balanceCents) : BigInt(0));
  const { balance: liveBalance } = useUserBalance(rawBalance);
  const [greeting, setGreeting] = useState('Добро пожаловать');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) setGreeting('Доброе утро');
    else if (hour >= 12 && hour < 18) setGreeting('Добрый день');
    else if (hour >= 18 && hour < 23) setGreeting('Добрый вечер');
    else setGreeting('Доброй ночи');
  }, []);

  const totalSpentKopecks = typeof user.totalSpent === 'bigint' ? user.totalSpent : BigInt(user.totalSpent ?? 0);
  const loyalty = getLoyaltyInfo(totalSpentKopecks);

  const handleCopyReferral = () => {
    if (!user.referralCode) return;
    const link = `${origin}/r/${user.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-sans text-foreground">
      {hasPendingPayments && <PaymentAutoSync />}

      {/* ══════════ HERO GREETING BANNER ══════════ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card/95 to-primary/5 border border-border/80 p-6 sm:p-8 shadow-xl shadow-primary/5">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="whitespace-nowrap">155 тарифов онлайн • Мгновенный запуск</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              {greeting}, {user.email?.split('@')[0] || 'клиент'}! 👋
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium flex items-center gap-2 flex-wrap">
              <span>Личный кабинет SMMplan</span>
              <span>•</span>
              <span className="text-foreground/80 font-semibold">{user.email}</span>
              <span>•</span>
              <span>Оптовые тарифы от 1 шт. без посредников</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-card hover:bg-secondary border border-border text-muted-foreground hover:text-foreground font-bold text-xs sm:text-sm shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 whitespace-nowrap shrink-0"
              title="Перейти на главный сайт и витрину услуг"
              aria-label="На витрину"
            >
              <ExternalLink className="w-4 h-4 text-primary shrink-0" />
              <span>На витрину</span>
            </Link>
            <Link
              href="/dashboard/new-order"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs sm:text-sm shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 whitespace-nowrap shrink-0"
            >
              <Zap className="w-4 h-4 shrink-0" />
              <span>Новый заказ</span>
            </Link>
            <Link
              href="/dashboard/add-funds"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-card hover:bg-secondary border border-border text-foreground font-bold text-xs sm:text-sm shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 whitespace-nowrap shrink-0"
            >
              <Wallet className="w-4 h-4 text-primary shrink-0" />
              <span>Пополнить</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ══════════ BENTO KPI CARDS ══════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        {/* Карточка 1: Финансовый кошелёк */}
        <div className="group relative overflow-hidden bg-card/85 backdrop-blur-xl border border-border/80 rounded-3xl p-5 sm:p-6 shadow-md hover:shadow-xl hover:border-primary/40 transition-all duration-300 flex flex-col justify-between space-y-4 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">
              Доступный баланс
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                +{loyalty.cashbackPercent}% кэшбэк
              </span>
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shrink-0">
                <Wallet className="w-4 h-4 shrink-0" />
              </div>
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-600 to-violet-700 dark:from-sky-400 dark:via-indigo-400 dark:to-pink-400 whitespace-nowrap tabular-nums">
              {liveBalance}
            </div>
            <span className="text-[11px] text-muted-foreground font-medium block mt-0.5">
              Моментальное авто-списание за заказы
            </span>
          </div>
          <Link
            href="/dashboard/add-funds"
            aria-label="Пополнить баланс"
            className="w-full min-h-[44px] py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center gap-2 text-xs font-extrabold transition-all duration-200"
          >
            <span>+ Пополнить счет</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </Link>
        </div>

        {/* Карточка 2: Оборот & Лояльность */}
        <div className="group relative overflow-hidden bg-card/85 backdrop-blur-xl border border-border/80 rounded-3xl p-5 sm:p-6 shadow-md hover:shadow-xl hover:border-border transition-all duration-300 flex flex-col justify-between space-y-4 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">
              Оборот & Статус
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap ${loyalty.badgeColor}`}>
                {loyalty.tierName}
              </span>
              <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground group-hover:scale-110 transition-transform shrink-0">
                <Award className="w-4 h-4 shrink-0" />
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-foreground tabular-nums">
                {formatBalance(totalSpentKopecks)}
              </span>
              <span className="text-sm font-bold text-muted-foreground">₽</span>
            </div>
            
            {/* Микро-прогресс лояльности */}
            <div className="mt-2 space-y-1">
              <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-primary to-indigo-500 h-1.5 rounded-full transition-all duration-500" 
                  style={{ width: `${loyalty.progressPercent}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium block truncate">
                {loyalty.nextTierName 
                  ? `Еще ${loyalty.remainingToNextTierRub.toLocaleString('ru-RU')} ₽ до ${loyalty.nextTierName}`
                  : 'Максимальный Gold уровень'}
              </span>
            </div>
          </div>
          <Link
            href="/dashboard/transactions"
            aria-label="Перейти в историю транзакций"
            className="w-full min-h-[44px] py-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground flex items-center justify-center gap-2 text-xs font-extrabold transition-all duration-200"
          >
            <span>История транзакций</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </Link>
        </div>

        {/* Карточка 3: Заказы в работе */}
        <div className="group relative overflow-hidden bg-card/85 backdrop-blur-xl border border-border/80 rounded-3xl p-5 sm:p-6 shadow-md hover:shadow-xl hover:border-sky-500/40 transition-all duration-300 flex flex-col justify-between space-y-4 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">
              Заказы в работе
            </span>
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 shrink-0">
              {activeOrders > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
              )}
              <Activity className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-foreground font-mono tracking-tight flex items-center gap-2 whitespace-nowrap">
              <span className="tabular-nums">{activeOrders}</span>
              {activeOrders > 0 ? (
                <span className="text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 rounded-full animate-pulse whitespace-nowrap">
                  Исполняются
                </span>
              ) : (
                <span className="text-xs font-bold text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full whitespace-nowrap">
                  Все закрыты
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground font-medium block mt-0.5">
              {activeOrders > 0 ? 'Фоновый мониторинг выполнения' : 'Нет активных задач прямо сейчас'}
            </span>
          </div>
          <Link
            href="/dashboard/orders"
            aria-label="Перейти в мои заказы"
            className="w-full min-h-[44px] py-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground flex items-center justify-center gap-2 text-xs font-extrabold transition-all duration-200"
          >
            <span>Мои заказы</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </Link>
        </div>

        {/* Карточка 4: Реферальная сеть */}
        <div className="group relative overflow-hidden bg-card/85 backdrop-blur-xl border border-border/80 rounded-3xl p-5 sm:p-6 shadow-md hover:shadow-xl hover:border-emerald-500/40 transition-all duration-300 flex flex-col justify-between space-y-4 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">
              Партнёрка
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                10% доход
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
                <Users className="w-4 h-4 shrink-0" />
              </div>
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-foreground font-mono tracking-tight flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="tabular-nums">{referralCount}</span>
              <span className="text-xs font-bold text-muted-foreground">партнёров</span>
            </div>
            <div className="mt-2">
              <button
                type="button"
                onClick={handleCopyReferral}
                aria-label="Скопировать реферальную ссылку"
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center gap-2 text-xs font-bold transition-all duration-200 active:scale-[0.98]"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Скопировано!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 shrink-0" />
                    <span className="truncate">Скопировать реф-ссылку</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <Link
            href="/dashboard/referrals"
            aria-label="Перейти в партнёрский кабинет"
            className="w-full min-h-[44px] py-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground flex items-center justify-center gap-2 text-xs font-extrabold transition-all duration-200"
          >
            <span>Партнёрка</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </Link>
        </div>
      </div>

      {/* ══════════ QUICK LAUNCHPAD (БЫСТРЫЙ ЗАКАЗ ПО СОЦСЕТЯМ) ══════════ */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight flex items-center gap-2">
              <span>Быстрый запуск по соцсетям</span>
              <span className="text-[11px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                7 сетей
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Прямые шлюзы к 155 тарифам Vexboost с моментальным переходом в визард
            </p>
          </div>
          <Link
            href="/dashboard/new-order"
            className="min-h-[44px] px-3.5 py-2 text-xs font-bold text-primary hover:underline flex items-center gap-1.5 shrink-0 self-start sm:self-auto rounded-xl hover:bg-primary/5 transition-colors"
          >
            <span>Полный каталог услуг</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {TOP_LAUNCHPAD_NETWORKS.map((item) => (
            <Link
              key={item.slug}
              href={`/dashboard/new-order?network=${item.slug}`}
              className={`group bg-card/90 backdrop-blur-md border border-border/70 rounded-2xl p-3.5 flex flex-col justify-between space-y-3 hover:-translate-y-1 hover:shadow-lg transition-all duration-200 ${item.glow}`}
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-secondary/80 flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                  <SocialIcon slug={item.slug} className="w-6 h-6 shrink-0" />
                </div>
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border ${item.badgeColor}`}>
                  {item.badge}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-foreground group-hover:text-primary transition-colors">
                    {item.name}
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                </div>
                <div className="text-[10px] text-muted-foreground font-medium line-clamp-1">
                  {item.desc}
                </div>
                <div className="text-[11px] font-black text-primary font-mono tracking-tight pt-1">
                  {item.priceFrom.includes('/ шт') ? item.priceFrom : `${item.priceFrom} / шт`}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ══════════ RECENT ORDERS FEED ══════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-foreground tracking-tight">
              Последние заказы
            </h2>
            <p className="text-xs text-muted-foreground">
              История активности, статус выполнения и прогресс в реальном времени
            </p>
          </div>
          {orders.length > 0 && (
            <Link
              href="/dashboard/orders"
              className="min-h-[44px] text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2"
            >
              <span>Все заказы</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </Link>
          )}
        </div>

        {orders.length > 0 ? (
          <div className="bg-card/90 backdrop-blur-xl border border-border/80 rounded-3xl overflow-hidden shadow-lg shadow-black/5 divide-y divide-border/50">
            {orders.map((order) => {
              const color = STATUS_COLOR[order.status] || STATUS_COLOR.CANCELED;
              const label = STATUS_LABEL[order.status] || order.status;
              const progress = getOrderProgressPercent(order.status);
              return (
                <div
                  key={order.id}
                  className="flex flex-col gap-3 p-4 sm:px-6 hover:bg-secondary/40 transition-colors duration-200 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-secondary/80 border border-border/60 flex items-center justify-center p-2 shrink-0 group-hover:scale-105 transition-transform">
                        <SocialIcon slug={order.service?.category?.network?.slug || 'telegram'} className="w-5 h-5 shrink-0" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[11px] font-extrabold text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                            #{order.numericId}
                          </span>
                          <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors min-w-0">
                            {order.service?.name || 'Услуга продвижения'}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span className="font-semibold text-foreground">{order.quantity.toLocaleString('ru-RU')} шт.</span>
                          <span>•</span>
                          {order.link ? (
                            <a 
                              href={order.link} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="inline-flex items-center gap-1.5 hover:text-primary hover:underline truncate max-w-[200px] sm:max-w-[300px] min-h-[36px] sm:min-h-0 py-1 min-w-0"
                              title={order.link}
                            >
                              <span className="truncate min-w-0">{order.link}</span>
                              <ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground/60">Без ссылки</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                      <div className="text-right">
                        <div className="text-sm font-black text-foreground font-mono tabular-nums whitespace-nowrap">
                          {formatBalance(BigInt(order.charge ?? 0))}
                        </div>
                        <span className={`inline-flex items-center text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg uppercase tracking-wider whitespace-nowrap shrink-0 ${color}`}>
                          {label}
                        </span>
                      </div>

                      <Link
                        // FIX(REPEAT): контракт reorder* — единственный, который читает /dashboard/new-order
                        href={`/dashboard/new-order?reorderServiceId=${order.serviceId || ''}&reorderCategoryId=${order.service?.categoryId || ''}&reorderLink=${encodeURIComponent(order.link || '')}&reorderQty=${order.quantity}`}
                        title="Повторить этот заказ"
                        aria-label={`Повторить заказ #${order.numericId}`}
                        className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-xl bg-secondary hover:bg-primary/10 hover:text-primary text-muted-foreground border border-border/60 flex items-center justify-center transition-all duration-200 active:scale-95 shadow-sm"
                      >
                        <RotateCcw className="w-4 h-4 shrink-0" />
                      </Link>
                    </div>
                  </div>

                  {/* Линейный прогресс-бар выполнения */}
                  <div className="w-full bg-secondary/60 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        order.status === 'COMPLETED'
                          ? 'bg-emerald-500'
                          : order.status === 'IN_PROGRESS'
                          ? 'bg-sky-500 animate-pulse'
                          : order.status === 'PROVISIONING'
                          ? 'bg-indigo-500'
                          : order.status === 'PENDING'
                          ? 'bg-amber-500'
                          : 'bg-muted-foreground/30'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card/85 backdrop-blur-xl border border-dashed border-border/80 rounded-3xl p-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
              <ShoppingCart className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-foreground text-base">У вас пока нет активных заказов</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Создайте свой первый заказ на продвижение за 30 секунд. Тарифы от 1 штуки без минимального порога!
              </p>
            </div>
            <Link
              href="/dashboard/new-order"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-xs shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all duration-200 min-h-[44px]"
            >
              <span>Создать первый заказ</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </Link>
          </div>
        )}
      </section>

      {/* ══════════ PARTNER REFERRAL SNIPPET ══════════ */}
      {user.referralCode && (
        <section className="bg-gradient-to-r from-card via-secondary/20 to-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              <Users className="w-3.5 h-3.5" />
              <span>Зарабатывайте с SMMplan</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
              Ваша реферальная ссылка
            </h2>
            <p className="text-xs text-muted-foreground max-w-md">
              Делитесь ссылкой и получайте пожизненный процент с каждого пополнения привлеченных клиентов.
            </p>
          </div>

          <div className="flex items-center gap-3 max-w-md w-full sm:w-auto">
            <div className="min-h-[44px] flex items-center font-mono text-xs font-bold bg-secondary/80 px-4 py-3 rounded-2xl text-foreground truncate border border-border/80 flex-1 select-all min-w-0">
              {`${origin}/r/${user.referralCode}`}
            </div>
            <button
              onClick={handleCopyReferral}
              aria-label="Скопировать реферальную ссылку"
              className="min-h-[44px] px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-xs sm:text-sm flex items-center gap-2 shrink-0 shadow-md shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-300 shrink-0" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Скопировано' : 'Копировать'}</span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
