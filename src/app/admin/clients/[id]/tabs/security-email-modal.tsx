'use client';

import React, { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { adminChangeUserEmailAction } from '@/actions/admin/users';
import { Shield, X, Edit3 } from 'lucide-react';
import { UserDTO } from './types';

interface SecurityEmailModalProps {
  user: UserDTO;
  isOpen: boolean;
  onClose: () => void;
}

export function SecurityEmailModal({ user, isOpen, onClose }: SecurityEmailModalProps) {
  const [editEmail, setEditEmail] = useState(user.email);
  const [emailReason, setEmailReason] = useState(
    'Опечатка при регистрации / Обращение в чат'
  );
  const [isPendingEmailChange, startEmailChangeTransition] = useTransition();

  if (!isOpen) return null;

  function handleSaveEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!editEmail || !editEmail.includes('@')) {
      toast.error('Введите корректный email');
      return;
    }
    if (!emailReason.trim() || emailReason.trim().length < 3) {
      toast.error('Укажите причину изменения (мин. 3 символа)');
      return;
    }
    startEmailChangeTransition(async () => {
      const res = await adminChangeUserEmailAction(user.id, editEmail, emailReason);
      if (res.success) {
        toast.success(res.message);
        onClose();
      } else {
        toast.error(res.error || 'Ошибка смены email');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-md p-6 space-y-4 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-primary/10 text-primary">
            <Edit3 className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-foreground">Замена Email клиента</h3>
            <p className="text-xs text-muted-foreground">
              Текущий адрес:{' '}
              <span className="font-mono text-foreground font-semibold">
                {user.email}
              </span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveEmail} className="space-y-3.5 pt-2">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">
              Новый адрес Email
            </label>
            <input
              type="email"
              required
              value={editEmail}
              onChange={e => setEditEmail(e.target.value)}
              placeholder="ivan@gmail.com"
              className="w-full h-9 text-xs font-mono px-3 rounded-xl border border-border/60 bg-background/50 text-foreground outline-none focus:border-primary shadow-sm"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">
              Обоснование смены (для аудита 152-ФЗ)
            </label>
            <input
              type="text"
              required
              value={emailReason}
              onChange={e => setEmailReason(e.target.value)}
              placeholder="Опечатка при регистрации / Сверен чек ЮKassa"
              className="w-full h-9 text-xs px-3 rounded-xl border border-border/60 bg-background/50 text-foreground outline-none focus:border-primary shadow-sm"
            />
          </div>

          <div className="p-3 bg-muted/40 border border-border/40 rounded-xl text-[11px] text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-primary" /> Протокол безопасности:
            </p>
            <p>• Все активные сессии со старого адреса будут сброшены.</p>
            <p>
              • Баланс ({((user.balance || 0) / 100).toFixed(2)} ₽) и история заказов
              полностью сохранятся.
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-9 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isPendingEmailChange}
              className="px-4 h-9 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-xs hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isPendingEmailChange ? 'Сохранение...' : 'Перенести аккаунт'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
