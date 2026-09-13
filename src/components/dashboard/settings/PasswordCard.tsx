'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { setPasswordAction, changePasswordAction } from '@/actions/auth/password-settings';
import { Lock, Eye, EyeOff, KeyRound, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function PasswordCard({
  hasPassword,
  canResetPassword = false,
}: {
  hasPassword: boolean;
  canResetPassword?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const toggleShowPassword = () => setShowPassword(!showPassword);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 8) {
      toast.error('Пароль должен содержать не менее 8 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('password', newPassword);
        formData.append('confirmPassword', confirmPassword);

        if (hasPassword) {
          formData.append('currentPassword', currentPassword);
          formData.append('newPassword', newPassword);

          const res = await changePasswordAction(formData);
          if (!res.success) {
            toast.error(res.error || 'Ошибка при изменении пароля');
            return;
          }
          toast.success('Пароль успешно обновлен!');
        } else {
          const res = await setPasswordAction(formData);
          if (!res.success) {
            toast.error(res.error || 'Ошибка при установке пароля');
            return;
          }
          toast.success('Пароль успешно установлен!');
        }

        // Reset fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Неизвестная ошибка';
        toast.error(`Не удалось обновить пароль: ${msg}`);
      }
    });
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-sm">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2.5 bg-muted/20">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <KeyRound className="w-4 h-4 shrink-0" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground text-sm">
            {canResetPassword ? 'Сброс пароля' : hasPassword ? 'Смена пароля' : 'Защита аккаунта'}
          </h2>
          <p className="text-[10px] text-muted-foreground">
            {canResetPassword
              ? 'Установите новый пароль'
              : hasPassword
              ? 'Регулярно обновляйте пароль для максимальной безопасности'
              : 'Установите постоянный пароль для быстрого входа'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {!hasPassword && (
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-3.5 flex gap-3 text-xs text-primary">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              Для вашего аккаунта еще не задан постоянный пароль. 
              Установите его сейчас, чтобы заходить <strong>по паролю</strong> в один клик.
            </div>
          </div>
        )}

        <div className="space-y-3.5">
          {hasPassword && !canResetPassword && (
            <div className="space-y-1">
              <label htmlFor="currentPassword" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Текущий пароль
              </label>
              <div className="relative">
                <input
                  id="currentPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full text-base sm:text-sm border border-border/80 rounded-xl px-4 py-2.5 pr-10 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background/50 hover:bg-background/80 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={toggleShowPassword}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label htmlFor="newPassword" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {hasPassword ? 'Новый пароль' : 'Пароль'}
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Минимум 8 символов"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-base sm:text-sm border border-border/80 rounded-xl px-4 py-2.5 pr-10 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background/50 hover:bg-background/80 transition-all duration-200"
                />
                {!hasPassword && (
                  <button
                    type="button"
                    onClick={toggleShowPassword}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Подтверждение пароля
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Повторите новый пароль"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full text-base sm:text-sm border border-border/80 rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background/50 hover:bg-background/80 transition-all duration-200"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-2 border-t border-border/40 gap-3">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Check className="w-3.5 h-3.5 text-success shrink-0" />
            <span>Минимум 8 символов, цифры и буквы</span>
          </div>
          <Button
            type="submit"
            intent="primary"
            size="sm"
            isAnimated={true}
            disabled={isPending || !newPassword || !confirmPassword || (hasPassword && !canResetPassword && !currentPassword)}
            className="rounded-xl shrink-0 font-semibold px-6 shadow-sm"
          >
            {isPending ? 'Сохранение...' : canResetPassword ? 'Сохранить новый пароль' : hasPassword ? 'Обновить пароль' : 'Установить пароль'}
          </Button>
        </div>
      </form>
    </div>
  );
}
