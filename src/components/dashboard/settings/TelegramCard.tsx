'use client';

import React, { useState, useTransition } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Copy,
  CheckCheck,
  RefreshCw,
  Unlink,
  Bell,
  CreditCard,
  Headphones,
  ShieldCheck,
  X,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from '@/components/ui/qr-code';
import { toast } from 'sonner';
import {
  getTelegramBindDetailsAction,
  updateTelegramNotificationSettingsAction,
  unbindTelegramAction,
} from '@/actions/user/settings-extra';

export interface TelegramCardProps {
  telegramId: string | null;
  notifyOrders?: boolean;
  notifyBalance?: boolean;
  notifyTickets?: boolean;
}

export default function TelegramCard({
  telegramId: initialTelegramId,
  notifyOrders: initialNotifyOrders = true,
  notifyBalance: initialNotifyBalance = true,
  notifyTickets: initialNotifyTickets = true,
}: TelegramCardProps) {
  const [isPending, startTransition] = useTransition();

  const [telegramId, setTelegramId] = useState<string | null>(initialTelegramId);
  const [notifyOrders, setNotifyOrders] = useState<boolean>(initialNotifyOrders);
  const [notifyBalance, setNotifyBalance] = useState<boolean>(initialNotifyBalance);
  const [notifyTickets, setNotifyTickets] = useState<boolean>(initialNotifyTickets);

  // Modal / QR Deep Link State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deepLink, setDeepLink] = useState<string>('');
  const [botUsername, setBotUsername] = useState<string>('SMMplansapport_bot');
  const [copied, setCopied] = useState(false);
  const [isLoadingDeepLink, setIsLoadingDeepLink] = useState(false);
  const [confirmUnbind, setConfirmUnbind] = useState(false);

  const isBound = !!telegramId;

  const handleOpenBindModal = async () => {
    setIsModalOpen(true);
    if (!deepLink) {
      await fetchNewBindLink();
    }
  };

  const fetchNewBindLink = async () => {
    setIsLoadingDeepLink(true);
    try {
      const res = await getTelegramBindDetailsAction();
      if (res.success && res.deepLink) {
        setDeepLink(res.deepLink);
        if (res.botUsername) {
          setBotUsername(res.botUsername);
        }
      } else {
        toast.error(res.error || 'Не удалось сгенерировать ссылку привязки');
      }
    } catch {
      toast.error('Ошибка при обращении к серверу');
    } finally {
      setIsLoadingDeepLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!deepLink) return;
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopied(true);
      toast.success('Ссылка привязки скопирована в буфер обмена');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Не удалось скопировать ссылку');
    }
  };

  const handleToggleNotification = (
    key: 'notifyOrders' | 'notifyBalance' | 'notifyTickets',
    currentVal: boolean
  ) => {
    const nextVal = !currentVal;
    if (key === 'notifyOrders') setNotifyOrders(nextVal);
    if (key === 'notifyBalance') setNotifyBalance(nextVal);
    if (key === 'notifyTickets') setNotifyTickets(nextVal);

    startTransition(async () => {
      try {
        const payload = {
          notifyOrders: key === 'notifyOrders' ? nextVal : notifyOrders,
          notifyBalance: key === 'notifyBalance' ? nextVal : notifyBalance,
          notifyTickets: key === 'notifyTickets' ? nextVal : notifyTickets,
        };
        const res = await updateTelegramNotificationSettingsAction(payload);
        if (!res.success) {
          toast.error(res.error || 'Ошибка при сохранении настроек уведомлений');
          // rollback
          if (key === 'notifyOrders') setNotifyOrders(currentVal);
          if (key === 'notifyBalance') setNotifyBalance(currentVal);
          if (key === 'notifyTickets') setNotifyTickets(currentVal);
        } else {
          toast.success('Настройки Telegram-уведомлений сохранены');
        }
      } catch {
        toast.error('Не удалось сохранить настройки');
        if (key === 'notifyOrders') setNotifyOrders(currentVal);
        if (key === 'notifyBalance') setNotifyBalance(currentVal);
        if (key === 'notifyTickets') setNotifyTickets(currentVal);
      }
    });
  };

  const handleUnbind = () => {
    if (!confirmUnbind) {
      setConfirmUnbind(true);
      setTimeout(() => setConfirmUnbind(false), 5000);
      return;
    }

    setConfirmUnbind(false);
    startTransition(async () => {
      try {
        const res = await unbindTelegramAction();
        if (res.success) {
          setTelegramId(null);
          toast.success('Telegram-аккаунт успешно отвязан');
        } else {
          toast.error(res.error || 'Не удалось отвязать Telegram');
        }
      } catch {
        toast.error('Ошибка при отвязке аккаунта');
      }
    });
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Send className="w-4 h-4 shrink-0" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-foreground text-sm">Smart Bind Telegram</h2>
              {isBound ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 uppercase">
                  <CheckCircle2 className="w-3 h-3" />
                  Подключено
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-amber-500/20 text-amber-600 dark:text-amber-400 bg-amber-500/10 uppercase">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  Не привязано
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Мгновенные уведомления о статусах заказов, пополнениях и поддержка в 1 клик (без передачи телефонного номера)
            </p>
          </div>
        </div>

        {/* Top Action */}
        <div className="flex items-center gap-2 shrink-0">
          {isBound ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-muted-foreground bg-muted/80 px-2.5 py-1.5 rounded-lg border border-border/60">
                tg: {telegramId?.substring(0, 3)}****
              </span>
              <a
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-xl border border-primary/20 transition-all duration-200"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Бот</span>
                <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
              </a>
            </div>
          ) : (
            <Button
              type="button"
              onClick={handleOpenBindModal}
              intent="primary"
              size="sm"
              isAnimated={true}
              className="rounded-xl font-bold text-xs gap-1.5 px-4 shadow-sm"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Привязать в 1 клик</span>
            </Button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Main description & info */}
        <div className="bg-muted/40 border border-border/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <p className="text-xs text-foreground font-semibold">
              {isBound
                ? 'Ваш Telegram-аккаунт успешно сопряжён с личным кабинетом SMMplan.'
                : 'Привяжите Telegram для мгновенного получения пуш-уведомлений и быстрого доступа к службе заботы.'}
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              Технология Smart Bind полностью анонимна и не запрашивает ваш реальный номер телефона.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2 w-full sm:w-auto">
            {isBound ? (
              confirmUnbind ? (
                <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-1.5">
                  <span className="text-[11px] font-bold text-destructive">Отвязать?</span>
                  <button
                    type="button"
                    onClick={handleUnbind}
                    disabled={isPending}
                    className="text-[11px] font-bold text-destructive underline hover:no-underline"
                  >
                    Да, подтверждаю
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleUnbind}
                  disabled={isPending}
                  aria-label="Отвязать Telegram аккаунт"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-3 py-2 rounded-xl transition-all duration-200 border border-transparent hover:border-destructive/20"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Отвязать</span>
                </button>
              )
            ) : (
              <Button
                type="button"
                onClick={handleOpenBindModal}
                intent="secondary"
                size="sm"
                className="w-full sm:w-auto rounded-xl text-xs font-semibold gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR-код & Ссылка</span>
              </Button>
            )}
          </div>
        </div>

        {/* Notification Switches Section */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Тумблеры Telegram-уведомлений
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Orders Notification Toggle */}
            <div className="bg-card border border-border/80 rounded-xl p-3.5 flex flex-col justify-between gap-3 hover:border-border transition-all duration-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  <span>Статусы заказов</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Уведомления о выполнении, частичном возврате (Partial) и сбоях заказов
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <span className="text-[10px] font-bold text-muted-foreground">
                  {notifyOrders ? 'Включено' : 'Выключено'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifyOrders}
                  onClick={() => handleToggleNotification('notifyOrders', notifyOrders)}
                  disabled={isPending}
                  aria-label="Переключить уведомления о статусах заказов"
                  className={`w-10 h-5 rounded-full transition-colors relative duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                    notifyOrders ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                      notifyOrders ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 2. Balance & Financial Notifications Toggle */}
            <div className="bg-card border border-border/80 rounded-xl p-3.5 flex flex-col justify-between gap-3 hover:border-border transition-all duration-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                  <CreditCard className="w-3.5 h-3.5 text-success" />
                  <span>Баланс и финансы</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Оповещения об успешных пополнениях, чеках и реферальных бонусах
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <span className="text-[10px] font-bold text-muted-foreground">
                  {notifyBalance ? 'Включено' : 'Выключено'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifyBalance}
                  onClick={() => handleToggleNotification('notifyBalance', notifyBalance)}
                  disabled={isPending}
                  aria-label="Переключить уведомления о балансе и финансах"
                  className={`w-10 h-5 rounded-full transition-colors relative duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                    notifyBalance ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                      notifyBalance ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 3. Support Tickets Notification Toggle */}
            <div className="bg-card border border-border/80 rounded-xl p-3.5 flex flex-col justify-between gap-3 hover:border-border transition-all duration-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                  <Headphones className="w-3.5 h-3.5 text-blue-500" />
                  <span>Тикеты поддержки</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Моментальные ответы дежурного оператора поддержки в чат Telegram
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <span className="text-[10px] font-bold text-muted-foreground">
                  {notifyTickets ? 'Включено' : 'Выключено'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifyTickets}
                  onClick={() => handleToggleNotification('notifyTickets', notifyTickets)}
                  disabled={isPending}
                  aria-label="Переключить уведомления о тикетах поддержки"
                  className={`w-10 h-5 rounded-full transition-colors relative duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                    notifyTickets ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                      notifyTickets ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Bind Modal (QR + Direct Link) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div
            className="bg-card border border-border rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-5 top-5 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
              aria-label="Закрыть модальное окно"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Send className="w-5 h-5 shrink-0" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Привязка Telegram в 1 клик</h3>
                <p className="text-xs text-muted-foreground">Smart Bind Protocol (Анонимно & Безопасно)</p>
              </div>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-4 bg-background border border-border/80 rounded-2xl space-y-3">
              {isLoadingDeepLink ? (
                <div className="w-44 h-44 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary shrink-0" />
                  <span className="text-xs font-semibold">Генерация токена...</span>
                </div>
              ) : deepLink ? (
                <>
                  <div className="p-3 bg-white rounded-xl shadow-inner border border-slate-200">
                    <QRCodeSVG value={deepLink} size={160} fgColor="#0f172a" bgColor="#ffffff" />
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center font-medium">
                    Наведите камеру смартфона для мгновенного перехода в бот
                  </p>
                </>
              ) : (
                <div className="w-44 h-44 flex flex-col items-center justify-center gap-2 text-destructive">
                  <AlertCircle className="w-6 h-6 shrink-0" />
                  <span className="text-xs font-semibold">Не удалось загрузить ссылку</span>
                </div>
              )}
            </div>

            {/* Deep link input with copy button */}
            {deepLink && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Прямая ссылка Deep-Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={deepLink}
                    className="flex-1 min-w-0 bg-muted/40 border border-border rounded-xl px-3.5 py-2 font-mono text-xs text-foreground truncate select-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    aria-label="Скопировать ссылку"
                    className={`shrink-0 px-3 py-2 rounded-xl border font-semibold text-xs flex items-center gap-1.5 transition-all duration-200 ${
                      copied
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-card border-border hover:bg-muted text-foreground'
                    }`}
                  >
                    {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Скопировано' : 'Копировать'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <a
                href={deepLink || `/api/support/telegram`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs py-3 px-4 rounded-xl shadow-sm hover:shadow transition-all duration-200 active:scale-95 touch-manipulation min-h-[44px]"
              >
                <Send className="w-4 h-4 shrink-0" />
                <span>Открыть Telegram-бот</span>
              </a>

              <button
                type="button"
                onClick={fetchNewBindLink}
                disabled={isLoadingDeepLink}
                title="Сгенерировать новый токен"
                className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition-all duration-200"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingDeepLink ? 'animate-spin' : ''}`} />
                <span>Обновить QR</span>
              </button>
            </div>

            {/* Instructions */}
            <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside bg-muted/30 p-3 rounded-xl border border-border/60">
              <li>Откройте бота по ссылке или через сканирование QR-кода</li>
              <li>Нажмите кнопку <strong>START</strong> в диалоге с ботом</li>
              <li>Бот автоматически свяжет аккаунт и включит оповещения</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
