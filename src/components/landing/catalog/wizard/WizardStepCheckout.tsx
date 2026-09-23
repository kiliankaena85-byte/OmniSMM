'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import {
  getSocialLinkConfig,
  normalizeUserLink,
  detectMismatchedNetwork,
} from '@/utils/social-link-placeholder';
import { CatalogPlatform, CatalogCategory, CatalogServiceItem } from '../catalog-data';
import { WizardPaymentGateways, type PaymentMethodType } from './WizardPaymentGateways';
export type { PaymentMethodType };

interface GatewaysConfig {
  yookassa: boolean;
  sbp?: boolean;
  robokassa: boolean;
  cryptobot: boolean;
}

interface WizardStepCheckoutProps {
  platform: CatalogPlatform;
  category: CatalogCategory;
  service: CatalogServiceItem;
  targetUrl: string;
  setTargetUrl: (url: string) => void;
  quantity: number;
  setQuantity: (qty: number) => void;
  paymentMethod: PaymentMethodType;
  setPaymentMethod: (method: PaymentMethodType) => void;
  availableGateways: GatewaysConfig | null;
  userBalanceCents: number;
  totalPrice: string;
  onBack: () => void;
  onSubmit: () => void;
}

export function WizardStepCheckout({
  platform,
  category,
  service,
  targetUrl,
  setTargetUrl,
  quantity,
  setQuantity,
  paymentMethod,
  setPaymentMethod,
  availableGateways,
  userBalanceCents,
  totalPrice,
  onBack,
  onSubmit,
}: WizardStepCheckoutProps) {
  const cfg = getSocialLinkConfig(platform.id, category?.id, service?.title);
  const mismatch = detectMismatchedNetwork(targetUrl, platform.id);

  return (
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
            {platform.name} • {service.title} ({service.pricePerUnit})
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 min-h-[44px] px-3 text-xs font-bold text-muted-foreground hover:text-foreground"
          onClick={onBack}
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
              {cfg.badge && (
                <span className="text-[10px] lowercase font-bold px-2 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {cfg.badge}
                </span>
              )}
            </label>
          </div>
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

        {/* Выбор способа оплаты */}
        <WizardPaymentGateways
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          availableGateways={availableGateways}
          userBalanceCents={userBalanceCents}
        />

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
            onClick={onSubmit}
          >
            Оплатить заказ →
          </button>
        </div>
      </div>
    </motion.div>
  );
}
