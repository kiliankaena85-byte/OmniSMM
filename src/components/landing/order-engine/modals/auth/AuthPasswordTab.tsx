'use client';

import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { loginWithPasswordAction } from '@/actions/auth/password-login';

interface AuthPasswordTabProps {
  email: string;
  setEmail: (email: string) => void;
  onSuccess: (user?: unknown) => void;
  onClose: () => void;
  onSwitchToMagic: () => void;
  onError: (err: string | null) => void;
}

export function AuthPasswordTab({
  email,
  setEmail,
  onSuccess,
  onClose,
  onSwitchToMagic,
  onError,
}: AuthPasswordTabProps) {
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      onError('Пожалуйста, введите пароль');
      return;
    }
    if (requires2fa && !twoFactorCode.trim()) {
      onError('Пожалуйста, введите 6-значный код двухфакторной аутентификации');
      return;
    }

    setIsSubmitting(true);
    onError(null);

    try {
      const formData = new FormData();
      formData.append('email', email.trim().toLowerCase());
      formData.append('password', password);
      if (twoFactorCode.trim()) {
        formData.append('twoFactorCode', twoFactorCode.trim());
      }

      const res = await loginWithPasswordAction(null, formData);

      if (res.success) {
        setIsSubmitting(false);
        onSuccess(res);
        onClose();
      } else if (res.requires2fa) {
        setIsSubmitting(false);
        setRequires2fa(true);
        onError(res.error || 'Требуется код двухфакторной аутентификации');
      } else {
        setIsSubmitting(false);
        onError(res.error || 'Неверный email или пароль');
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      onError(err instanceof Error ? err.message : 'Ошибка при входе в систему');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
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
              onClick={onSwitchToMagic}
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
  );
}
