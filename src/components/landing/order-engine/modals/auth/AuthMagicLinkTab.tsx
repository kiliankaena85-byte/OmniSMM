'use client';

import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import { requestMagicLink } from '@/actions/auth/request-magic-link';
import { PendingOrderSnapshot, persistOrderSnapshot } from './types';

interface AuthMagicLinkTabProps {
  email: string;
  setEmail: (email: string) => void;
  orderSnapshot?: PendingOrderSnapshot;
  onSwitchToPassword: () => void;
  onError: (err: string | null) => void;
}

export function AuthMagicLinkTab({
  email,
  setEmail,
  orderSnapshot,
  onSwitchToPassword,
  onError,
}: AuthMagicLinkTabProps) {
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      onError('Пожалуйста, укажите корректный email');
      return;
    }

    setIsSubmitting(true);
    onError(null);

    try {
      persistOrderSnapshot(orderSnapshot, email);

      const formData = new FormData();
      formData.append('email', cleanEmail);
      formData.append('redirectTo', '/?auth_resume=1');

      const res = await requestMagicLink(null, formData);

      setIsSubmitting(false);
      if (res.success) {
        setMagicLinkSent(true);
        setResendCooldown(60);
      } else {
        onError(res.error || 'Не удалось отправить ссылку. Попробуйте еще раз.');
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      onError(err instanceof Error ? err.message : 'Ошибка при отправке ссылки');
    }
  };

  return (
    <div className="space-y-3.5">
      {!magicLinkSent ? (
        <form onSubmit={handleSubmit} className="space-y-3.5">
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
              onClick={() => handleSubmit()}
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
                onSwitchToPassword();
              }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Я вспомнил пароль — войти по паролю
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
