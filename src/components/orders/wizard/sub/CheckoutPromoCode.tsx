'use client';
import React from 'react';

interface CheckoutPromoCodeProps {
  showPromo: boolean;
  setShowPromo: (show: boolean) => void;
  promoCodeInput: string;
  setPromoCodeInput: (code: string) => void;
  appliedPromo: string;
  promoMessage: { type: 'success' | 'error'; text: string } | null;
  isApplyingPromo: boolean;
  handleApplyPromo: () => void;
  handleRemovePromo: () => void;
}

export function CheckoutPromoCode({
  showPromo,
  setShowPromo,
  promoCodeInput,
  setPromoCodeInput,
  appliedPromo,
  promoMessage,
  isApplyingPromo,
  handleApplyPromo,
  handleRemovePromo,
}: CheckoutPromoCodeProps) {
  if (!showPromo) {
    return (
      <button
        type="button"
        onClick={() => setShowPromo(true)}
        className="text-xs font-bold text-primary hover:underline flex items-center gap-1 min-h-[44px] py-2 cursor-pointer"
      >
        + Есть промокод?
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-foreground">Промокод</label>
        {appliedPromo && (
          <button
            type="button"
            onClick={handleRemovePromo}
            className="text-[11px] font-medium text-muted-foreground hover:text-destructive cursor-pointer"
          >
            Удалить
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={promoCodeInput}
          onChange={e => setPromoCodeInput(e.target.value.toUpperCase())}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleApplyPromo();
            }
          }}
          placeholder="ВВЕДИТЕ ПРОМОКОД"
          disabled={Boolean(appliedPromo)}
          className="flex-1 px-4 py-2.5 text-base sm:text-sm uppercase font-mono bg-background border border-border/60 rounded-xl text-foreground disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[44px]"
        />
        {!appliedPromo ? (
          <button
            type="button"
            onClick={handleApplyPromo}
            disabled={!promoCodeInput.trim() || isApplyingPromo}
            className="px-4 py-2.5 min-h-[44px] bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 disabled:opacity-50 cursor-pointer shrink-0 flex items-center justify-center"
          >
            {isApplyingPromo ? '...' : 'Применить'}
          </button>
        ) : (
          <div className="flex items-center px-3 py-2.5 min-h-[44px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl shrink-0 select-none">
            ✓ Активен
          </div>
        )}
      </div>
      {promoMessage && (
        <p className={`text-xs font-semibold ${promoMessage.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
          {promoMessage.text}
        </p>
      )}
    </div>
  );
}
