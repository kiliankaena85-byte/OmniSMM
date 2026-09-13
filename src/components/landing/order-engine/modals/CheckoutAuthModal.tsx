'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, Key, ArrowRight, X, Loader2, CheckCircle2, ShieldCheck, Eye, EyeOff, Sparkles, RefreshCw } from 'lucide-react';
import { loginWithPasswordAction } from '@/actions/auth/password-login';
import { requestMagicLink } from '@/actions/auth/request-magic-link';

export interface PendingOrderSnapshot {
  serviceId?: string;
  link?: string;
  quantity?: number;
  promoCode?: string;
  runs?: number;
  interval?: number;
  isSmartDrip?: boolean;
  smartDripDays?: number;
  networkId?: string;
  categoryId?: string;
  customData?: string;
}

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
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Synchronize email when prop changes
  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  // Reset internal states on open/close
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setTwoFactorCode('');
      setRequires2fa(false);
      setError(null);
      setMagicLinkSent(false);
    }
  }, [isOpen]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Helper to persist order state for magic link return
  const persistOrderSnapshot = () => {
    if (typeof window === 'undefined' || !orderSnapshot) return;
    try {
      const payload = {
        version: 1,
        ...orderSnapshot,
        url: orderSnapshot.link,
        email: email.trim().toLowerCase(),
        savedAt: Date.now(),
        timestamp: Date.now(),
      };
      sessionStorage.setItem('smmplan_pending_order', JSON.stringify(payload));
      localStorage.setItem('smmplan_pending_order', JSON.stringify(payload));
      sessionStorage.setItem('omni_pending_order_v1', JSON.stringify(payload));
      localStorage.setItem('omni_pending_order_v1', JSON.stringify(payload));
    } catch (e) {
      console.warn('[CheckoutAuthModal] Failed to persist order snapshot:', e);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Пожалуйста, введите пароль');
      return;
    }
    if (requires2fa && !twoFactorCode.trim()) {
      setError('Пожалуйста, введите 6-значный код двухфакторной аутентификации');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('email', email.trim().toLowerCase());
      formData.append('password', password);
      if (twoFactorCode.trim()) {
        formData.append('twoFactorCode', twoFactorCode.trim());
      }

      const res = await loginWithPasswordAction(null, formData);

      if (res.success) {
        // Successful login
        setIsSubmitting(false);
        onAuthSuccess(res);
        onClose();
      } else if (res.requires2fa) {
        setIsSubmitting(false);
        setRequires2fa(true);
        setError(res.error || 'Требуется код двухфакторной аутентификации');
      } else {
        setIsSubmitting(false);
        setError(res.error || 'Неверный email или пароль');
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : 'Ошибка при входе в систему');
    }
  };

  const handleMagicLinkSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Пожалуйста, укажите корректный email');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Persist snapshot so returning from email restores the order
      persistOrderSnapshot();

      // 2. Request magic link with redirect back to resume checkout
      const formData = new FormData();
      formData.append('email', cleanEmail);
      formData.append('redirectTo', '/?auth_resume=1');

      const res = await requestMagicLink(null, formData);

      setIsSubmitting(false);
      if (res.success) {
        setMagicLinkSent(true);
        setResendCooldown(60);
      } else {
        setError(res.error || 'Не удалось отправить ссылку. Попробуйте еще раз.');
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : 'Ошибка при отправке ссылки');
    }
  };

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

            {/* TAB 1: Password Login */}
            {activeTab === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full h-11 px-3.5 rounded-xl bg-content2/60 border border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                    placeholder="user@domain.com"
                  />
                </div>

                {!requires2fa ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-muted-foreground">
                        Пароль
                      </label>
                      <button
                        type="button"
                        onClick={() => setActiveTab('magic')}
                        className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                      >
                        Забыли пароль?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isSubmitting}
                        autoFocus
                        className="w-full h-11 pl-3.5 pr-10 rounded-xl bg-content2/60 border border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                      Код 2FA (Google Authenticator)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      disabled={isSubmitting}
                      autoFocus
                      maxLength={8}
                      className="w-full h-11 px-3.5 rounded-xl bg-content2/60 border border-border text-foreground text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                      placeholder="123456"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 min-h-[48px] rounded-2xl bg-primary text-primary-foreground font-black text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/25 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>{requires2fa ? 'Подтвердить вход' : 'Войти и продолжить заказ'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* TAB 2: Magic Link Login */}
            {activeTab === 'magic' && (
              <div className="space-y-3.5">
                {!magicLinkSent ? (
                  <form onSubmit={handleMagicLinkSubmit} className="space-y-3.5">
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                        Куда отправить ссылку для входа
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full h-11 px-3.5 rounded-xl bg-content2/60 border border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                        placeholder="user@domain.com"
                      />
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Мы отправим ссылку на почту. При переходе по ссылке вы будете автоматически авторизованы, и все поля вашего заказа останутся заполненными.
                    </p>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-12 min-h-[48px] rounded-2xl bg-primary text-primary-foreground font-black text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/25 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          <span>Отправить ссылку для входа</span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-foreground">
                        Ссылка отправлена на почту
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Проверьте ящик <strong className="text-foreground">{email}</strong> и перейдите по ссылке в письме.
                      </p>
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => handleMagicLinkSubmit()}
                        disabled={resendCooldown > 0 || isSubmitting}
                        className="text-xs font-bold text-primary hover:underline disabled:text-muted-foreground disabled:no-underline cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                        <span>
                          {resendCooldown > 0
                            ? `Отправить повторно через ${resendCooldown} сек`
                            : 'Отправить ссылку повторно'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMagicLinkSent(false);
                          setActiveTab('password');
                        }}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Я вспомнил пароль — войти по паролю
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
