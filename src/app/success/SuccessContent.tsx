'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, ShoppingCart, LayoutDashboard, MessageSquare, AlertTriangle, RefreshCw } from 'lucide-react';

type OrderStatus = {
  orderId: string;
  numericId: number;
  status: string; // AWAITING_PAYMENT | PENDING | IN_PROGRESS | COMPLETED | ERROR | CANCELED
  charge: number;
  quantity: number;
  serviceName: string;
};

type PageState = 'verifying' | 'confirmed' | 'awaiting' | 'error' | 'no-context';

const MAX_POLLS = 6;
const POLL_INTERVAL = 5000;

export function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('orderId');
  const paymentId = searchParams.get('paymentId');
  const token = searchParams.get('token');
  const tenantParam = searchParams.get('tenant');
  const paymentParam = searchParams.get('payment');

  const [isFlux, setIsFlux] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isFluxTenant = tenantParam === 'flux' || 
        document.documentElement.getAttribute('data-tenant') === 'flux' ||
        window.location.hostname.includes('smmflux');
      setIsFlux(isFluxTenant);
    }
  }, [tenantParam]);

  const [pageState, setPageState] = useState<PageState>((orderId || paymentId) ? 'verifying' : 'no-context');
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [autoRedirect, setAutoRedirect] = useState(10);
  const [isManualFetching, setIsManualFetching] = useState(false);
  const isBalancePayment = paymentParam === 'balance' || (order as any)?.gateway === 'balance';

  // Clear the order draft session storage upon landing on success page
  useEffect(() => {
    try {
      sessionStorage.removeItem('smmplan_draft');
    } catch {
      // sessionStorage might be blocked in incognito/SSR
    }
  }, []);

  const checkStatus = useCallback(async (manual = false) => {
    if (!orderId && !paymentId) return;
    if (manual) setIsManualFetching(true);
    try {
      const effectiveToken = token || (typeof window !== 'undefined' && orderId ? localStorage.getItem(`guest_order_${orderId}`) : null);

      const params = new URLSearchParams();
      if (orderId) params.append('orderId', orderId);
      if (paymentId) params.append('paymentId', paymentId);
      if (effectiveToken) params.append('token', effectiveToken);

      const res = await fetch(`/api/order-status?${params.toString()}`);
      if (!res.ok) {
        setPageState('error');
        return;
      }
      const data: OrderStatus = await res.json();
      setOrder(data);

      if (data.status === 'PENDING' || data.status === 'IN_PROGRESS' || data.status === 'COMPLETED') {
        // Оплата подтверждена (вебхук пришёл, заказ активен)
        setPageState('confirmed');
      } else if (data.status === 'AWAITING_PAYMENT') {
        // Вебхук ещё не пришёл
        setPageState('awaiting');
      } else if (data.status === 'ERROR' || data.status === 'CANCELED') {
        setPageState('error');
      }
    } catch {
      setPageState('error');
    } finally {
      if (manual) setIsManualFetching(false);
    }
  }, [orderId, paymentId, token]);

  // Initial check + polling
  useEffect(() => {
    if (!orderId && !paymentId) return;
    checkStatus();
  }, [orderId, paymentId, checkStatus]);

  // Phase 1: Auto-poll while awaiting (up to MAX_POLLS)
  useEffect(() => {
    if (pageState !== 'awaiting' && pageState !== 'verifying') return;
    if (pollCount >= MAX_POLLS) return;

    const timer = setTimeout(() => {
      setPollCount(prev => prev + 1);
      checkStatus();
    }, POLL_INTERVAL);

    return () => clearTimeout(timer);
  }, [pageState, pollCount, checkStatus]);

  // Auto-redirect countdown when confirmed
  useEffect(() => {
    if (pageState !== 'confirmed') return;
    if (autoRedirect <= 0) {
      router.push('/dashboard/orders');
      return;
    }
    const timer = setTimeout(() => setAutoRedirect(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [pageState, autoRedirect, router]);

  // ── СОСТОЯНИЕ: Нет orderId (прямой заход на /success) ──
  if (pageState === 'no-context') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-muted border-4 border-border flex items-center justify-center">
              <LayoutDashboard className="w-10 h-10 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-foreground">Нет данных о платеже</h1>
            <p className="text-muted-foreground text-sm">
              Перейдите в раздел «Мои заказы», чтобы проверить статус.
            </p>
          </div>
          <Link
            href="/dashboard/orders"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all duration-200"
          >
            <LayoutDashboard className="w-4 h-4" /> Мои заказы
          </Link>
        </div>
      </div>
    );
  }

  // ── СОСТОЯНИЕ: Проверяем / Ждём вебхук ──
  if (pageState === 'verifying' || pageState === 'awaiting') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-8 animate-in fade-in duration-500">
          {/* Animated Verification Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-status-warning-bg border-4 border-status-warning/20 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-status-warning animate-spin" />
              </div>
              <div className="absolute inset-0 rounded-full border-4 border-status-warning/20 animate-ping opacity-20" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-black text-foreground">
              {isBalancePayment ? "Запуск заказа..." : "Проверяем оплату..."}
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              {isBalancePayment ? (
                <>Заказ оплачен с вашего баланса и передаётся в обработку. Обычно это занимает <strong className="text-foreground">несколько секунд</strong>.</>
              ) : (
                <>Ожидаем подтверждение от платёжной системы. Обычно это занимает <strong className="text-foreground">несколько секунд</strong>.</>
              )}
            </p>
          </div>

          {pollCount < MAX_POLLS ? (
            <>
              {/* Progress indicator */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Статус проверки</span>
                  <span className="text-status-warning font-bold flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Проверка {pollCount + 1}/{MAX_POLLS}
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-status-warning rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(((pollCount + 1) / MAX_POLLS) * 100, 100)}%` }}
                  />
                </div>
                {order && (
                  <p className="text-xs text-muted-foreground">
                    Заказ #{order.numericId} · {order.serviceName} · {(order.charge / 100).toLocaleString('ru-RU')} ₽
                  </p>
                )}
              </div>

              {/* Hint after ~15 seconds */}
              {pollCount >= 3 && (
                <div className="bg-status-warning-bg border border-status-warning/20 rounded-xl p-4 text-left animate-in fade-in duration-300">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-status-warning shrink-0 mt-0.5" />
                    <div className="text-sm text-status-warning">
                      <p className="font-semibold mb-1">{isBalancePayment ? "Заказ обрабатывается" : "Подтверждение задерживается"}</p>
                      <p>{isBalancePayment ? "Заказ оплачен с баланса и передаётся поставщику. Вы можете проверить статус позже в разделе «Мои заказы»." : "Если вы уже оплатили — не волнуйтесь, мы автоматически зачислим платёж, когда банк пришлёт подтверждение. Вы также можете проверить статус позже в разделе «Мои заказы»."}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Phase 2: Manual fallback after max polls */
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="bg-status-warning-bg border border-status-warning/20 rounded-xl p-4 text-left">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-status-warning shrink-0 mt-0.5" />
                  <div className="text-sm text-status-warning">
                    <p className="font-semibold mb-1">{isBalancePayment ? "Заказ обрабатывается" : "Подтверждение задерживается"}</p>
                    <p>{isBalancePayment ? "Заказ находится в очереди на запуск. Нажмите «Обновить статус», чтобы запросить статус вручную, или перейдите в мои заказы." : "Банк ещё не прислал ответ. Нажмите «Обновить статус», чтобы запросить статус вручную, или проверьте позже."}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => checkStatus(true)}
                  disabled={isManualFetching}
                  className="flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all duration-200 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isManualFetching ? 'animate-spin' : ''}`} />
                  Обновить статус
                </button>
                <Link
                  href="/dashboard/orders"
                  className="flex items-center justify-center gap-2 py-3 bg-card border border-border text-foreground rounded-xl font-semibold text-sm hover:bg-muted transition-all duration-200"
                >
                  <LayoutDashboard className="w-4 h-4" /> В Мои заказы
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── СОСТОЯНИЕ: Оплата подтверждена! ──
  if (pageState === 'confirmed') {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 font-sans relative overflow-x-clip ${
        isFlux ? "bg-[#080b14] text-white" : "bg-background text-foreground"
      }`}>
        {isFlux && (
          <div className="absolute top-0 inset-x-0 h-screen z-0 pointer-events-none overflow-hidden select-none">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-600/20 blur-[130px] rounded-full" />
            <div className="absolute bottom-10 right-10 w-72 h-72 bg-pink-600/20 blur-[100px] rounded-full" />
          </div>
        )}

        <div className={`max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-500 relative z-10 p-8 sm:p-10 rounded-[2.5rem] ${
          isFlux 
            ? "bg-gradient-to-b from-[#13192f]/95 via-[#0f1426]/95 to-[#0b0f1d]/95 border border-purple-500/30 shadow-[0_20px_80px_rgba(168,85,247,0.2)]" 
            : ""
        }`}>
          {/* Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
                isFlux 
                  ? "bg-emerald-500/20 border-4 border-emerald-500/40 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)]" 
                  : "bg-status-success-bg border-4 border-status-success/20 text-status-success"
              }`}>
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping opacity-20" />
            </div>
          </div>

          {/* Text */}
          <div className="space-y-3">
            <h1 className={`text-3xl font-black ${isFlux ? "text-white" : "text-foreground"}`}>
              {isBalancePayment ? "Заказ успешно запущен!" : "Оплата подтверждена!"}
            </h1>
            <div className={`text-sm sm:text-base leading-relaxed ${isFlux ? "text-neutral-300" : "text-muted-foreground"}`}>
              {isBalancePayment && (
                <div className="mb-2">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    💰 Оплачено с внутреннего баланса
                  </span>
                </div>
              )}
              {order ? (
                <p>
                  Заказ <strong className={isFlux ? "text-white" : "text-foreground"}>#{order.numericId}</strong> принят и запущен в обработку.
                  Обычно старт происходит в течение <strong className={isFlux ? "text-white" : "text-foreground"}>1–5 минут</strong>.
                </p>
              ) : (
                <p>
                  Заказ принят и запущен в обработку. Обычно старт происходит в течение <strong className={isFlux ? "text-white" : "text-foreground"}>1–5 минут</strong>.
                </p>
              )}
            </div>
          </div>

          {/* Steps */}
          <div className={`p-5 text-left space-y-3 rounded-2xl border ${
            isFlux 
              ? "bg-[#101528]/90 border-purple-500/20" 
              : "bg-card border-border"
          }`}>
            <p className={`text-xs font-black uppercase tracking-wider ${isFlux ? "text-purple-300" : "text-muted-foreground"}`}>
              Что дальше?
            </p>
            {[
              { step: '1', text: 'Заказ передан в автоматическую очередь' },
              { step: '2', text: 'Начнётся выполнение в течение нескольких минут' },
              { step: '3', text: 'Следите за статусом в личном кабинете' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isFlux ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white" : "bg-primary text-primary-foreground"
                }`}>
                  {step}
                </div>
                <p className={`text-xs sm:text-sm font-medium ${isFlux ? "text-neutral-200" : "text-foreground"}`}>{text}</p>
              </div>
            ))}
          </div>

          {/* Auto-redirect hint */}
          <p className={`text-xs ${isFlux ? "text-neutral-400" : "text-muted-foreground"}`}>
            Переход в кабинет через {autoRedirect} сек.
          </p>

          {/* Actions */}
          <div className="grid grid-cols-1 gap-3">
            <Link
              href="/dashboard/orders"
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-full font-bold text-sm transition-all duration-200 ${
                isFlux 
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_4px_20px_rgba(168,85,247,0.35)] hover:opacity-95" 
                  : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              }`}
              aria-label="Перейти к моим заказам"
            >
              <LayoutDashboard className="w-4 h-4" />
              Мои заказы
            </Link>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/"
                className={`flex items-center justify-center gap-2 py-3 rounded-full font-bold text-xs transition-all duration-200 border ${
                  isFlux 
                    ? "bg-[#101528] border-purple-500/30 text-neutral-200 hover:text-white hover:border-purple-500/60" 
                    : "bg-card border-border text-foreground hover:bg-muted"
                }`}
                aria-label="Создать ещё один заказ"
              >
                <ShoppingCart className="w-4 h-4" />
                Новый заказ
              </Link>
              <a
                href="/api/support/telegram"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 py-3 rounded-full font-bold text-xs transition-all duration-200 border ${
                  isFlux 
                    ? "bg-[#101528] border-purple-500/30 text-neutral-200 hover:text-white hover:border-purple-500/60" 
                    : "bg-card border-border text-foreground hover:bg-muted"
                }`}
                aria-label="Написать в поддержку"
              >
                <MessageSquare className="w-4 h-4" />
                Поддержка
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── СОСТОЯНИЕ: Ошибка ──
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-status-error-bg border border-status-error/20 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-status-error" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-foreground">Что-то пошло не так</h1>
          <p className="text-muted-foreground text-sm">
            Платёж не был подтверждён или заказ отменён. Проверьте статус в разделе «Мои заказы» или обратитесь в поддержку.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/dashboard/orders"
            className="flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all duration-200"
          >
            <LayoutDashboard className="w-4 h-4" /> Мои заказы
          </Link>
          <Link
            href="/dashboard/tickets"
            className="flex items-center justify-center gap-2 py-3 bg-card border border-border text-foreground rounded-xl font-semibold text-sm hover:bg-muted transition-all duration-200"
          >
            <MessageSquare className="w-4 h-4" /> Поддержка
          </Link>
        </div>
      </div>
    </div>
  );
}
