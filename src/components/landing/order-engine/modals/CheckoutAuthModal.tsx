'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, Key, X, Sparkles } from 'lucide-react';
import { PendingOrderSnapshot } from './auth/types';
import { AuthPasswordTab } from './auth/AuthPasswordTab';
import { AuthMagicLinkTab } from './auth/AuthMagicLinkTab';

export type { PendingOrderSnapshot };

interface CheckoutAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  onAuthSuccess: (user?: unknown) => void;
  orderSnapshot?: PendingOrderSnapshot;
}

export function CheckoutAuthModal({
  isOpen,
  onClose,
  email: initialEmail,
  onAuthSuccess,
  orderSnapshot,
}: CheckoutAuthModalProps) {
  const [activeTab, setActiveTab] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[350] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-md cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl p-5 sm:p-6 z-10 overflow-hidden space-y-4 my-auto"
          >
            {/* Ambient Glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/15 rounded-full blur-2xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-start justify-between gap-3 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5 shrink-0" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">
                    Вход в аккаунт
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Этот email уже зарегистрирован в системе
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-content2 hover:bg-content3 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer shrink-0"
                title="Закрыть"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info notice about order preservation */}
            <div className="px-3 py-2 rounded-xl bg-primary/5 border border-primary/15 text-[11px] text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Параметры вашего заказа сохранены и не сбросятся.</span>
            </div>

            {/* Tab Selector */}
            <div className="grid grid-cols-2 p-1 bg-muted/40 rounded-2xl border border-border/50 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('password');
                  setError(null);
                }}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'password'
                    ? 'bg-background text-foreground shadow-sm border border-border/60 font-black'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>По паролю</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('magic');
                  setError(null);
                }}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'magic'
                    ? 'bg-background text-foreground shadow-sm border border-border/60 font-black'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>По ссылке</span>
              </button>
            </div>

            {/* Error Message Display */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs font-bold"
              >
                {error}
              </motion.div>
            )}

            {/* Content Tabs */}
            {activeTab === 'password' ? (
              <AuthPasswordTab
                email={email}
                setEmail={setEmail}
                onSuccess={onAuthSuccess}
                onClose={onClose}
                onSwitchToMagic={() => {
                  setActiveTab('magic');
                  setError(null);
                }}
                onError={setError}
              />
            ) : (
              <AuthMagicLinkTab
                email={email}
                setEmail={setEmail}
                orderSnapshot={orderSnapshot}
                onSwitchToPassword={() => {
                  setActiveTab('password');
                  setError(null);
                }}
                onError={setError}
              />
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
