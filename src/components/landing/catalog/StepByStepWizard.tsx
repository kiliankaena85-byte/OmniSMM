'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Share2,
  Camera,
  Video,
  PlaySquare,
  Radio,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Flame,
  Wallet,
  CreditCard,
  QrCode,
  AlertCircle,
} from 'lucide-react';
import {
  getSocialLinkConfig,
  normalizeUserLink,
  detectMismatchedNetwork,
} from '@/utils/social-link-placeholder';
import { ALL_PLATFORMS, CatalogPlatform, CatalogCategory, CatalogServiceItem } from './FullscreenMasterCatalog';

export function StepByStepWizard({
  onCompleteOrder,
  userBalanceCents = 0
}: {
  onCompleteOrder?: (orderData: {
    platform: string;
    category: string;
    service: CatalogServiceItem;
    targetUrl: string;
    quantity: number;
    paymentMethod: string;
  }) => void;
  userBalanceCents?: number;
}) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedPlatform, setSelectedPlatform] = useState<CatalogPlatform>(ALL_PLATFORMS[0]);
  const [selectedCategory, setSelectedCategory] = useState<CatalogCategory>(ALL_PLATFORMS[0].categories[0]);
  const [selectedService, setSelectedService] = useState<CatalogServiceItem>(
    ALL_PLATFORMS[0].categories[0].services[0]
  );

  // Step 4 Form State
  const [targetUrl, setTargetUrl] = useState('');
  const [quantity, setQuantity] = useState(500);
  const [paymentMethod, setPaymentMethod] = useState<'sbp' | 'card' | 'crypto' | 'balance'>('sbp');
  const [availableGateways, setAvailableGateways] = useState<{
    yookassa: boolean;
    sbp?: boolean;
    robokassa: boolean;
    cryptobot: boolean;
  } | null>(null);

  useEffect(() => {
    import('@/actions/order/checkout').then(({ getAvailableGatewaysAction }) => {
      getAvailableGatewaysAction().then((res) => {
        if (res.success && res.data) {
          setAvailableGateways(res.data);
          const data = res.data;
          const isCurrentActive =
            (paymentMethod === 'sbp' && data.yookassa) ||
            (paymentMethod === 'card' && data.yookassa) ||
            (paymentMethod === 'crypto' && data.cryptobot);

          if (!isCurrentActive) {
            if (data.yookassa) setPaymentMethod('sbp');
            else if (data.cryptobot) setPaymentMethod('crypto');
          }
        }
      });
    });
  }, [paymentMethod]);

  // Price calculations
  const pricePerUnitNumeric = parseFloat(selectedService.pricePerUnit.replace(/[^0-9.]/g, '')) || 0.18;
  const totalPrice = (quantity * pricePerUnitNumeric).toFixed(2);

  const steps = [
    { num: 1, title: 'Соцсеть', desc: selectedPlatform.name },
    { num: 2, title: 'Категория', desc: selectedCategory.title },
    { num: 3, title: 'Тариф', desc: selectedService.title.slice(0, 18) + '...' },
    { num: 4, title: 'Оплата', desc: `${totalPrice} ₽` },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* ── Step Progress Indicator ── */}
      <div className="p-4 sm:p-5 rounded-3xl bg-card border border-border/80 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {steps.map((s) => {
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;

            return (
              <button
                key={s.num}
                type="button"
                disabled={s.num > currentStep}
                onClick={() => setCurrentStep(s.num as 1 | 2 | 3 | 4)}
                className={`flex items-center gap-3 p-3 min-h-[44px] rounded-2xl border text-left transition-all duration-200 ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : isCompleted
                    ? 'bg-muted/40 text-foreground border-border hover:bg-muted cursor-pointer'
                    : 'bg-transparent text-muted-foreground border-transparent opacity-50 cursor-not-allowed'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                    isCurrent
                      ? 'bg-primary-foreground text-primary'
                      : isCompleted
                      ? 'bg-emerald-500/20 text-emerald-500'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <div className="truncate">
                  <div className="text-xs font-black leading-tight tracking-tight">{s.title}</div>
                  <div className="text-[11px] opacity-80 truncate">{s.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Wizard Body Container ── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-card border border-border/80 shadow-sm min-h-[420px] flex flex-col justify-between">
        <AnimatePresence mode="wait">
          {/* ── STEP 1: Выбор социальной сети ── */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  Шаг 1: Выберите социальную сеть
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Выберите целевую платформу для запуска продвижения
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ALL_PLATFORMS.map((platform) => {
                  const isSelected = platform.id === selectedPlatform.id;
                  const Icon = platform.icon;

                  return (
                    <button
                      key={platform.id}
                      type="button"
                      className={`flex items-center gap-3.5 p-4 min-h-[44px] rounded-2xl border text-left transition-all duration-200 group hover:shadow-md ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border bg-card hover:border-primary/40'
                      }`}
                      onClick={() => {
                        setSelectedPlatform(platform);
                        if (platform.categories.length > 0) {
                          setSelectedCategory(platform.categories[0]);
                          if (platform.categories[0].services.length > 0) {
                            setSelectedService(platform.categories[0].services[0]);
                          }
                        }
                        setCurrentStep(2);
                      }}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-tr ${platform.color} text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform`}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                      </div>
                      <div className="truncate min-w-0">
                        <div className="font-extrabold text-foreground text-sm sm:text-base tracking-tight">
                          {platform.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {platform.categories.length} категорий
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: Выбор категории ── */}
          {currentStep === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    Шаг 2: Выберите категорию ({selectedPlatform.name})
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Какое целевое действие вам требуется?
                  </p>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 min-h-[44px] px-3 text-xs font-bold text-muted-foreground hover:text-foreground"
                  onClick={() => setCurrentStep(1)}
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  Назад
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedPlatform.categories.map((cat) => {
                  const isSelected = cat.id === selectedCategory.id;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`flex items-center justify-between p-4 sm:p-5 min-h-[44px] rounded-2xl border text-left transition-all duration-200 group hover:shadow-md ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border bg-card hover:border-primary/40'
                      }`}
                      onClick={() => {
                        setSelectedCategory(cat);
                        if (cat.services.length > 0) {
                          setSelectedService(cat.services[0]);
                        }
                        setCurrentStep(3);
                      }}
                    >
                      <div className="space-y-1 truncate">
                        <div className="font-extrabold text-foreground text-sm sm:text-base tracking-tight">
                          {cat.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {cat.services.length} доступных тарифов
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: Выбор тарифа ── */}
          {currentStep === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    Шаг 3: Выберите подходящий тариф
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {selectedPlatform.name} • {selectedCategory.title}
                  </p>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 min-h-[44px] px-3 text-xs font-bold text-muted-foreground hover:text-foreground"
                  onClick={() => setCurrentStep(2)}
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  Назад
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedCategory.services.map((srv) => {
                  const isSelected = srv.id === selectedService.id;

                  return (
                    <div
                      key={srv.id}
                      onClick={() => {
                        setSelectedService(srv);
                        setCurrentStep(4);
                      }}
                      className={`flex flex-col justify-between p-5 min-h-[44px] rounded-2xl border cursor-pointer transition-all duration-200 group hover:shadow-lg ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border bg-card hover:border-primary/40'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-extrabold text-foreground text-sm sm:text-base tracking-tight">
                            {srv.title}
                          </h3>
                          {srv.badge && (
                            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">
                              {srv.badge}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div>• {srv.speed}</div>
                          <div>• {srv.guarantee}</div>
                          <div>• {srv.minMax}</div>
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                            Цена
                          </span>
                          <span className="text-base font-black text-foreground font-mono tabular-nums">
                            {srv.pricePerUnit}
                          </span>
                        </div>
                        <span className="px-3.5 py-2 min-h-[44px] flex items-center text-xs font-bold bg-primary text-primary-foreground rounded-xl shadow-sm">
                          Выбрать →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── STEP 4: Ввод ссылки, объема и моментальная оплата ── */}
          {currentStep === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    Шаг 4: Оформление и оплата
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {selectedPlatform.name} • {selectedService.title} ({selectedService.pricePerUnit})
                  </p>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 min-h-[44px] px-3 text-xs font-bold text-muted-foreground hover:text-foreground"
                  onClick={() => setCurrentStep(3)}
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  Назад к тарифам
                </button>
              </div>

              <div className="space-y-4">
                {/* Ссылка */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      Ссылка для заказа:
                      {(() => {
                        const cfg = getSocialLinkConfig(selectedPlatform.id, selectedCategory?.id, selectedService?.title);
                        return cfg.badge ? (
                          <span className="text-[10px] lowercase font-bold px-2 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {cfg.badge}
                          </span>
                        ) : null;
                      })()}
                    </label>
                  </div>
                  {(() => {
                    const cfg = getSocialLinkConfig(selectedPlatform.id, selectedCategory?.id, selectedService?.title);
                    const mismatch = detectMismatchedNetwork(targetUrl, selectedPlatform.id);

                    return (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={targetUrl}
                          onChange={(e) => setTargetUrl(e.target.value)}
                          onBlur={(e) => setTargetUrl(normalizeUserLink(e.target.value))}
                          placeholder={cfg.placeholder}
                          className={`w-full px-4 py-3 rounded-2xl bg-muted/50 border text-foreground font-medium text-sm focus:outline-none transition-all ${
                            mismatch.isMismatch
                              ? 'border-amber-500/80 focus:ring-2 focus:ring-amber-500/30'
                              : 'border-border focus:ring-2 focus:ring-primary/40'
                          }`}
                        />
                        {mismatch.isMismatch ? (
                          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium px-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Внимание: ссылка на <strong>{mismatch.detectedNetworkName}</strong>, хотя выбран сервис <strong>{mismatch.expectedNetworkName}</strong>.
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground font-medium px-1">
                            💡 {cfg.hint}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Количество */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Количество:
                    </label>
                    <span className="font-mono font-black text-foreground text-sm tabular-nums">
                      {quantity} шт
                    </span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={10000}
                    step={100}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
                  />
                </div>

                {/* Выбор платежного шлюза */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Способ оплаты:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {userBalanceCents > 0 && (
                      <button
                        type="button"
                        className={`p-3 min-h-[44px] rounded-2xl border text-left transition-all cursor-pointer ${
                          paymentMethod === 'balance'
                            ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                            : 'border-border bg-card hover:border-border/80'
                        }`}
                        onClick={() => setPaymentMethod('balance')}
                      >
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="font-bold text-xs">Мой баланс</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          {(userBalanceCents / 100).toFixed(2)} ₽
                        </span>
                      </button>
                    )}

                    {(!availableGateways || availableGateways.yookassa) && (
                      <button
                        type="button"
                        className={`p-3 min-h-[44px] rounded-2xl border text-left transition-all cursor-pointer ${
                          paymentMethod === 'sbp'
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-border bg-card hover:border-border/80'
                        }`}
                        onClick={() => setPaymentMethod('sbp')}
                      >
                        <div className="flex items-center gap-2">
                          <QrCode className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-bold text-xs">СБП / QR</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">0% комиссии</span>
                      </button>
                    )}

                    {(!availableGateways || availableGateways.yookassa) && (
                      <button
                        type="button"
                        className={`p-3 min-h-[44px] rounded-2xl border text-left transition-all cursor-pointer ${
                          paymentMethod === 'card'
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-border bg-card hover:border-border/80'
                        }`}
                        onClick={() => setPaymentMethod('card')}
                      >
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-bold text-xs">Карта РФ</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">МИР / Visa / MC</span>
                      </button>
                    )}

                    {(!availableGateways || availableGateways.cryptobot) && (
                      <button
                        type="button"
                        className={`p-3 min-h-[44px] rounded-2xl border text-left transition-all cursor-pointer ${
                          paymentMethod === 'crypto'
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-border bg-card hover:border-border/80'
                        }`}
                        onClick={() => setPaymentMethod('crypto')}
                      >
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-bold text-xs">Crypto</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">USDT / TON / BTC</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Total & Submit Button */}
                <div className="pt-4 border-t border-border/80 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Итого к оплате
                    </span>
                    <span className="text-2xl font-black text-foreground font-mono tabular-nums tracking-tight">
                      {totalPrice} ₽
                    </span>
                  </div>

                  <button
                    type="button"
                    className="px-6 py-3.5 min-h-[48px] text-sm font-bold bg-primary text-primary-foreground rounded-2xl shadow-lg shadow-primary/25 hover:opacity-95 active:scale-98 transition-all"
                    onClick={() => {
                      onCompleteOrder?.({
                        platform: selectedPlatform.name,
                        category: selectedCategory.title,
                        service: selectedService,
                        targetUrl,
                        quantity,
                        paymentMethod,
                      });
                    }}
                  >
                    Оплатить заказ →
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
