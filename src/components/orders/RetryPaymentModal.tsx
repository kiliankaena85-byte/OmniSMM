'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Wallet, CreditCard, Bitcoin, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { centsToRub } from '@/lib/money';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatBalance } from '@/lib/utils';
import { getAvailableGatewaysAction } from '@/actions/order/checkout';

interface RetryPaymentModalProps {
  orderId: string;
  charge: number; // in cents
  balance: number; // in cents
  trigger?: React.ReactElement;
}

export function RetryPaymentModal({ orderId, charge, balance, trigger }: RetryPaymentModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableGateways, setAvailableGateways] = useState<{
    yookassa: boolean;
    robokassa: boolean;
    cryptobot: boolean;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      getAvailableGatewaysAction().then((res) => {
        if (res.success && res.data) {
          setAvailableGateways(res.data);
        }
      });
    }
  }, [isOpen]);

  const amountRub = centsToRub(charge);
  const canPayFromBalance = balance >= charge;

  async function handleRetry(gateway: string) {
    try {
      setIsProcessing(true);
      const { retryCheckoutAction } = await import('@/actions/order/checkout');
      const res = await retryCheckoutAction({ orderId, gateway });
      
      if (res.success) {
        if (gateway === 'balance' || res.data?.paymentUrl?.includes('/success')) {
          toast.success('Заказ успешно оплачен!');
          setIsOpen(false);
          router.refresh();
        } else if (res.data?.paymentUrl) {
          // Redirect to external gateway
          window.location.href = res.data.paymentUrl;
        } else {
          toast.error('Не удалось создать ссылку для оплаты. Попробуйте ещё раз через минуту.');
        }
      } else {
        toast.error(res.error || 'Платёжная система временно недоступна. Попробуйте позже или выберите другой способ оплаты.');
      }
    } catch {
      toast.error('Проблема с интернет-соединением. Проверьте связь и попробуйте снова.');
    } finally {
      setIsProcessing(false);
    }
  }

  const showYooKassa = !availableGateways || availableGateways.yookassa;
  const showRobokassa = availableGateways ? availableGateways.robokassa : false;
  const showCryptoBot = availableGateways ? availableGateways.cryptobot : false;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          trigger || (
            <Button 
              size="default" 
              className="w-full sm:w-auto h-11 px-4 rounded-xl text-sm font-semibold bg-warning hover:bg-warning/90 text-primary-foreground transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Wallet className="w-3 h-3 shrink-0" /> Оплатить / Проверить
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Завершение оплаты</DialogTitle>
          <DialogDescription>
            Заказ ожидает оплаты. Выберите удобный способ, чтобы запустить его в работу.
            <br/><span className="text-success-text mt-2 block">💡 Если вы уже оплатили, просто выберите тот же способ — система проверит статус платежа и запустит заказ без повторного списания.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="bg-muted/50 rounded-xl p-4 flex justify-between items-center border border-border/50">
            <span className="text-sm font-medium text-muted-foreground">К оплате:</span>
            <span className="text-xl font-bold text-foreground">
              {amountRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
            </span>
          </div>

          <div className="space-y-3 mt-2">
            {/* 1. Internal Balance */}
            <Button
              intent="outline"
              size="lg"
              className="w-full justify-start h-14 relative group overflow-hidden border-border/60 hover:border-primary/50 hover:bg-primary/5"
              disabled={isProcessing || !canPayFromBalance}
              onClick={() => handleRetry('balance')}
            >
              <Wallet className={`w-5 h-5 mr-3 ${canPayFromBalance ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="flex flex-col items-start">
                <span className="font-semibold text-foreground">Внутренний баланс</span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  Доступно: {formatBalance(balance)}
                </span>
              </div>
              {!canPayFromBalance && (
                <div className="absolute inset-y-0 right-4 flex items-center">
                  <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-1 rounded">Недостаточно</span>
                </div>
              )}
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin absolute right-4 text-muted-foreground" />}
            </Button>

            {/* 2. YooKassa */}
            {showYooKassa && (
              <Button
                intent="outline"
                size="lg"
                className="w-full justify-start h-14 border-border/60 hover:border-primary/50 hover:bg-primary/5"
                disabled={isProcessing}
                onClick={() => handleRetry('yookassa')}
              >
                <CreditCard className="w-5 h-5 mr-3 text-primary" />
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-foreground">Банковская карта / СБП</span>
                  <span className="text-xs text-muted-foreground mt-0.5">YooKassa</span>
                </div>
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin absolute right-4 text-muted-foreground" />}
              </Button>
            )}

            {/* 3. Robokassa (Only when configured) */}
            {showRobokassa && (
              <Button
                intent="outline"
                size="lg"
                className="w-full justify-start h-14 border-border/60 hover:border-primary/50 hover:bg-primary/5"
                disabled={isProcessing}
                onClick={() => handleRetry('robokassa')}
              >
                <Coins className="w-5 h-5 mr-3 text-info" />
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-foreground">Робокасса</span>
                  <span className="text-xs text-muted-foreground mt-0.5">Карты РФ/СНГ, СБП, Электронные кошельки</span>
                </div>
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin absolute right-4 text-muted-foreground" />}
              </Button>
            )}

            {/* 4. CryptoBot (Only when configured) */}
            {showCryptoBot && (
              <Button
                intent="outline"
                size="lg"
                className="w-full justify-start h-14 border-border/60 hover:border-primary/50 hover:bg-primary/5"
                disabled={isProcessing}
                onClick={() => handleRetry('cryptobot')}
              >
                <Bitcoin className="w-5 h-5 mr-3 text-warning-text" />
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-foreground">Криптовалюта</span>
                  <span className="text-xs text-muted-foreground mt-0.5">CryptoBot (USDT, TON, BTC)</span>
                </div>
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin absolute right-4 text-muted-foreground" />}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
