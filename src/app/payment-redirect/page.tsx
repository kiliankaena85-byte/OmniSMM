'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { FluxCard, FluxButton, FluxBadge } from '@/components/ui';

export default function PaymentRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('id');

  const [status, setStatus] = useState<'polling' | 'redirecting' | 'error'>('polling');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!paymentId) {
      setStatus('error');
      setErrorMessage('Неверная ссылка на оплату. Отсутствует идентификатор платежа.');
      return;
    }

    let isMounted = true;
    let pollCount = 0;
    const MAX_POLLS = 20; // 20 * 1500ms = 30 seconds timeout
    let timeoutId: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/payments/${paymentId}/status`);
        
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            throw new Error('У вас нет доступа к этому платежу.');
          }
          throw new Error('Ошибка сервера при проверке статуса платежа.');
        }

        const data = await res.json();

        if (!isMounted) return;

        if (data.status === 'ERROR' || data.status === 'CANCELED') {
          setStatus('error');
          setErrorMessage('К сожалению, произошла ошибка на стороне платежного шлюза. Пожалуйста, попробуйте выбрать другой способ оплаты.');
          return;
        }

        if (data.status === 'SUCCEEDED') {
          setStatus('redirecting');
          setTimeout(() => {
            if (isMounted) {
              window.location.href = '/dashboard/add-funds?success=1';
            }
          }, 500);
          return;
        }

        const isSelfRedirect = data.checkoutUrl && (
          data.checkoutUrl.includes('/payment-redirect') ||
          (typeof window !== 'undefined' && data.checkoutUrl === window.location.href)
        );

        if (data.checkoutUrl && !isSelfRedirect) {
          setStatus('redirecting');
          // Short delay for UX smoothness
          setTimeout(() => {
            if (isMounted) {
              window.location.href = data.checkoutUrl;
            }
          }, 800);
          return;
        }

        // Still pending
        pollCount++;
        if (pollCount >= MAX_POLLS) {
          setStatus('error');
          setErrorMessage('Превышено время ожидания ответа от платежной системы. Платеж отменен.');
          return;
        }

        // Continue polling
        timeoutId = setTimeout(pollStatus, 1500);
      } catch (err: unknown) {
        if (!isMounted) return;
        setStatus('error');
        const msg = err instanceof Error ? err.message : 'Произошла непредвиденная ошибка соединения.';
        setErrorMessage(msg);
      }
    };

    pollStatus();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [paymentId]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Radiant Aurora Mesh Backdrop */}
      <div 
        className="absolute inset-0 pointer-events-none z-0 opacity-40 dark:opacity-20"
        style={{
          backgroundImage: `
            radial-gradient(65% 55% at 15% 0%, rgba(59, 130, 246, 0.55), transparent 70%),
            radial-gradient(55% 55% at 85% 5%, rgba(56, 189, 248, 0.45), transparent 70%),
            radial-gradient(65% 55% at 20% 40%, rgba(244, 63, 94, 0.45), transparent 70%),
            radial-gradient(55% 55% at 80% 50%, rgba(249, 115, 22, 0.40), transparent 70%),
            radial-gradient(70% 70% at 50% 25%, rgba(217, 70, 239, 0.50), transparent 75%)
          `
        }}
      />

      <FluxCard variant="glass" padding="xl" className="max-w-md w-full flex flex-col items-center text-center shadow-[0_20px_60px_rgba(0,0,0,0.08)] relative z-10">
        {status === 'polling' && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <FluxBadge variant="primary" pulse icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                Безопасный эквайринг
              </FluxBadge>
            </div>
            <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-foreground">Устанавливаем соединение...</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Генерируем защищенную платежную сессию для вашего заказа.
              </p>
            </div>
          </div>
        )}

        {status === 'redirecting' && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <FluxBadge variant="success" pulse icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                Сессия подтверждена
              </FluxBadge>
            </div>
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-foreground">Перенаправляем в банк...</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Сейчас откроется защищенная страница оплаты.
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <FluxBadge variant="destructive" pulse icon={<AlertTriangle className="w-3.5 h-3.5" />}>
                Сбой шлюза
              </FluxBadge>
            </div>
            <div className="w-16 h-16 rounded-3xl bg-pink-500/10 border border-pink-500/20 text-pink-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-foreground">Ошибка создания платежа</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {errorMessage}
              </p>
            </div>
            <FluxButton
              variant="primary"
              size="md"
              onClick={() => router.back()}
              className="w-full"
            >
              Вернуться назад
            </FluxButton>
          </div>
        )}
      </FluxCard>
    </div>
  );
}
