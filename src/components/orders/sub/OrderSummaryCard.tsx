'use client';
// audit-disable STR-002

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Plus, Minus, Mail, Loader2, Clock, CheckCircle2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Wallet, CreditCard, Bitcoin, CheckSquare, Square
} from 'lucide-react';
import { ActionForm } from '@/components/admin/action-form';
import { DripFeedSettings } from '@/components/orders/DripFeedSettings';

interface OrderSummaryCardProps {
  userBalanceCents: number;
    engine: ReturnType<typeof import("@/hooks/useOrderEngine").useOrderEngine>;
}

const inputCls =
  'w-full rounded-xl border border-border bg-background text-foreground ' +
  'text-sm outline-none placeholder:text-muted-foreground ' +
  'focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200';

import { formatPricePerUnit } from '@/utils/format-price';

export function OrderSummaryCard({
  userBalanceCents = 0,
  engine
}: OrderSummaryCardProps) {
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    url, setUrl,
    selectedService,
    quantity, setQuantity,
    email, setEmail,
    promoCode, setPromoCode,
    dripFeedEnabled, setDripFeedEnabled,
    runs, setRuns,
    dripInterval, setDripInterval,
    isSmartDrip, setIsSmartDrip,
    smartDripDays, setSmartDripDays,
    isCalculating,
    totalPriceFormatted,
    validate,
    validationErrors,
    pricing,
    mediaGroupMultiplier,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    agreedToTerms, setAgreedToTerms
  } = engine;

  const [gateway, setGateway] = useState<'yookassa' | 'balance' | 'cryptobot'>('yookassa');
  const [showRequirementsModal, setShowRequirementsModal] = useState(false);
  const [requirementsConfirmed, setRequirementsConfirmed] = useState(false);
  const [modalRequirements, setModalRequirements] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const idempotencyKeyRef = useRef<string>('');
  const isFirstLoadRef = useRef<boolean>(true);

  const finalTotalCents = (pricing?.totalCents ?? 0) * (mediaGroupMultiplier ?? 1);
  const totalPrice = finalTotalCents / 100;
  const userBalanceRub = userBalanceCents / 100;

  useEffect(() => {
    idempotencyKeyRef.current = crypto.randomUUID();
  }, []);

  useEffect(() => {
    if (totalPrice > 0 && isFirstLoadRef.current) {
      if (userBalanceRub >= totalPrice) {
        setGateway('balance');
      } else {
        setGateway('yookassa');
      }
      isFirstLoadRef.current = false;
    }
  }, [totalPrice, userBalanceRub]);

  useEffect(() => {
    setRequirementsConfirmed(false);
        const reqs = (selectedService as unknown as { features?: { requirements?: string[] } })?.features?.requirements;
    if (reqs && Array.isArray(reqs) && reqs.length > 0) {
       setModalRequirements(reqs);
    } else {
       setModalRequirements([]);
    }
  }, [selectedService]);

  const handlePreSubmit = () => {
    if (submitting) return;

    if (isCalculating) {
      toast.warning("Пожалуйста, подождите, идёт расчёт стоимости заказа...", { id: "checkout-err" });
      return;
    }

    if (!pricing || finalTotalCents <= 0) {
      toast.error("Ошибка расчёта стоимости. Пожалуйста, проверьте количество.", { id: "checkout-err" });
      return;
    }

    if (!selectedService) {
      toast.error("Пожалуйста, сначала выберите тариф/услугу из каталога ниже ↓", { id: "checkout-err" });
      document.getElementById("catalog-section")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (quantity < selectedService.minQty) {
      toast.error(`Минимальный заказ для выбранного тарифа: ${selectedService.minQty} шт.`, { id: "checkout-err" });
      return;
    }
    if (quantity > selectedService.maxQty) {
      toast.error(`Максимальный заказ для выбранного тарифа: ${selectedService.maxQty} шт.`, { id: "checkout-err" });
      return;
    }
    if (!url.trim()) {
      toast.error("Пожалуйста, укажите ссылку для продвижения.", { id: "checkout-err" });
      document.getElementById("order-url")?.focus();
      return;
    }

    const sName = selectedService.name.toLowerCase();
    const cType = selectedService.customDataType;
    const needsPayload = (cType && cType !== 'NONE') || sName.includes('свои') || sName.includes('свой текст') || sName.includes('ключево') || (sName.includes('опрос') && !sName.includes('просмотр')) || sName.includes('голосование');
    if (needsPayload && !engine.customData.trim()) {
      toast.error("Пожалуйста, заполните необходимые дополнительные данные для выбранного тарифа.", { id: "checkout-err" });
      return;
    }

    if (!validate(true)) {
      toast.error("Пожалуйста, проверьте правильность введённых данных.", { id: "checkout-err" });
      return;
    }

    if (modalRequirements.length > 0 && !requirementsConfirmed) {
      setShowRequirementsModal(true);
    } else {
      formRef.current?.requestSubmit();
    }
  };

  const confirmRequirementsAndSubmit = () => {
    if (submitting) return;
    setRequirementsConfirmed(true);
    setShowRequirementsModal(false);
    setTimeout(() => {
       formRef.current?.requestSubmit();
    }, 50);
  };


  const handleAction = async () => {
    if (submitting) return { error: 'Заказ уже обрабатывается' };
    setSubmitting(true);
    try {
      // 1. Adaptive validation block
      const sName = selectedService?.name.toLowerCase() || "";
      const cType = selectedService?.customDataType;
      const isCustomComments = cType === 'TEXTAREA' || sName.includes('свои') || sName.includes('свой текст');
      const isKeywords = sName.includes('ключево');
      const isPoll = cType === 'NUMBER' || (sName.includes('опрос') && !sName.includes('просмотр')) || sName.includes('голосование');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const isLiveStream = sName.includes('зрител') || sName.includes('эфир');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const isPrivateChannel = sName.includes('закрыт');

      const needsPayload = isCustomComments || isKeywords || isPoll;
      if (needsPayload && !engine.customData.trim()) {
        return { error: 'Пожалуйста, заполните необходимые данные для этой услуги' };
      }

      if (!validate()) return { error: 'Проверьте правильность введённых данных' };
      if (!selectedService) return { error: 'Выберите услугу' };

      const { checkoutAction } = await import('@/actions/order/checkout');
      const res = await checkoutAction({
        serviceId: selectedService.id,
        link: url,
        quantity,
        email,
        runs:     dripFeedEnabled ? runs     : undefined,
        interval: dripFeedEnabled ? dripInterval : undefined,
        customData: engine.customData || undefined,
        promoCodeStr: promoCode || undefined,
        gateway,
        idempotencyKey: idempotencyKeyRef.current,
      });

      if (res.success) {
        if (res.data?.paymentUrl) {
          window.location.href = res.data.paymentUrl;
        } else if (res.data?.orderId) {
          window.location.href = `/success?orderId=${res.data.orderId}`;
        } else if (res.data?.paymentId) {
          window.location.href = `/success?paymentId=${res.data.paymentId}`;
        }
        return res;
      }
      
      if (!res.success) {
        if (res.error?.startsWith('VOUCHER_USE_BALANCE:')) {
          toast.error(
            'Это ваучер на пополнение баланса. Перейдите в раздел «Мой баланс» для активации.',
            {
              position: 'top-center',
              duration: 6000,
              action: {
                label: 'Мой баланс',
                onClick: () => window.location.href = '/dashboard/add-funds'
              }
            }
          );
          return { ...res, error: undefined }; // Prevent ActionForm from showing a second toast
        } else {
          const errorMessage = res.error || "Ошибка создания заказа. Попробуйте снова.";
          window.location.href = `/support/payment-error?error=${encodeURIComponent(errorMessage)}&serviceId=${selectedService.id}&gateway=${gateway}&email=${encodeURIComponent(email)}&quantity=${quantity}&url=${encodeURIComponent(url)}`;
          return { success: false, error: undefined };
        }
      }

      return res;
        } catch (e: unknown) {
      const err = e as Error;
      const errorMessage = err.message || "Ошибка платежного шлюза.";
      window.location.href = `/support/payment-error?error=${encodeURIComponent(errorMessage)}&serviceId=${selectedService?.id || ''}&gateway=${gateway}&email=${encodeURIComponent(email)}&quantity=${quantity}&url=${encodeURIComponent(url)}`;
      return { success: false, error: undefined };
    } finally {
      setSubmitting(false);
    }
  };

  if (!selectedService) {
    return (
      <div className="hidden lg:block bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-8 space-y-6 lg:sticky lg:top-6 shadow-sm transition-all duration-300">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-[9px] font-black uppercase tracking-widest">
            ✨ Панель управления
          </div>
          <h3 className="text-base font-extrabold text-foreground tracking-tight">Мастер оформления заказа</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Добро пожаловать в интеллектуальную систему заказов SMMplan. Мы упростили процесс до трёх простых шагов.
          </p>
        </div>

        <div className="h-px bg-border/50" />

        {/* Steps Guide */}
        <div className="space-y-4">
          {[
            { step: '1', title: 'Укажите ссылку', desc: 'Вставьте ссылку на ваш канал, группу или публикацию. Система сама определит социальную сеть.' },
            { step: '2', title: 'Выберите тариф', desc: 'Кликните по любой карточке тарифа слева. Обращайте внимание на скорость и гарантию.' },
            { step: '3', title: 'Подтвердите параметры', desc: 'Укажите количество, введите промокод при наличии и выберите удобный способ оплаты.' }
          ].map((s, idx) => (
            <div key={idx} className="flex gap-4 group">
              <div className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-black flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                {s.step}
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground block tracking-wide">{s.title}</span>
                <span className="text-[11px] text-muted-foreground leading-relaxed block">{s.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="h-px bg-border/50" />

        {/* Safe Block */}
        <div className="p-4 bg-primary/5 border border-primary/15 rounded-xl space-y-2">
          <span className="text-xs font-bold text-primary block">🛡️ Безопасность и гарантии</span>
          <ul className="space-y-1.5 text-[11px] text-muted-foreground list-disc pl-3.5 leading-relaxed font-medium">
            <li><strong>3D-Secure 2.0</strong>: Все транзакции картами надежно защищены шифрованием.</li>
            <li><strong>Автозапуск</strong>: Заказы уходят в работу автоматически сразу после успешного платежа.</li>
            <li><strong>Защита Escrow</strong>: Возврат неиспользованного баланса за отмененные заказы на ваш кошелек.</li>
          </ul>
        </div>

        {/* Monochromatic trusted badges */}
        <div className="flex items-center justify-between gap-2 px-2 flex-wrap pt-2 opacity-50">
          {['МИР', 'СБП', 'ЮKassa', 'Visa', 'MasterCard', 'Crypto'].map((logo, i) => (
            <span key={i} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground select-none">{logo}</span>
          ))}
        </div>
      </div>
    );
  }

  const sName = selectedService.name.toLowerCase();
  const cType = selectedService.customDataType;
  const isCustomComments = cType === 'TEXTAREA' || sName.includes('свои') || sName.includes('свой текст');
  const isKeywords = cType === 'TEXT' || sName.includes('ключево');
  const isPoll = cType === 'NUMBER' || (sName.includes('опрос') && !sName.includes('просмотр')) || sName.includes('голосование');
  const isLiveStream = sName.includes('зрител') || sName.includes('эфир');
  const isPrivateChannel = sName.includes('закрыт');
  const customFieldLabel = selectedService?.customDataLabel?.trim() || (
    isCustomComments ? 'Ваши комментарии (по одному в строке)' 
    : isKeywords ? 'Ключевые слова (через запятую)' 
    : isPoll ? 'Номер варианта ответа' 
    : null
  );

  return (
    <>
      <div className="bg-card shadow-sm ring-1 ring-border rounded-2xl p-4 sm:p-6 space-y-6 lg:sticky lg:top-6">
        <ActionForm action={handleAction} className="space-y-5" formRef={formRef}>
          {/* Selected service badge */}
          <div className="bg-muted ring-1 ring-border rounded-xl p-4">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Выбрано</div>
            <div className="text-sm font-semibold text-foreground line-clamp-2">{selectedService.name}</div>
          </div>

          {/* SECTION: DYNAMIC PAYLOAD & WARNINGS */}
          <div className="space-y-4">
            {/* Warnings */}
            {isLiveStream && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold p-3 rounded-lg flex items-start gap-2">
                <span className="text-base leading-none">⚡</span>
                Внимание! Услуга только для запущенного стрима. Если стрим прервется — гарантия сгорает.
              </div>
            )}
            {isPrivateChannel && (
              <div className="bg-warning/10 border border-warning/20 text-warning-text text-xs font-bold p-3 rounded-lg flex items-start gap-2">
                <span className="text-base leading-none">⚠️</span>
                Услуга для закрытых каналов. В поле "Ссылка" указывайте только пригласительную ссылку (t.me/+...).
              </div>
            )}

            {/* Inputs */}
            {isCustomComments && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  {customFieldLabel}
                </label>
                <textarea
                  value={engine.customData}
                  onChange={e => engine.setCustomData(e.target.value)}
                  placeholder="Супер!\nОтличное видео!\nСогласен."
                  className={`${inputCls} text-base min-h-[100px] py-3 px-4 resize-y`}
                  required
                />
              </div>
            )}
            {(isKeywords || isPoll) && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  {customFieldLabel}
                </label>
                <input
                  type="text"
                  value={engine.customData}
                  onChange={e => engine.setCustomData(e.target.value)}
                  placeholder={isPoll ? "Например: 2" : "блог, новости, инвестиции"}
                  inputMode={isPoll ? "numeric" : "text"}
                  className={`${inputCls} text-base h-12 px-4`}
                  required
                />
              </div>
            )}
          </div>

          {/* Quantity stepper */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Количество
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(selectedService.minQty, quantity - 100))}
                aria-label={`Уменьшить количество до ${Math.max(selectedService.minQty, quantity - 100)}`}
                className="min-w-[44px] min-h-[44px] p-3 bg-background border border-border rounded-xl hover:bg-muted transition-all duration-200 shrink-0 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
              >
                <Minus className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={quantity || ''}
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, '');
                  setQuantity(raw ? parseInt(raw, 10) : 0);
                }}
                aria-label="Количество"
                inputMode="numeric"
                pattern="[0-9]*"
                onFocus={(e) => {
                  const target = e.currentTarget;
                  setTimeout(() => target.select(), 10);
                }}
                onClick={(e) => {
                  const target = e.currentTarget;
                  setTimeout(() => target.select(), 10);
                }}
                className={`${inputCls} h-12 text-center font-black text-slate-900 tabular-nums font-mono text-lg focus-visible:ring-2 focus-visible:ring-sky-500/50 focus-visible:outline-none placeholder:font-normal`}
              />
              <button
                type="button"
                onClick={() => setQuantity(quantity + 100)}
                aria-label={`Увеличить количество до ${quantity + 100}`}
                className="min-w-[44px] min-h-[44px] p-3 bg-background border border-border rounded-xl hover:bg-muted transition-all duration-200 shrink-0 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
              Мин: {selectedService.minQty.toLocaleString('ru-RU')}
            </div>
            {validationErrors.quantity && (
              <p className="text-xs text-destructive font-semibold mt-1">{validationErrors.quantity}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Email (для уведомления)
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                inputMode="email"
                readOnly={gateway === 'balance'}
                aria-label="Email для уведомлений о заказе"
                className={`${inputCls} text-base pl-10 h-11 transition-all duration-200 ${
                gateway === 'balance' ? 'bg-muted/60 text-muted-foreground cursor-not-allowed select-none border-success/20' : ''
              }`}
              placeholder="your@email.com"
            />
          </div>
          {gateway === 'balance' && (
            <p className="text-[10px] text-success-text font-bold mt-1.5 flex items-center gap-1 animate-in fade-in duration-200">
                <span>🔒</span> Зафиксировано для оплаты с баланса вашего аккаунта
              </p>
            )}
          </div>

          {/* Promo Code */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Промокод
            </label>
            <div className="relative">
              <input
                value={promoCode}
                onChange={e => setPromoCode(e.target.value.toUpperCase())}
                type="text"
                aria-label="Промокод"
                className={`${inputCls} text-base px-4 h-11 uppercase font-mono tracking-wider`}
                placeholder="WINTER2026"
              />
            </div>
          </div>

          {/* Drip feed */}
          <DripFeedSettings
            enabled={dripFeedEnabled}
            setEnabled={(val) => {
              setDripFeedEnabled(val);
              if (val) {
                setIsSmartDrip(false);
              }
            }}
            runs={runs}
            setRuns={setRuns}
            interval={dripInterval}
            setInterval={setDripInterval}
          />
          {dripFeedEnabled && validationErrors?.dripfeed && (
            <p className="text-xs text-destructive font-semibold mt-1">{validationErrors.dripfeed}</p>
          )}

          {/* Smart Drip feed */}
          {selectedService?.smartConfig?.isEnabled && (
            <div className="p-4 bg-primary/5 border border-primary/25 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-foreground flex items-center gap-1.5 select-none">
                    🤖 Растянуть доставку (Smart Drip)
                  </span>
                  <span className="text-[10px] text-muted-foreground block select-none">
                    Случайными порциями по плавному графику (+{Math.round(selectedService.smartConfig.markup * 100)}% к цене)
                  </span>
                </div>
                <div className="w-11 h-11 flex items-center justify-end shrink-0">
                  <input 
                    type="checkbox"
                    checked={isSmartDrip}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsSmartDrip(checked);
                      if (checked) {
                        setDripFeedEnabled(false); // Reset normal dripfeed
                      }
                    }}
                    className="w-5 h-5 accent-primary rounded cursor-pointer"
                    aria-label="Включить Smart Drip"
                  />
                </div>
              </div>

              {isSmartDrip && (
                <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                    <span>Период распределения:</span>
                    <span className="text-primary font-bold">{smartDripDays} дней</span>
                  </div>
                  <div className="flex gap-2">
                    {[3, 7, 14, 30].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSmartDripDays(d)}
                        aria-label={`${d} дней`}
                        className={`flex-1 h-11 rounded-lg text-xs font-bold border transition-all flex items-center justify-center ${
                          smartDripDays === d 
                            ? 'border-primary bg-primary/10 text-primary shadow-xs' 
                            : 'border-border bg-background text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {d === 7 ? `${d}д (Реком.)` : `${d}д`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {isSmartDrip && validationErrors?.dripfeed && (
            <p className="text-xs text-destructive font-semibold mt-1">{validationErrors.dripfeed}</p>
          )}

          {/* Price */}
          <div className="border-t border-border pt-5 flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Итого к оплате
            </span>
            <div className="text-right">
              <span className="text-3xl font-black text-foreground tabular-nums font-mono tracking-tight">
                {totalPriceFormatted}
              </span>
              <span className="text-lg font-black text-muted-foreground ml-1">₽</span>
              {isCalculating && (
                <div className="text-[10px] text-primary font-bold uppercase tracking-wider">Считаем...</div>
              )}
            </div>
          </div>

          {/* Gateway Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Способ оплаты
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setGateway('yookassa')}
                className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 p-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                  gateway === 'yookassa'
                    ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                <CreditCard className="w-4 h-4" /> СБП / Карта
              </button>
              <button
                type="button"
                onClick={() => setGateway('balance')}
                className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 p-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                  gateway === 'balance'
                    ? 'border-success/30 bg-success/10 text-success-text shadow-sm ring-1 ring-success/20'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                <Wallet className="w-4 h-4" /> Баланс
              </button>
              <button
                type="button"
                onClick={() => setGateway('cryptobot')}
                className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 p-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                  gateway === 'cryptobot'
                    ? 'border-warning/30 bg-warning/10 text-warning-text shadow-sm ring-1 ring-warning/20'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                <Bitcoin className="w-4 h-4" /> Крипто
              </button>
            </div>
          </div>

          {gateway !== 'balance' && totalPrice > 0 && totalPrice < 10 && (
            <div className="p-4 rounded-2xl bg-warning/10 border border-warning/20 text-warning-text text-xs leading-relaxed space-y-2 animate-in fade-in duration-300">
              <div className="font-bold flex items-center gap-1.5 text-warning-text">
                <span>💡</span> Минимальный платеж эквайринга — 10 ₽
              </div>
              <div>
                Платежные системы технически не принимают оплату картой менее 10 ₽. 
                Мы выставим счет на <strong>10 ₽</strong>: 
                из них <strong>{totalPriceFormatted} ₽</strong> пойдет на этот заказ, а сдача <strong>{(10 - totalPrice).toFixed(2)} ₽</strong> будет зачислена на ваш баланс для будущих тестов.
              </div>
            </div>
          )}

          {/* Bottom Bar - Static to prevent overlap */}
          <div className="pt-2">
            {/* Submit */}
            <div className={gateway === 'balance' && userBalanceRub >= totalPrice ? 'emerald-light' : ''}>
              <button
                type="button"
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(50);
                  handlePreSubmit();
                }}
                disabled={submitting}
                className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black text-base hover:scale-[1.01] active:scale-[0.99] hover:shadow-lg disabled:opacity-50 disabled:pointer-events-none disabled:hover:shadow-none transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Оформляем...
                  </>
                ) : (
                  <>
                    Оплатить заказ
                    <span className="opacity-70 font-semibold text-xs bg-black/10 px-2 py-0.5 rounded-full shrink-0">
                      {totalPriceFormatted} ₽
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Consent */}
            <div className="text-[10px] text-center text-muted-foreground mt-2 leading-relaxed select-none px-2">
              Нажимая кнопку «Оплатить заказ», вы соглашаетесь с{' '}
              <Link href="/legal/terms" className="underline hover:text-foreground font-semibold" target="_blank">
                Договором публичной оферты
              </Link>{' '}
              и даете согласие на обработку данных согласно{' '}
              <Link href="/legal/privacy" className="underline hover:text-foreground font-semibold" target="_blank">
                Политике конфиденциальности
              </Link>.
            </div>
          </div>
        </ActionForm>
      </div>

      {/* Requirements Modal */}
      {showRequirementsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-warning">
              <span className="text-xl">⚠️</span>
              <h3 className="font-bold text-lg text-foreground">Важные требования</h3>
            </div>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Для успешного выполнения заказа необходимо соблюдать следующие условия:</p>
              <ul className="list-disc pl-5 space-y-1 font-semibold text-foreground">
                {modalRequirements.map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
              <p className="text-xs text-destructive font-bold mt-2">
                * Запуск заказа при несоблюдении правил аннулирует гарантию возврата средств!
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRequirementsModal(false)}
                className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-all duration-200 cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={confirmRequirementsAndSubmit}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/95 transition-all duration-200 cursor-pointer"
              >
                Я согласен, запустить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
