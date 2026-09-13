'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowRight, X, ShieldCheck } from 'lucide-react';

interface EmailPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string) => void;
  initialEmail?: string;
}

export function EmailPromptModal({
  isOpen,
  onClose,
  onConfirm,
  initialEmail = '',
}: EmailPromptModalProps) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      setError('Пожалуйста, введите корректный адрес электронной почты (например, name@domain.com)');
      return;
    }
    setError(null);
    onConfirm(trimmed);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-md cursor-pointer"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl p-6 z-10 overflow-hidden space-y-5"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 shrink-0" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">
                    Email для отслеживания заказа
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Для доступа и отслеживания статуса заказа
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-content2 hover:bg-content3 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Электронная почта
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    autoFocus
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="name@example.com"
                    className={`w-full h-12 px-4 rounded-xl border bg-background text-sm font-bold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                      error ? 'border-destructive ring-2 ring-destructive/20' : 'border-border/80'
                    }`}
                  />
                </div>
                {error && (
                  <p className="text-xs text-destructive font-medium animate-in fade-in duration-200">
                    {error}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                  На этот адрес сразу после оплаты поступит доступ и статус выполнения заказа.
                </p>
              </div>

              <button
                type="submit"
                className="w-full min-h-[46px] h-12 px-5 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
              >
                <ShieldCheck className="w-4.5 h-4.5" />
                <span>Подтвердить и оплатить</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
