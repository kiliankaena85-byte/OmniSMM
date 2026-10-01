'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Edit3, CheckCircle2 } from 'lucide-react';
import { DrawerPaymentSelector } from '../../drawer/DrawerPaymentSelector';
import { LegalCheckbox } from '../../LegalCheckbox';
import { PublicService } from '@/actions/order/catalog';
import { OrderEngine } from '@/hooks/useOrderEngine';

interface StepWizardPaymentStepProps {
  gateway: 'yookassa' | 'cryptobot' | 'balance';
  setGateway: (gateway: 'yookassa' | 'cryptobot' | 'balance') => void;
  userBalanceCents?: number;
  totalCents: number;
  email: string;
  setEmail: (email: string) => void;
  emailHasError?: boolean;
  selectedService: PublicService;
  quantity: number;
  url: string;
  termsHasError?: boolean;
  engine: OrderEngine;
  onOpenDocument?: (slug: string) => void;
}

export function StepWizardPaymentStep({
  gateway,
  setGateway,
  userBalanceCents,
  totalCents,
  email,
  setEmail,
  emailHasError,
  selectedService,
  quantity,
  url,
  termsHasError,
  engine,
  onOpenDocument,
}: StepWizardPaymentStepProps) {
  const [isEditingEmail, setIsEditingEmail] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="space-y-3"
    >
      <DrawerPaymentSelector
        gateway={gateway}
        setGateway={setGateway}
        userBalanceCents={userBalanceCents}
        totalCents={totalCents}
      />

      {/* Step 3: Explicit Email Input Card (54-FZ Compliant) */}
      <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-primary" />
            <span>Email для отслеживания</span>
            <span className="text-destructive">*</span>
          </label>
          {email && email.includes('@') && !isEditingEmail ? (
            <button
              type="button"
              onClick={() => setIsEditingEmail(true)}
              className="text-[11px] text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" /> Изменить
            </button>
          ) : null}
        </div>

        {!email || isEditingEmail ? (
          <motion.div
            animate={emailHasError ? { x: [0, -6, 6, -6, 6, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="relative"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => {
                if (email && email.includes('@')) {
                  setIsEditingEmail(false);
                }
              }}
              placeholder="name@example.com"
              className={`w-full h-11 px-3.5 rounded-xl border bg-background text-sm font-bold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                emailHasError && (!email || !email.includes('@'))
                  ? 'border-destructive ring-2 ring-destructive/20 bg-destructive/5'
                  : 'border-border/80'
              }`}
            />
          </motion.div>
        ) : (
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/80">
            <span className="text-sm font-bold text-foreground font-mono truncate min-w-0">{email}</span>
            <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1 shrink-0 ml-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> Указан
            </span>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Статус заказа и детали выполнения будут отправлены на эту почту.
        </p>
      </div>

      <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-medium">Услуга:</span>
          <span className="font-bold text-foreground truncate max-w-[240px] sm:max-w-[280px] min-w-0">{selectedService.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-medium">Количество:</span>
          <span className="font-bold text-foreground font-mono">{quantity.toLocaleString('ru-RU')} шт</span>
        </div>
        {url && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Цель:</span>
            <span className="font-mono text-primary truncate max-w-[220px] sm:max-w-[260px] min-w-0">{url}</span>
          </div>
        )}
      </div>

      <motion.div
        animate={termsHasError ? { x: [0, -6, 6, -6, 6, 0] } : {}}
        transition={{ duration: 0.4 }}
        className={`w-full rounded-xl transition-all ${
          termsHasError ? 'ring-2 ring-destructive/40 bg-destructive/5 border border-destructive/20 p-2' : ''
        }`}
      >
        <LegalCheckbox
          id="wizard-legal-checkbox"
          checked={engine?.agreedToTerms ?? false}
          onChange={(val) => {
            engine?.setAgreedToTerms(val);
            if (val && engine?.setTermsHasError) engine.setTermsHasError(false);
          }}
          hasError={termsHasError || engine?.termsHasError}
          className="w-full text-[10px] font-bold text-muted-foreground justify-start"
          onOpenDocument={onOpenDocument}
        />
      </motion.div>
    </motion.div>
  );
}
