'use client';

import React, { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  adminChangeUserPasswordAction,
  adminGenerateMagicLinkAction,
  adminRevokeUserSessionsAction,
} from '@/actions/admin/users';
import {
  Check,
  Copy,
  KeyRound,
  Sparkles,
  Mail,
  Link as LinkIcon,
  LogOut,
} from 'lucide-react';
import { UserDTO, LoginLogDTO } from './types';
import { SecurityEmailModal } from './security-email-modal';
import { SecurityLoginLogs } from './security-login-logs';

interface SecurityTabProps {
  user: UserDTO;
  loginLogs: LoginLogDTO[];
}

export function SecurityTab({ user, loginLogs }: SecurityTabProps) {
  const [newPass, setNewPass] = useState('');
  const [copiedPass, setCopiedPass] = useState(false);
  const [isPendingPass, startPassTransition] = useTransition();

  // Magic link state & handler
  const [isPendingMagicLink, startMagicLinkTransition] = useTransition();
  const [copiedMagicLink, setCopiedMagicLink] = useState(false);

  // Revoke sessions handler
  const [isPendingRevoke, startRevokeTransition] = useTransition();

  // Email Change Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);

  function generateRandomPassword() {
    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let res = '';
    for (let i = 0; i < 12; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPass(res);
  }

  async function copyNewPassword() {
    if (!newPass) return;
    try {
      await navigator.clipboard.writeText(newPass);
      setCopiedPass(true);
      toast.success('Пароль скопирован');
      setTimeout(() => setCopiedPass(false), 2000);
    } catch {
      toast.error('Ошибка копирования');
    }
  }

  function savePassword() {
    if (!newPass || newPass.length < 8) {
      toast.error('Пароль должен содержать минимум 8 символов');
      return;
    }
    startPassTransition(async () => {
      const r = await adminChangeUserPasswordAction(user.id, newPass);
      if (r.success) {
        toast.success('🔑 Пароль изменен, сессии клиента сброшены');
        setNewPass('');
      } else {
        toast.error(r.error ?? 'Ошибка при смене пароля');
      }
    });
  }

  function handleGenerateMagicLink() {
    startMagicLinkTransition(async () => {
      const res = await adminGenerateMagicLinkAction(user.id);
      if (res.success && res.magicUrl) {
        const fullUrl = res.magicUrl.startsWith('http') ? res.magicUrl : `${window.location.origin}${res.magicUrl}`;
        await navigator.clipboard.writeText(fullUrl);
        setCopiedMagicLink(true);
        toast.success(
          '🔗 Одноразовая ссылка входа скопирована в буфер обмена (действует 15 минут)!'
        );
        setTimeout(() => setCopiedMagicLink(false), 3000);
      } else {
        toast.error(res.error || 'Ошибка при генерации ссылки');
      }
    });
  }

  function handleRevokeSessions() {
    if (
      !confirm(
        'Вы уверены, что хотите завершить все активные сессии пользователя со всех устройств?'
      )
    )
      return;
    startRevokeTransition(async () => {
      const res = await adminRevokeUserSessionsAction(user.id);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.error || 'Ошибка сброса сессий');
      }
    });
  }

  return (
    <>
      <div className="space-y-5 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Quick Access & Identity */}
          <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl p-5 ring-1 ring-border/5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span className="bg-primary/10 text-primary p-1 rounded-md">
                    <LinkIcon className="w-3.5 h-3.5" />
                  </span>
                  Быстрый доступ и Сессии
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Генерация одноразовой ссылки прямого входа без пароля (действует 15 минут)
                или принудительный сброс активных сессий при подозрении на взлом.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleGenerateMagicLink}
                disabled={isPendingMagicLink}
                className="w-full h-9 rounded-xl text-xs font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {copiedMagicLink ? (
                  <Check className="w-3.5 h-3.5 text-success" />
                ) : (
                  <LinkIcon className="w-3.5 h-3.5" />
                )}
                {isPendingMagicLink
                  ? 'Генерация...'
                  : copiedMagicLink
                  ? 'Ссылка скопирована!'
                  : 'Скопировать Magic Link (15 мин)'}
              </button>

              <button
                type="button"
                onClick={() => setShowEmailModal(true)}
                className="w-full h-9 rounded-xl text-xs font-bold bg-muted text-foreground border border-border/60 hover:bg-muted/80 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                Исправить Email клиента
              </button>

              <button
                type="button"
                onClick={handleRevokeSessions}
                disabled={isPendingRevoke}
                className="w-full h-9 rounded-xl text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                {isPendingRevoke ? 'Сброс...' : 'Завершить все сессии (Force Logout)'}
              </button>
            </div>
          </div>

          {/* Card 2: Password Management */}
          <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl p-5 ring-1 ring-border/5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span className="bg-amber-500/10 text-amber-600 p-1 rounded-md">
                    <KeyRound className="w-3.5 h-3.5" />
                  </span>
                  Смена пароля клиента
                </h3>
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-lg transition-all active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  Сгенерировать
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">
                    Новый пароль (минимум 8 символов)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={newPass}
                      onChange={e => setNewPass(e.target.value)}
                      placeholder="Введите или сгенерируйте..."
                      className="w-full h-9 text-xs pl-3 pr-9 rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground font-mono outline-none focus:border-primary"
                    />
                    {newPass && (
                      <button
                        type="button"
                        onClick={copyNewPassword}
                        className="absolute right-2 p-1 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
                        title="Скопировать"
                      >
                        {copiedPass ? (
                          <Check className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!newPass || newPass.length < 8) {
                  toast.error('Пароль должен содержать не менее 8 символов');
                  return;
                }
                savePassword();
              }}
              disabled={isPendingPass}
              className="w-full h-9 rounded-xl text-xs font-bold bg-warning text-warning-foreground shadow-xs hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isPendingPass ? 'Сохранение...' : 'Установить новый пароль'}
            </button>
          </div>

          {/* Card 3: Security Log */}
          <SecurityLoginLogs loginLogs={loginLogs} />
        </div>
      </div>

      {/* MODAL: Change Client Email */}
      <SecurityEmailModal
        user={user}
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
      />
    </>
  );
}
