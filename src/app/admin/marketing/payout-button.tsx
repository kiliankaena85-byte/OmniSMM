'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { processReferralPayout } from '@/actions/admin/marketing';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { formatRubles } from '@/utils/format-price';

interface PayoutButtonProps {
  userId: string;
  amount: number;
}

export function PayoutButton({ userId, amount }: PayoutButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);

  const handlePayout = () => {
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    setIsConfirmOpen(false);
    startTransition(async () => {
      const res = await processReferralPayout(userId, amount);
      if (res.success) {
        toast.success('Выплата произведена успешно');
      } else {
        toast.error(res.error);
      }
    });
  };

  const MIN_PAYOUT_CENTS = 10000; // 100 RUB
  const MAX_PAYOUT_CENTS = 5000000; // 50,000 RUB

  const isBelowMin = amount < MIN_PAYOUT_CENTS;
  const isAboveMax = amount > MAX_PAYOUT_CENTS;
  const isDisabled = isBelowMin || isAboveMax || isPending;

  return (
    <>
      <Button
        size="sm"
        intent="secondary"
        onClick={handlePayout}
        disabled={isDisabled}
        className="h-8 text-[10px] font-bold uppercase tracking-wider"
      >
        {isPending ? 'Загрузка...' : isBelowMin ? 'Мин. 100 ₽' : isAboveMax ? 'Макс. 50к ₽' : 'На баланс'}
      </Button>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirm}
        title="Подтверждение выплаты"
        confirmText="Выплатить"
      >
        Вы действительно хотите выплатить {formatRubles(amount / 100)} на баланс клиента?
      </ConfirmModal>
    </>
  );
}

