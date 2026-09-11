'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { createTopUpPaymentAction } from '@/actions/user/top-up.action';
import { activatePromoCodeAction } from '@/actions/user/promo';
import { createB2bInvoiceAction } from '@/actions/user/b2b-invoice.action';
import { getAvailableGatewaysAction } from '@/actions/order/checkout';
import {
  CreditCard,
  Wallet,
  Gift,
  CheckCircle2,
  QrCode,
  Building2,
  ShieldCheck,
  FileText,
  Printer,
  Copy,
  Check,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const PRESETS = [
  { value: 500, label: '500 ₽' },
  { value: 1000, label: '1 000 ₽' },
  { value: 2500, label: '2 500 ₽' },
  { value: 5000, label: '5 000 ₽' },
  { value: 10000, label: '10 000 ₽' },
  { value: 25000, label: '25 000 ₽' },
];

export type PaymentMethodId = 'yookassa' | 'cryptobot' | 'robokassa' | 'b2b';

const METHODS: Array<{
  id: PaymentMethodId;
  label: string;
  badge?: string;
  badgeColor?: string;
  icon: typeof CreditCard;
  note: string;
  commission: string;
}> = [
  {
    id: 'yookassa',
    label: 'Банковские карты РФ и СБП (ЮKassa)',
    badge: 'Мгновенно',
    badgeColor: 'bg-primary/10 text-primary border-primary/20',
    icon: CreditCard,
    note: 'МИР, Visa, Mastercard РФ, СБП, SberPay, T-Pay • Онлайн-чеки 54-ФЗ',
    commission: '0%',
  },
  {
    id: 'cryptobot',
    label: 'Международный шлюз CryptoBot (USDT / TON)',
    badge: 'Без лимитов',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    icon: Wallet,
    note: 'USDT, TON • Международный расчётный оператор (Foreign MoR)',
    commission: '0%',
  },
  {
    id: 'robokassa',
    label: 'Робокасса (РФ и СНГ)',
    icon: CreditCard,
    note: 'Карты РФ/СНГ, SberPay, ЮMoney, T-Pay',
    commission: '0%',
  },
  {
    id: 'b2b',
    label: 'Безналичный расчёт (B2B)',
    badge: 'Для ИП и ООО',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    icon: Building2,
    note: 'Оплата по счёту с закрывающими документами УПД (Диадок / СБИС) от 3 000 ₽',
    commission: '0%',
  },
];

export default function AddFundsForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get('success') === '1';

  const [amount, setAmount] = useState<number>(3000);
  const [method, setMethod] = useState<PaymentMethodId>('yookassa');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [availableGateways, setAvailableGateways] = useState<{
    yookassa: boolean;
    robokassa: boolean;
    cryptobot: boolean;
    b2b?: boolean;
  } | null>(null);

  useEffect(() => {
    getAvailableGatewaysAction().then((res) => {
      if (res.success && res.data) {
        const data = res.data;
        setAvailableGateways({
          yookassa: Boolean(data.yookassa),
          robokassa: Boolean(data.robokassa),
          cryptobot: Boolean(data.cryptobot),
          b2b: Boolean(data.b2b)
        });

        const isCurrentActive =
          (method === 'yookassa' && data.yookassa) ||
          (method === 'cryptobot' && data.cryptobot) ||
          (method === 'robokassa' && data.robokassa) ||
          (method === 'b2b' && data.b2b);

        if (!isCurrentActive) {
          if (data.yookassa) setMethod('yookassa');
          else if (data.cryptobot) setMethod('cryptobot');
          else if (data.robokassa) setMethod('robokassa');
          else if (data.b2b) setMethod('b2b');
        }
      }
    });
  }, [method]);

  // B2B state
  const [b2bCompanyName, setB2bCompanyName] = useState('');
  const [b2bInn, setB2bInn] = useState('');
  const [b2bKpp, setB2bKpp] = useState('');
  const [b2bLegalAddress, setB2bLegalAddress] = useState('');
  const [b2bInvoiceCreated, setB2bInvoiceCreated] = useState<{
    invoiceId: string;
    amountRub: number;
    companyName: string;
    inn: string;
    kpp: string | null;
    createdAt: string;
  } | null>(null);
  const [copiedInvoice, setCopiedInvoice] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      inputRef.current?.focus();
    }
  }, []);

  // Promo code state
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);
  const [isPromoPending, startPromoTransition] = useTransition();

  // Bonus calculations
  function handlePreset(val: number) {
    setAmount(val);
    setError(null);
  }

  function handleSubmit() {
    if (amount < 10) {
      setError('Минимальная сумма пополнения — 10 ₽');
      return;
    }

    if (method === 'b2b') {
      if (amount < 3000) {
        setError('Минимальная сумма безналичного счета для юрлиц — 3 000 ₽');
        return;
      }
      if (!b2bCompanyName.trim()) {
        setError('Укажите наименование организации или ИП');
        return;
      }
      if (!/^\d{10}$|^\d{12}$/.test(b2bInn.trim())) {
        setError('ИНН должен содержать ровно 10 (ООО) или 12 (ИП) цифр');
        return;
      }
      if (b2bKpp.trim() && !/^\d{9}$/.test(b2bKpp.trim())) {
        setError('КПП должен содержать 9 цифр');
        return;
      }

      if (isPending) return;
      setError(null);

      startTransition(async () => {
        try {
          const res = await createB2bInvoiceAction({
            amountRub: amount,
            companyName: b2bCompanyName.trim(),
            inn: b2bInn.trim(),
            kpp: b2bKpp.trim() || undefined,
            legalAddress: b2bLegalAddress.trim() || undefined,
          });

          if (res.success && res.invoice) {
            setB2bInvoiceCreated(res.invoice);
          }
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : 'Ошибка создания B2B счета');
        }
      });
      return;
    }

    if (isPending) return;
    setError(null);

    startTransition(async () => {
      try {
        const res = await createTopUpPaymentAction(amount, method);
        if (res.success && res.paymentUrl) {
          window.location.href = res.paymentUrl;
        } else {
          setError(res.error || 'Ошибка создания платежа в платёжной системе');
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Неизвестная ошибка создания платежа');
      }
    });
  }

  function handlePromoSubmit() {
    if (!promoCode.trim()) {
      setPromoError('Введите промокод');
      return;
    }
    setPromoError(null);
    setPromoSuccess(null);
    startPromoTransition(async () => {
      try {
        const res = await activatePromoCodeAction(promoCode);
        if (res.success && res.amount) {
          setPromoSuccess(`Промокод активирован! Начислено ${(res.amount / 100).toFixed(2)} ₽`);
          setPromoCode('');
          const { refreshBalanceAction } = await import('@/actions/auth/refresh-balance');
          const { dispatchBalanceUpdate } = await import('@/hooks/use-user-balance');
          const fresh = await refreshBalanceAction();
          if (fresh.success && fresh.balanceRub) {
            dispatchBalanceUpdate({ balanceRub: fresh.balanceRub, source: 'promoActivated' });
          }
          router.refresh();
        } else {
          setPromoError(res.error || 'Ошибка активации промокода');
        }
      } catch (e: unknown) {
        setPromoError(e instanceof Error ? e.message : 'Ошибка активации');
      }
    });
  }

  const copyInvoiceDetails = async () => {
    if (!b2bInvoiceCreated) return;
    const text = `Счёт на оплату № ${b2bInvoiceCreated.invoiceId.slice(-6).toUpperCase()}\nПлательщик: ${b2bInvoiceCreated.companyName} (ИНН ${b2bInvoiceCreated.inn})\nСумма: ${b2bInvoiceCreated.amountRub.toLocaleString('ru-RU')} ₽\nНазначение: Оплата информационно-технологических услуг по счёту ${b2bInvoiceCreated.invoiceId.slice(-6).toUpperCase()}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedInvoice(true);
      setTimeout(() => setCopiedInvoice(false), 2000);
    } catch {}
  };

  return (
    <div className="max-w-2xl space-y-6 animate-in fade-in duration-500">
      {/* Success Notification */}
      {isSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-400 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-sm">Баланс успешно пополнен!</h3>
            <p className="text-xs opacity-90 mt-0.5">Средства мгновенно зачислены на ваш счёт. Спасибо за доверие!</p>
          </div>
        </div>
      )}

      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Пополнение баланса</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Мгновенное зачисление без комиссии (0%)
        </p>
      </div>

      {/* Main Deposit Card */}
      <div className="bg-card border border-border/70 rounded-3xl p-6 sm:p-7 space-y-6 shadow-sm">
        
        {/* Amount Input & Presets */}
        <div className="space-y-3">
          <label htmlFor="top-up-amount" className="block text-sm font-bold text-foreground">
            Сумма пополнения (₽)
          </label>

          {/* Quick Presets Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {PRESETS.map(({ value, label }) => {
              const isSelected = amount === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handlePreset(value)}
                  className={`relative min-h-[46px] rounded-xl text-xs sm:text-sm font-bold border transition-all duration-200 flex items-center justify-center p-2 cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-[1.02]'
                      : 'bg-background text-foreground border-border hover:border-primary/40 hover:bg-secondary'
                  }`}
                  aria-pressed={isSelected}
                >
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Custom Input */}
          <div className="relative">
            <input
              ref={inputRef}
              type="number"
              id="top-up-amount"
              value={amount || ''}
              onChange={(e) => {
                const val = Number(e.target.value);
                setAmount(val);
                setError(null);
              }}
              min={10}
              max={10000000}
              placeholder="Введите сумму"
              aria-label="Сумма пополнения в рублях"
              className="w-full border border-border rounded-2xl px-4 py-3.5 text-xl font-mono font-bold text-foreground bg-background outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-lg">
              ₽
            </span>
          </div>
        </div>

        {/* Calculation Summary Card */}
        <div className="bg-secondary/40 border border-border/70 rounded-2xl p-4 sm:p-5 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="bg-background rounded-xl p-3 border border-border/60">
              <div className="text-xs text-muted-foreground">К оплате</div>
              <div className="text-lg font-black text-foreground font-mono mt-0.5">
                {amount.toLocaleString('ru-RU')} ₽
              </div>
            </div>

            <div className="bg-background rounded-xl p-3 border border-border/60">
              <div className="text-xs text-muted-foreground">Комиссия</div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                0% (0 ₽)
              </div>
            </div>

            <div className="bg-background rounded-xl p-3 border border-primary/40 shadow-xs">
              <div className="text-xs font-bold text-primary">К зачислению на баланс</div>
              <div className="text-xl font-black text-foreground font-mono mt-0.5">
                {amount.toLocaleString('ru-RU')} ₽
              </div>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-foreground">
            Способ оплаты
          </label>
          <div className="space-y-2.5">
            {METHODS.filter(({ id }) => {
              if (!availableGateways) return id === 'yookassa';
              if (id === 'yookassa') return Boolean(availableGateways.yookassa);
              if (id === 'cryptobot') return Boolean(availableGateways.cryptobot);
              if (id === 'robokassa') return Boolean(availableGateways.robokassa);
              if (id === 'b2b') return Boolean(availableGateways.b2b);
              return false;
            }).map(({ id, label, badge, badgeColor, icon: Icon, note }) => {
              const isSelected = method === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                      navigator.vibrate(20);
                    }
                    setMethod(id);
                    setError(null);
                  }}
                  className={`w-full flex items-start sm:items-center gap-3.5 px-4 py-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/5 text-foreground shadow-sm shadow-primary/10'
                      : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-secondary'
                  } focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none`}
                  aria-pressed={isSelected}
                  aria-label={`Выбрать способ оплаты ${label}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
                    isSelected ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30' : 'bg-secondary text-muted-foreground'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">{label}</span>
                      {badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor || 'bg-secondary text-muted-foreground border-border'}`}>
                          {badge}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{note}</div>

                    {/* Sub-chips for payment options clarity per ISO 9241-110 */}
                    {id === 'yookassa' && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md bg-secondary/80 text-foreground/80 border border-border/60">
                          💳 МИР / Visa / Mastercard
                        </span>
                        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          ⚡ СБП (0% комиссии)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 sm:mt-0 transition-colors ${
                    isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'
                  }`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-background" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* B2B Requisites Form (Conditional if B2B selected) */}
        {method === 'b2b' && (
          <div className="bg-secondary/40 border border-indigo-500/30 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
              <Building2 className="w-5 h-5" />
              <h3 className="text-sm font-bold">Реквизиты юридического лица / ИП</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Счёт на оплату и закрывающие документы УПД будут автоматически отправлены через ЭДО Диадок/СБИС или на email.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-foreground">Наименование компании или ИП *</label>
                <input
                  type="text"
                  value={b2bCompanyName}
                  onChange={(e) => setB2bCompanyName(e.target.value)}
                  placeholder='ООО "Диджитал Агентство" или ИП Иванов И.И.'
                  className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm bg-background text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">ИНН * (10 или 12 цифр)</label>
                <input
                  type="text"
                  value={b2bInn}
                  onChange={(e) => setB2bInn(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="7701234567"
                  className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm font-mono bg-background text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">КПП (для ООО)</label>
                <input
                  type="text"
                  value={b2bKpp}
                  onChange={(e) => setB2bKpp(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="770101001"
                  className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm font-mono bg-background text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-foreground">Юридический адрес</label>
                <input
                  type="text"
                  value={b2bLegalAddress}
                  onChange={(e) => setB2bLegalAddress(e.target.value)}
                  placeholder="г. Москва, ул. Ленина, д. 1"
                  className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm bg-background text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* B2B Generated Invoice Modal/Preview */}
        {b2bInvoiceCreated && (
          <div className="bg-card border-2 border-indigo-500/40 rounded-2xl p-5 space-y-4 shadow-lg animate-in zoom-in-95 duration-300">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded-full">
                  Счёт успешно сформирован
                </span>
                <h4 className="text-base font-black text-foreground mt-1">
                  Счёт № СЧ-{b2bInvoiceCreated.invoiceId.slice(-6).toUpperCase()}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground hover:bg-secondary cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Печать</span>
              </button>
            </div>

            <div className="text-xs space-y-1 text-muted-foreground bg-secondary/40 rounded-xl p-3 font-mono">
              <div><strong>Сумма к оплате:</strong> {b2bInvoiceCreated.amountRub.toLocaleString('ru-RU')} ₽</div>
              <div><strong>Плательщик:</strong> {b2bInvoiceCreated.companyName} (ИНН {b2bInvoiceCreated.inn})</div>
              <div><strong>Назначение:</strong> Оплата услуг по счёту СЧ-{b2bInvoiceCreated.invoiceId.slice(-6).toUpperCase()}</div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyInvoiceDetails}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 transition-all cursor-pointer"
              >
                {copiedInvoice ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedInvoice ? 'Скопировано!' : 'Скопировать реквизиты'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div className="text-sm font-bold text-destructive bg-destructive/10 border border-destructive/30 rounded-2xl px-4 py-3 animate-shake" role="alert">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          aria-label={`Перейти к оплате ${amount} рублей`}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50
            font-black min-h-[52px] py-4 rounded-2xl transition-all duration-200 shadow-lg shadow-primary/25 text-base
            focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none cursor-pointer flex items-center justify-center gap-2"
        >
          {isPending ? (
            <span>⟳ Подготовка платежа...</span>
          ) : method === 'b2b' ? (
            <>
              <FileText className="w-5 h-5" />
              <span>Выставить счёт на {amount.toLocaleString('ru-RU')} ₽</span>
            </>
          ) : (
            <span>Перейти к оплате {amount.toLocaleString('ru-RU')} ₽</span>
          )}
        </button>

        {/* Legal notice */}
        <p className="text-[11px] leading-relaxed text-muted-foreground text-center px-2">
          Нажимая «Перейти к оплате», вы принимаете{' '}
          <Link
            href="/legal/terms"
            target="_blank"
            className="text-primary hover:underline font-semibold"
          >
            Договор оферты
          </Link>{' '}
          и{' '}
          <Link
            href="/legal/refund"
            target="_blank"
            className="text-primary hover:underline font-semibold"
          >
            Политику возврата средств
          </Link>.
        </p>

        {/* Trust & Compliance Badges */}
        <div className="pt-4 border-t border-border/60 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> СБП и Карты РФ 0%
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Онлайн-чеки 54-ФЗ
          </span>
          <span className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-indigo-500" /> ЭДО Диадок / СБИС
          </span>
        </div>
      </div>

      {/* Promo Code Section */}
      <div className="bg-card border border-border/70 rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Подарочный промокод или ваучер</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Активируйте персональный купон для моментального пополнения баланса
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="PROMO-2026"
            className="w-full sm:flex-1 border border-border rounded-2xl px-4 py-3 text-sm font-mono font-bold uppercase text-foreground bg-background outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
          />
          <button
            type="button"
            onClick={handlePromoSubmit}
            disabled={isPromoPending || !promoCode.trim()}
            className="w-full sm:w-auto px-7 py-3 bg-foreground text-background hover:opacity-90 disabled:opacity-50 font-bold rounded-2xl transition-all duration-200 cursor-pointer text-sm"
          >
            {isPromoPending ? '...' : 'Применить'}
          </button>
        </div>

        {promoError && <p className="text-xs font-bold text-destructive">{promoError}</p>}
        {promoSuccess && (
          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {promoSuccess}
          </p>
        )}
      </div>
    </div>
  );
}
