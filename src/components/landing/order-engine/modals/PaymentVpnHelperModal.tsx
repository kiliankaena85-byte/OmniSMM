'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ExternalLink, 
  Copy, 
  Check, 
  ShieldAlert, 
  X, 
  QrCode, 
  Smartphone, 
  Loader2, 
  CheckCircle2, 
  RefreshCw 
} from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';

export interface PaymentVpnHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentUrl: string;
  orderId?: string;
  numericId?: number;
  totalPrice?: string;
  paymentId?: string;
  guestOrderToken?: string;
}

export function PaymentVpnHelperModal({
  isOpen,
  onClose,
  paymentUrl,
  orderId,
  numericId,
  totalPrice,
  paymentId,
  guestOrderToken,
}: PaymentVpnHelperModalProps) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);

  // 1. Generate QR Code
  useEffect(() => {
    if (!paymentUrl) return;
    QRCode.toDataURL(paymentUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('[PaymentVpnModal] Failed to generate QR:', err));
  }, [paymentUrl]);

  // 2. Poll payment status every 2.5s
  useEffect(() => {
    if (!isOpen || !paymentId || isPaid) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/${paymentId}/status`, {
          signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'SUCCEEDED' && isMounted) {
            setIsPaid(true);
            toast.success('Оплата успешно подтверждена!', {
              description: 'Перенаправляем к деталям вашего заказа...'
            });
            setTimeout(() => {
              const target = orderId 
                ? `/order/${orderId}${guestOrderToken ? `?token=${guestOrderToken}` : ''}`
                : `/dashboard/orders?success=1`;
              window.location.href = target;
            }, 1200);
          }
        }
      } catch {
        // network fluctuations are normal during polling
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, paymentId, isPaid, orderId, guestOrderToken]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(paymentUrl);
      setCopied(true);
      toast.success('Ссылка на оплату скопирована!', {
        description: 'Отправьте её в Telegram или откройте на смартфоне без VPN'
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Не удалось скопировать ссылку');
    }
  };

  const handleOpenPayment = () => {
    window.open(paymentUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[360] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
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
            className="relative w-full max-w-lg bg-card border border-border/90 rounded-3xl shadow-2xl p-5 sm:p-7 z-10 my-auto text-foreground overflow-hidden"
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {isPaid ? (
              <div className="py-8 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center animate-bounce">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black text-foreground">Оплата успешно получена!</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Заказ запущен в обработку. Сейчас откроется страница статуса заказа...
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Header */}
                <div className="text-center sm:text-left pr-8">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Ожидание оплаты</span>
                    {totalPrice && <span>• {totalPrice} ₽</span>}
                  </div>
                  <h3 className="text-xl font-black text-foreground tracking-tight">
                    {orderId || numericId ? `Заказ #${numericId || orderId}` : 'Оплата заказа'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Выберите удобный способ завершить оплату
                  </p>
                </div>

                {/* Primary Button: Open Payment Gateway */}
                <button
                  type="button"
                  onClick={handleOpenPayment}
                  className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/25 transition-all cursor-pointer active:scale-98"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Открыть страницу ЮKassa (ПК)</span>
                </button>

                {/* Smartphone QR Code & SBP Section */}
                <div className="bg-muted/40 border border-border/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
                  {qrDataUrl ? (
                    <div className="bg-white p-2.5 rounded-xl shadow-xs shrink-0 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrDataUrl}
                        alt="QR-код для оплаты со смартфона"
                        className="w-32 h-32 block"
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-xl bg-muted animate-pulse flex items-center justify-center shrink-0">
                      <QrCode className="w-8 h-8 text-muted-foreground opacity-40" />
                    </div>
                  )}

                  <div className="text-center sm:text-left space-y-2">
                    <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-extrabold text-foreground">
                      <Smartphone className="w-4 h-4 text-emerald-500" />
                      <span>Оплата с телефона (СБП)</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Наведите камеру смартфона на QR-код и оплатите через СБП без отключения VPN на ПК.
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer pt-1"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Ссылка скопирована' : 'Скопировать ссылку для телефона'}</span>
                    </button>
                  </div>
                </div>

                {/* VPN Notice Box */}
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Не открывается ЮKassa или белый экран?</span>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-normal pl-6">
                    Российские банки блокируют иностранные IP-адреса. Если у вас включен VPN на ПК — 
                    <strong> временно отключите VPN на 1 минуту</strong> или оплатите по QR-коду со смартфона через мобильный интернет.
                  </p>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <RefreshCw className="w-3 h-3 animate-spin text-primary" />
                    <span>Автопроверка статуса каждые 2.5 сек</span>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-xs text-muted-foreground hover:text-foreground font-semibold cursor-pointer underline"
                  >
                    Вернуться к заказу
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
